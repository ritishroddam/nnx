from flask import Blueprint, jsonify, render_template, request
from datetime import datetime, timedelta, timezone
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
import eventlet

from app.database import db
from app.models import User
from app.utils import roles_required, get_vehicle_data
from app.parser import atlantaAis140ToFront, getCollectionImeis
from app.Dashboard.dashboardHelper import getDistanceBasedOnTime, getSpeedDataBasedOnTime, getTimeAnalysisBasedOnTime
from app.geocoding import safe_geocode


dashboard_bp = Blueprint('Dashboard', __name__, static_folder='static', template_folder='templates')

@dashboard_bp.route('/page')
@jwt_required()
def page():
    return render_template('admin_dashboard.html')

atlanta_collection = db["atlanta"]
atlantaLatestCollection = db["atlantaLatest"]
collection = db['distinctAtlanta']
distance_travelled_collection = db['distanceTravelled']
vehicle_inventory = db["vehicle_inventory"]
atlantaAis140Collection = db["atlantaAis140"]
atlantaAis140LatestCollection = db["atlantaAis140_latest"]

IST = timezone(timedelta(hours=5, minutes=30))

def format_seconds(seconds):
    if seconds >= 86400:
        days = seconds // 86400
        hours = (seconds % 86400) // 3600
        return f"{days} days"
    elif seconds >= 3600:
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        return f"{hours} hours"
    elif seconds >= 60:
        minutes = seconds // 60
        sec = seconds % 60
        return f"{minutes} minutes"
    else:
        return f"{seconds} seconds"
    
def fetch_range_batches(imeis, start_of_day, end_of_day):
    pool = eventlet.GreenPool(size=3)
    funcs = (
        (getDistanceBasedOnTime, 'distance'),
        (getSpeedDataBasedOnTime, 'speed'),
        (getTimeAnalysisBasedOnTime, 'time'),
    )
    jobs = {name: pool.spawn(func, imeis, start_of_day, end_of_day)
            for func, name in funcs}
    return tuple(job.wait() for job in jobs.values())

def _empty_status_counters():
    return {
        'runningVehicles': 0,
        'idleVehicles': 0,
        'parkedVehicles': 0,
        'speedVehicles': 0,
        'overspeedVehicles': 0,
        'offlineVehicles': 0,
        'disconnectedVehicles': 0,
        'noGpsVehicles': 0,
        'totalVehicles': 0,
    }

