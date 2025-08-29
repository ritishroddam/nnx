import traceback
from flask import Blueprint, jsonify, render_template, request
from datetime import datetime, timedelta, timezone
from app.database import db
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app.models import User
from app.utils import roles_required, get_filtered_results, get_vehicle_data
from app.parser import atlantaAis140ToFront


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
        # Get all active IMEIs
        imeis = list(get_vehicle_data().distinct("IMEI"))
        
        # Get latest record for each IMEI
        latest_records = list(atlantaLatestCollection.find({"_id": {"$in": imeis}}))

        atlantaAis140Records = list(atlantaAis140Collection.find({"_id": {"$in": imeis}}))

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
            
            if ignition == "1":
                if speed > 0:
                    moving_vehicles += 1
                else:
                    idle_vehicles += 1  # Only count as idle if ignition is ON and speed is 0
            else:
                parked_vehicles += 1  # Separate count for parked vehicles
        
        return jsonify({
            "total_devices": len(imeis),
            "moving_vehicles": moving_vehicles,
            "offline_vehicles": offline_vehicles,
            "idle_vehicles": idle_vehicles,   # This will now match the status cards
            "parked_vehicles": parked_vehicles  # Optional: track parked separately
        }), 200
    except Exception as e:
        print(f"🚨 Error fetching pie chart data: {e}")
        return jsonify({"error": "Failed to fetch pie chart data"}), 500