def _process_vehicle_snapshot(
    imei,
    latest_dict,
    distance_dict,
    speed_dict,
    time_dict,
    vehicle_inventory,
    twenty_four_hours_ago,
    include_location,
):
    latest = latest_dict.get(imei)
    if not latest:
        return None, _empty_status_counters()

    distance = distance_dict.get(imei, {})
    speeds = speed_dict.get(imei, {})
    time_records = time_dict.get(imei, [])

    vehicle_doc = vehicle_inventory.find_one({"IMEI": imei}) or {}

    driving_time = timedelta()
    idle_time = timedelta()
    number_of_stops = 0
    prev_ignition = None
    prev_time = None

    for record in time_records:
        curr_time = record.get("date_time")
        if not curr_time or (prev_time and curr_time < prev_time):
            continue

        ignition = record.get("ignition")
        speed_val = float(record.get("speed", 0.0))

        if prev_time is not None:
            delta_t = curr_time - prev_time
            if prev_ignition == "1" and speed_val > 0:
                driving_time += delta_t
            elif prev_ignition == "1" and speed_val == 0:
                idle_time += delta_t

        if prev_ignition == "0" and ignition == "1":
            number_of_stops += 1

        prev_ignition = ignition
        prev_time = curr_time

    last_update = latest.get("date_time")
    is_offline = last_update is None or last_update < twenty_four_hours_ago
    try:
        current_speed = float(latest.get("speed", 0))
    except (ValueError, TypeError):
        current_speed = 0.0

    ignition_state = str(latest.get("ignition", "0"))
    main_power = str(latest.get("main_power", "1"))
    gps_ok = bool(True if latest.get("gps") in ["A"] else False)

    counters_delta = _empty_status_counters()
    counters_delta["totalVehicles"] += 1
    if is_offline:
        counters_delta["offlineVehicles"] += 1
    else:
        if ignition_state == "0":
            counters_delta["parkedVehicles"] += 1
        else: 
            if current_speed == 0:
                counters_delta["idleVehicles"] += 1
            elif current_speed > 0:
                counters_delta["runningVehicles"] += 1
            
            if vehicle_doc:
                slowSpeedThreshold = int(vehicle_doc.get("slowSpeed", "40"))
                normalSpeedThreshold = int(vehicle_doc.get("normalSpeed", "60"))
            else: 
                slowSpeedThreshold = 40
                normalSpeedThreshold = 60

            if slowSpeedThreshold <= current_speed < normalSpeedThreshold:
                counters_delta["speedVehicles"] += 1
            if current_speed >= normalSpeedThreshold:
                counters_delta["overspeedVehicles"] += 1
                
    if main_power == "0":
        counters_delta["disconnectedVehicles"] += 1
    if not gps_ok:
        counters_delta["noGpsVehicles"] += 1

    location_value = None
    if include_location:
        try:
            location_value = safe_geocode(latest.get("latitude"), latest.get("longitude"))
        except Exception:
            location_value = None

    vehicle_info = {
        "imei": imei,
        "registration": vehicle_doc.get("LicensePlateNumber", "N/A"),
        "VehicleType": vehicle_doc.get("VehicleType", "N/A"),
        "CompanyName": vehicle_doc.get("CompanyName", "N/A"),
        "location": location_value,
        "latitude": latest.get("latitude", "N/A"),
        "longitude": latest.get("longitude", "N/A"),
        "speed": latest.get("speed", "0.0"),
        "ignition": latest.get("ignition", "0"),
        "gsm": latest.get("gsm_sig", "0"),
        "sos": latest.get("sos", "0"),
        "main_power": main_power,
        "gps": gps_ok,
        "odometer": latest.get("odometer", "N/A"),
        "date": latest.get("date"),
        "time": latest.get("time"),
        "distance": round(distance.get("distanceTravelled", 0), 2),
        "max_speed": speeds.get("max_speed", 0),
        "avg_speed": round(speeds.get("avg_speed", 0), 2),
        "driving_time": format_seconds(driving_time.total_seconds()),
        "idle_time": format_seconds(idle_time.total_seconds()),
        "number_of_stops": number_of_stops,
        "is_offline": is_offline,
        "last_updated": format_last_updated(latest.get("date"), latest.get("time")),
    }
    return vehicle_info, counters_delta