@dashboard_bp.route('/atlanta_distance_data', methods=['GET'])
@jwt_required()
@roles_required('admin', 'clientAdmin', 'user')
def atlanta_distance_data():
    try:
        imeis = list(get_vehicle_data().distinct("IMEI"))

        distanceKeys = {}

        startTime = datetime.now()
        for i in range(0, 7):
            date = datetime.now(timezone.utc) - timedelta(days=i)
            start_of_day = date.replace(hour=0, minute=0, second=0, microsecond=0)
            end_of_day = date.replace(hour=23, minute=59, second=59, microsecond=999999)
            pipeline = [
                {"$match": {
                    "date_time": {
                        "$gte": start_of_day,
                        "$lt": end_of_day
                    },
                    "imei": {"$in":imeis}
                }},
                {"$sort": {"date_time": -1}},
                {"$group": {
                    "_id": "$imei",
                    "last_odometer": {"$first": "$odometer"},
                    "first_odometer": {"$last": "$odometer"}
                }},
                {"$project": {
                    "_id": 0,
                    "imei": "$_id",
                    "first_odometer": 1,
                    "last_odometer": 1
                }}
            ]

            distances_atlanta = list(atlanta_collection.aggregate(pipeline))

            pipeline = [
                    {"$match": {
                        "imei": {"$in": imeis},
                        "gps.timestamp": {"$gte": start_of_day, "$lt": end_of_day}
                    }},
                    {"$sort": {"gps.timestamp": -1}},
                    {
                        "$group": {
                            "_id": "$imei",
                            "last_odometer": {"$first": "$telemetry.odometer"},
                            "first_odometer": {"$last": "$telemetry.odometer"}
                        }
                    },
                    {"$project": {
                        "_id": 0,
                        "imei": "$_id",
                        "first_odometer": 1,
                        "last_odometer": 1
                    }}
                ]

            distances_ais140 = list(atlantaAis140Collection.aggregate(pipeline))

            for dist in distances_ais140:
                distances_atlanta.append(dist)

            distance = 0

            for dist in distances_atlanta:
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
        utc_now = datetime.now(timezone('UTC'))
        range_param = request.args.get("range", "1day")
        status_filter = request.args.get("status")
        
        range_map = {
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
        start_of_day = utc_now - delta
        end_of_day = utc_now
        
        imeis = list(get_vehicle_data().distinct("IMEI"))
        vehicle_map_cursor = vehicle_inventory.find({"IMEI": {"$in": imeis}}, {"IMEI": 1, "LicensePlateNumber": 1, "_id": 0})
        vehicle_map = {vehicle["IMEI"]: vehicle["LicensePlateNumber"] for vehicle in vehicle_map_cursor}
        
        # OPTIMIZED: Split into multiple lightweight pipelines instead of one heavy $push pipeline
        
        # Pipeline 1: Statistics (distance, speed) without $push
        stats_pipeline = [
            {"$match": {
                "date_time": {"$gte": start_of_day, "$lt": end_of_day},
                "imei": {"$in": imeis}
            }},
            {"$sort": {"imei": 1, "date_time": 1}},
            {"$group": {
                "_id": "$imei",
                "start_odometer": {"$first": {"$toDouble": "$odometer"}},
                "end_odometer": {"$last": {"$toDouble": "$odometer"}},
                "max_speed": {
                    "$max": {
                        "$cond": [
                            {"$eq": ["$ignition", "1"]},
                            {"$toDouble": "$speed"},
                            None
                        ]
                    }
                },
                "sum_speed": {
                    "$sum": {
                        "$cond": [
                            {
                                "$and": [
                                    {"$eq": ["$ignition", "1"]},
                                    {"$gt": [{"$toDouble": "$speed"}, 0]}
                                ]
                            },
                            {"$toDouble": "$speed"},
                            0
                        ]
                    }
                },
                "count_speed": {
                    "$sum": {
                        "$cond": [
                            {
                                "$and": [
                                    {"$eq": ["$ignition", "1"]},
                                    {"$gt": [{"$toDouble": "$speed"}, 0]}
                                ]
                            },
                            1,
                            0
                        ]
                    }
                }
            }},
            {"$project": {
                "imei": "$_id",
                "distance": {"$subtract": ["$end_odometer", "$start_odometer"]},
                "max_speed": 1,
                "avg_speed": {
                    "$cond": [
                        {"$eq": ["$count_speed", 0]},
                        0,
                        {"$divide": ["$sum_speed", "$count_speed"]}
                    ]
                }
            }}
        ]
        
        # Pipeline 2: Latest record for each IMEI
        latest_record_pipeline = [
            {"$match": {
                "date_time": {"$gte": start_of_day, "$lt": end_of_day},
                "imei": {"$in": imeis}
            }},
            {"$sort": {"imei": 1, "date_time": -1}},
            {"$group": {
                "_id": "$imei",
                "latest": {"$first": "$$ROOT"}
            }}
        ]
        
        # Pipeline 3: Time analysis for driving/idle time and stops
        time_analysis_pipeline = [
            {"$match": {
                "date_time": {"$gte": start_of_day, "$lt": end_of_day},
                "imei": {"$in": imeis}
            }},
            {"$sort": {"imei": 1, "date_time": 1}},
            {"$group": {
                "_id": "$imei",
                "records": {
                    "$push": {
                        "date_time": "$date_time",
                        "ignition": "$ignition",
                        "speed": {"$toDouble": "$speed"}
                    }
                }
            }}
        ]
        
        # Execute all pipelines
        stats_results = list(atlanta_collection.aggregate(stats_pipeline))
        latest_results = list(atlanta_collection.aggregate(latest_record_pipeline))
        time_results = list(atlanta_collection.aggregate(time_analysis_pipeline))
        
        # Convert to dictionaries for fast lookup
        stats_dict = {result['imei']: result for result in stats_results}
        latest_dict = {result['_id']: result['latest'] for result in latest_results}
        time_dict = {result['_id']: result['records'] for result in time_results}
        
        twenty_four_hours_ago = utc_now - timedelta(hours=24)
        vehicle_data = []
        
        # Combine results for each IMEI
        for imei in imeis:
            stats = stats_dict.get(imei, {})
            latest = latest_dict.get(imei, {})
            time_records = time_dict.get(imei, [])
            
            if not latest:
                continue
                
            vehicle_doc = vehicle_inventory.find_one({"IMEI": imei}) or {}
            
            # Calculate driving time, idle time, and stops from time records
            driving_time = timedelta()
            idle_time = timedelta()
            number_of_stops = 0
            prev_ignition = None
            prev_time = None
            
            for record in time_records:
                curr_time = record["date_time"]
                ignition = record.get("ignition")
                speed = record.get("speed", 0.0)
                
                if prev_time is not None:
                    delta = curr_time - prev_time
                    
                    if prev_ignition == "1" and speed > 0:
                        driving_time += delta
                    elif prev_ignition == "1" and speed == 0:
                        idle_time += delta
                
                if prev_ignition == "0" and ignition == "1":
                    number_of_stops += 1
                
                prev_ignition = ignition
                prev_time = curr_time
            
            # Parse last update time
            last_update = None
            if latest.get("date") and latest.get("time"):
                try:
                    last_update = datetime.strptime(
                        latest.get("date") + latest.get("time"),
                        '%d%m%y%H%M%S'
                    )
                    last_update = last_update.replace(tzinfo=timezone('UTC'))
                except ValueError as e:
                    print(f"Error parsing date/time: {e}")
                    last_update = None
            
            is_offline = last_update is None or last_update < twenty_four_hours_ago
            
            vehicle_info = {
                "imei": imei,
                "registration": vehicle_doc.get("LicensePlateNumber", "N/A"),
                "VehicleType": vehicle_doc.get("VehicleType", "N/A"),
                "CompanyName": vehicle_doc.get("CompanyName", "N/A"),
                "location": vehicle_doc.get("Location", "Location unknown"),
                "latitude": latest.get("latitude", "N/A"),
                "longitude": latest.get("longitude", "N/A"),
                "speed": latest.get("speed", "0.0"),
                "ignition": latest.get("ignition", "0"),
                "gsm": latest.get("gsm_sig", "0"),
                "sos": latest.get("sos", "0"),
                "main_power": latest.get("main_power", "1"),
                "gps": latest.get("gps", True),
                "odometer": latest.get("odometer", "N/A"),
                "date": latest.get("date", None),
                "time": latest.get("time", None),
                "distance": round(stats.get("distance", 0), 2),
                "max_speed": stats.get("max_speed", 0),
                "avg_speed": round(stats.get("avg_speed", 0), 2),
                "driving_time": format_seconds(driving_time.total_seconds()),
                "idle_time": format_seconds(idle_time.total_seconds()),
                "number_of_stops": number_of_stops,
                "is_offline": is_offline,
                "last_updated": format_last_updated(latest.get("date"), latest.get("time"))
            }
            
            # Apply status filtering
            if not status_filter:
                vehicle_data.append(vehicle_info)
            else:
                speed = float(vehicle_info.get("speed", 0))
                ignition = vehicle_info.get("ignition", "0")
                is_offline = vehicle_info.get("is_offline", False)
                main_power = vehicle_info.get("main_power", "1")
                
                if status_filter == "running" and ignition == "1" and speed > 0 and not is_offline:
                    vehicle_data.append(vehicle_info)
                elif status_filter == "idle" and ignition == "1" and speed == 0 and not is_offline:
                    vehicle_data.append(vehicle_info)
                elif status_filter == "parked" and ignition == "0" and speed == 0 and not is_offline:
                    vehicle_data.append(vehicle_info)
                elif status_filter == "speed" and ignition == "1" and 40 <= speed < 60 and not is_offline:
                    vehicle_data.append(vehicle_info)
                elif status_filter == "overspeed" and ignition == "1" and speed >= 60 and not is_offline:
                    vehicle_data.append(vehicle_info)
                elif status_filter == "offline" and is_offline:
                    vehicle_data.append(vehicle_info)
                elif status_filter == "disconnected" and main_power == "0":
                    vehicle_data.append(vehicle_info)
        
        return jsonify(vehicle_data), 200
        
    except Exception as e:
        print(f"🚨 Error fetching vehicle distances: {e}")
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

def format_last_updated(date_str, time_str):
    if not date_str or not time_str:
        return "N/A"
    try:
        dt = datetime.strptime(date_str + time_str, '%d%m%y%H%M%S')
        return dt.strftime('%Y-%m-%d %H:%M:%S')
    except:
        return "N/A"

@dashboard_bp.route('/get_status_data', methods=['GET'])
@jwt_required()
@roles_required('admin', 'clientAdmin', 'user')
def get_status_data():
    try:
        utc_now = datetime.now(timezone('UTC'))
        twenty_four_hours_ago = utc_now - timedelta(hours=24)
        
        response = get_vehicle_range_data()
        if isinstance(response, tuple):
            vehicle_data = response[0].json 
        else:
            vehicle_data = response.json
        
        counters = {
            'runningVehicles': 0,
            'idleVehicles': 0,
            'parkedVehicles': 0,
            'speedVehicles': 0,
            'overspeedVehicles': 0,
            'offlineVehicles': 0,
            'disconnectedVehicles': 0,
            'noGpsVehicles': 0,
            'totalVehicles': len(vehicle_data)
        }

        for vehicle in vehicle_data:
            speed = float(vehicle.get("speed", 0))
            ignition = vehicle.get("ignition", "0")
            is_offline = vehicle.get("is_offline", False)
            main_power = vehicle.get("main_power", "1")
            gps = vehicle.get("gps", True)

            if ignition == "1" and speed > 0 and not is_offline:
                counters['runningVehicles'] += 1
            elif ignition == "1" and speed == 0 and not is_offline:
                counters['idleVehicles'] += 1
            elif ignition == "0" and speed == 0 and not is_offline:
                counters['parkedVehicles'] += 1
            
            if ignition == "1" and 40 <= speed < 60 and not is_offline:
                counters['speedVehicles'] += 1
            elif ignition == "1" and speed >= 60 and not is_offline:
                counters['overspeedVehicles'] += 1
            
            if is_offline:
                counters['offlineVehicles'] += 1
            if main_power == "0":
                counters['disconnectedVehicles'] += 1
            if not gps:
                counters['noGpsVehicles'] += 1

        return jsonify(counters), 200

    except Exception as e:
        print(f"Error fetching status data: {e}")
        return jsonify({"error": "Failed to fetch status data"}), 500