def build_vehicle_snapshot(range_param="1day", status_filter=None, include_location=True):
    utc_now = datetime.now(timezone.utc)
    if status_filter:
        range_param = "1minute"
        
    range_map = {
        "1minute": timedelta(minutes=1),
        "1hour": timedelta(hours=1),
        "6hours": timedelta(hours=6),
        "12hours": timedelta(hours=12),
        "1day": timedelta(days=1),
        "2days": timedelta(days=2),
        "4days": timedelta(days=4),
        "7days": timedelta(days=7),
        "14days": timedelta(days=14),
        "30days": timedelta(days=30),
    }
    delta = range_map.get(range_param, timedelta(days=1))
    
    if delta >= timedelta(days=1):
        ist_now = datetime.now(IST)
        start_of_day = ist_now - delta
        start_of_day = start_of_day.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
        end_of_day = start_of_day + delta
    else:
        start_of_day = utc_now - delta
        end_of_day = utc_now

    vehicleInvyImeis = list(get_vehicle_data().distinct("IMEI"))
    imeis = getCollectionImeis(vehicleInvyImeis)

    if not imeis:
        return [], _empty_status_counters()

    distance_results, speed_results, time_results = fetch_range_batches(imeis, start_of_day, end_of_day)
    for result in distance_results:
        distanceTravelled = float(result.get('last_odometer', 0)) - float(result.get('first_odometer', 0))
        result['distanceTravelled'] = max(distanceTravelled, 0)

    latest_results = list(atlantaLatestCollection.find(
        {"_id": {"$in": imeis}}, 
        {"_id": 1, "imei": 1, "latitude": 1, "longitude": 1, "speed": 1, "ignition": 1, "gsm_sig": 1, "sos": 1, "main_power": 1, "gps": 1, "odometer": 1, "date": 1, "time": 1, "date_time": 1,},
    ))
    for doc in atlantaAis140LatestCollection.find(
        {"_id": {"$in": imeis}},
        {"_id": 1, "imei": 1, "gps.lat": 1, "gps.lon": 1, "telemetry.speed": 1, "telemetry.ignition": 1, "network.gsmSignal": 1, "telemetry.emergencyStatus": 1, "telemetry.mainPower": 1, "gps.gpsStatus": 1, "telemetry.odometer": 1, "gps.timestamp": 1},
    ):
        latest_results.append(atlantaAis140ToFront(doc))

    speed_dict = {result['imei']: result for result in speed_results}
    distance_dict = {result['imei']: result for result in distance_results}
    latest_dict = {result['_id']: result for result in latest_results}
    time_dict = {result['_id']: result['records'] for result in time_results}

    twenty_four_hours_ago = utc_now - timedelta(hours=24)
    counters = _empty_status_counters()
    vehicle_data = []

    pool = eventlet.GreenPool(size=8)
    def worker(imei):
        info, delta = _process_vehicle_snapshot(
            imei,
            latest_dict,
            distance_dict,
            speed_dict,
            time_dict,
            vehicle_inventory,
            twenty_four_hours_ago,
            include_location,
        )
        return imei, info, delta

    for imei, vehicle_info, delta in pool.imap(worker, imeis):
        if not vehicle_info:
            continue
        should_include = True
        ignition_state = str(vehicle_info["ignition"])
        current_speed = float(vehicle_info["speed"] or 0)
        is_offline = vehicle_info["is_offline"]
        main_power = vehicle_info["main_power"]
        gps_ok = vehicle_info["gps"]
        vehicle_data_info = vehicle_inventory = db["vehicle_inventory"].find_one({"IMEI": imei}) or {}
        if vehicle_data_info:
            slowSpeedThreshold = int(vehicle_data_info.get("slowSpeed", "40"))
            normalSpeedThreshold = int(vehicle_data_info.get("normalSpeed", "60"))
        else:
            slowSpeedThreshold = 40
            normalSpeedThreshold = 60
        if status_filter:
            filter_checks = {
                "running": ignition_state == "1" and current_speed > 0 and not is_offline,
                "idle": ignition_state == "1" and current_speed == 0 and not is_offline,
                "parked": ignition_state == "0" and current_speed == 0 and not is_offline,
                "speed": ignition_state == "1" and slowSpeedThreshold <= current_speed < normalSpeedThreshold and not is_offline,
                "overspeed": ignition_state == "1" and current_speed >= normalSpeedThreshold and not is_offline,
                "offline": is_offline,
                "disconnected": main_power == "0",
                "noGps": not gps_ok,
            }
            should_include = filter_checks.get(status_filter, False)
        if should_include:
            vehicle_data.append(vehicle_info)
        for key, val in delta.items():
            counters[key] += val
    return vehicle_data, counters

def format_last_updated(date_str, time_str):
    if not date_str or not time_str:
        return "N/A"
    try:
        dt = datetime.strptime(date_str + time_str, '%d%m%y%H%M%S')
        return dt.strftime('%Y-%m-%d %H:%M:%S')
    except:
        return "N/A"

@dashboard_bp.route('/dashboard_data', methods=['GET'])
@jwt_required()
@roles_required('admin')  
def dashboard_data():
    try:
        num_devices = db["device_inventory"].count_documents({})
        num_sims = db["sim_inventory"].count_documents({})
        num_customers = db["customers_list"].count_documents({})
        num_employees = db["employees_db"].count_documents({})

        return jsonify({
            "devices": num_devices,
            "sims": num_sims,
            "customers": num_customers,
            "employees": num_employees
        }), 200
    except Exception as e:
        print(f"Error fetching dashboard data: {e}")
        return jsonify({"error": "Failed to fetch dashboard data"}), 500

@dashboard_bp.route('/atlanta_pie_data', methods=['GET'])
@jwt_required()
@roles_required('admin', 'clientAdmin', 'user')
def atlanta_pie_data():
    try:
        vehicleInvyImeis = list(get_vehicle_data().distinct("IMEI"))
        
        imeis = getCollectionImeis(vehicleInvyImeis)
        
        if not imeis:
            return jsonify({
                "total_devices": 0,
                "moving_vehicles": 0,
                "offline_vehicles": 0,
                "idle_vehicles": 0,   
                "parked_vehicles": 0  
            }), 200
        
        latest_records = list(atlantaLatestCollection.find({"_id": {"$in": imeis}}))
        atlantaAis140Records = list(atlantaAis140LatestCollection.find({"_id": {"$in": imeis}}))
        
        for doc in atlantaAis140Records:
            data = atlantaAis140ToFront(doc)
            latest_records.append(data)

        now = datetime.now(timezone.utc)
        twenty_four_hours_ago = now - timedelta(hours=24)
        
        moving_vehicles = 0
        idle_vehicles = 0
        offline_vehicles = 0
        parked_vehicles = 0
        
        for latest_data in latest_records:
            try:
                last_update = latest_data["date_time"]
            except (KeyError, ValueError):
                last_update = None
                
            is_offline = last_update is None or last_update < twenty_four_hours_ago
            
            if is_offline:
                offline_vehicles += 1
                continue
                
            speed = float(latest_data.get("speed", 0))
            ignition = latest_data.get("ignition", "0")
            if ignition == "1" or ignition == 1:
                if speed > 0:
                    moving_vehicles += 1
                else:
                    idle_vehicles += 1  
            else:
                parked_vehicles += 1 
        
        return jsonify({
            "total_devices": len(latest_records),
            "moving_vehicles": moving_vehicles,
            "offline_vehicles": offline_vehicles,
            "idle_vehicles": idle_vehicles,   
            "parked_vehicles": parked_vehicles  
        }), 200
    except Exception as e:
        print(f"🚨 Error fetching pie chart data: {e}")
        return jsonify({"error": "Failed to fetch pie chart data"}), 500

@dashboard_bp.route('/atlanta_distance_data', methods=['GET'])
@jwt_required()
@roles_required('admin', 'clientAdmin', 'user')
def atlanta_distance_data():
    try:
        vehicleInvyImeis = list(get_vehicle_data().distinct("IMEI"))
        
        imeis = getCollectionImeis(vehicleInvyImeis)
        
        if not imeis:
            return jsonify({
                "labels": [],
                "distances": []
            }), 200
        
        startTime = datetime.now()

        distanceKeys = {}

        for i in range(6, -1, -1):
            date = datetime.now(timezone.utc) - timedelta(days=i)
            start_of_day = date.replace(hour=0, minute=0, second=0, microsecond=0)
            end_of_day = date.replace(hour=23, minute=59, second=59, microsecond=999999)

            distances = getDistanceBasedOnTime(imeis, start_of_day, end_of_day)

            distance = 0

            for dist in distances:
                first_odometer = float(dist.get('first_odometer', 0))
                last_odometer = float(dist.get('last_odometer', 0))
                distance_traveled = last_odometer - first_odometer
                distance += distance_traveled if distance_traveled >= 0 else 0
            label = date.strftime("%Y-%m-%d")

            distanceKeys[label] = distance

        distancesJson = {
            "labels": list(distanceKeys.keys()),
            "distances": list(distanceKeys.values())
        }

        return jsonify(distancesJson), 200

    except Exception as e:
        print(f"🚨 Error fetching distance data: {e}")
        return jsonify({"error": "Failed to fetch distance data"}), 500

@dashboard_bp.route('/get_vehicle_range_data', methods=['GET'])
@jwt_required()
@roles_required('admin', 'clientAdmin', 'user')
def get_vehicle_range_data():
    try:
        range_param = request.args.get("range", "1day")
        status_filter = request.args.get("status")
        vehicle_data, _ = build_vehicle_snapshot(range_param, status_filter, include_location=True)
        return jsonify(vehicle_data), 200
    except Exception as e:
        print(f"🚨 Error fetching vehicle distances: {e}")
        return jsonify({"error": str(e)}), 500

@dashboard_bp.route('/get_status_data', methods=['GET'])
@jwt_required()
@roles_required('admin', 'clientAdmin', 'user')
def get_status_data():
    try:
        vehicleInvyImeis = list(get_vehicle_data().distinct("IMEI"))
        
        imeis = getCollectionImeis(vehicleInvyImeis)
        
        if not imeis:
            return jsonify(_empty_status_counters), 200

        latest_records = list(atlantaLatestCollection.find({"_id": {"$in": imeis}}))
        atlantaAis140Records = list(atlantaAis140LatestCollection.find({"_id": {"$in": imeis}}))
        
        for doc in atlantaAis140Records:
            data = atlantaAis140ToFront(doc)
            latest_records.append(data)
        
        now = datetime.now(timezone.utc)
        twenty_four_hours_ago = now - timedelta(hours=24)
        
        running_vehicles = 0
        idle_vehicles = 0
        parked_vehicles = 0
        speed_vehicles = 0
        overspeed_vehicles = 0
        offline_vehicles = 0
        disconnected_vehicles = 0
        total_vehicles = 0
        
        for latest_data in latest_records:
            total_vehicles += 1
            lastUpdate = latest_data.get("date_time")
            
            is_offline = lastUpdate is None or lastUpdate < twenty_four_hours_ago
            
            main_power = int(latest_data.get("main_power", "1"))
            
            if not main_power:
                disconnected_vehicles += 1
            
            if is_offline:
                offline_vehicles += 1
                continue
            
            ignition = int(latest_data.get("ignition", "0"))
            
            if not ignition:
                parked_vehicles += 1
                continue
            
            speed = float(latest_data.get("speed", 0))
            
            vehicle = vehicle_inventory.find_one({"IMEI": latest_data.get("imei")}) or {}
            if vehicle:
                slowSpeedThreshold = int(vehicle.get("slowSpeed", "40"))
                normalSpeedThreshold = int(vehicle.get("normalSpeed", "60"))
            else: 
                slowSpeedThreshold = 40
                normalSpeedThreshold = 60
            
            if speed == 0:
                idle_vehicles += 1
                continue
            else: 
                running_vehicles += 1
                if slowSpeedThreshold <= speed < normalSpeedThreshold:
                    speed_vehicles += 1
                    continue
                elif speed >= normalSpeedThreshold:
                    overspeed_vehicles += 1
                    continue
            
        
        return jsonify({
            "runningVehicles": running_vehicles,
            "idleVehicles": idle_vehicles,
            "parkedVehicles": parked_vehicles,
            "speedVehicles": speed_vehicles,
            "overspeedVehicles": overspeed_vehicles,
            "offlineVehicles": offline_vehicles,
            "disconnectedVehicles": disconnected_vehicles,
            "totalVehicles": total_vehicles,
        }), 200
    except Exception as e:
        print(f"Error fetching status data: {e}")
        return jsonify({"error": "Failed to fetch status data"}), 500