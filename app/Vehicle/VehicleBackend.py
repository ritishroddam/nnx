from flask import Flask, Blueprint, render_template, request, jsonify, flash
from datetime import datetime, timedelta
from pytz import timezone
from bson import ObjectId
from app.database import db
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app.models import User
from app.utils import roles_required
from app.geocoding import geocodeInternal
from app.parser import atlantaAis140ToFront

vehicle_bp = Blueprint('Vehicle', __name__, static_folder='static', template_folder='templates')

atlanta_collection = db['atlanta']
atlantaLatest_collection = db['atlantaLatest']
vehicle_inventory_collection = db['vehicle_inventory']
company_collection = db['customers_list']
status_collection = db['statusAtlanta']
atlantaAis140_collection = db['atlantaAis140']
atlantaAis140Latest_collection = db['atlantaAis140_latest']
atlantaAis140Status_collection = db['atlantaAis140Status']

@vehicle_bp.route('/map')
@jwt_required()
def map():        
    return render_template('vehicleMap.html')

def format_seconds(seconds):
    seconds = int(seconds/1000)
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
    
def getVehicleStatus(imei_list):
    try:
        utc_now = datetime.now(timezone('UTC'))
        twenty_four_hours_ago = utc_now - timedelta(hours=24)
        
        results = list(status_collection.find({"_id": {"$in": imei_list}}))
        
        for imei in imei_list:
            data = atlantaAis140Status_collection.find_one({"_id": imei})
            if not data:
                pass
            results.append(data)
        
        print(results)
        
        statuses = []

        print("Processing vehicle status results")
        for item in results:
            imei = item["_id"]
            latest = item["latest"]
            history = item["history"]
            now = utc_now

            if latest["date_time"] < twenty_four_hours_ago:
                status = "offline"
                status_time_delta = (now - latest["date_time"]).total_seconds() * 1000
                status_time_str = format_seconds(status_time_delta)
            else:
                ignition = latest.get("ignition")
                speed = float(latest.get("speed", 0))
                current_status = None
                if ignition == "0":
                    current_status = "stopped"
                elif ignition == "1" and speed > 0:
                    current_status = "moving"
                elif ignition == "1" and speed == 0.0:
                    current_status = "idle"
                else:
                    current_status = "unknown"

                last_change_time = latest["date_time"]
                for h in history[1:]:
                    h_ignition = h.get("ignition")
                    h_speed = float(h.get("speed", 0))
                    if current_status == "moving" and not (h_ignition == "1" and h_speed > 0):
                        break
                    if current_status == "idle" and not (h_ignition == "1" and h_speed == 0):
                        break
                    if current_status == "stopped" and not (h_ignition == "0"):
                        break
                    last_change_time = h["date_time"]

                status = current_status
                status_time_delta = (now - last_change_time).total_seconds() * 1000
                status_time_str = format_seconds(status_time_delta)

            statuses.append({
                "imei": imei,
                "status": status,
                "status_time_delta": status_time_delta,
                "status_time_str": status_time_str,
                "date": latest["date"],
                "time": latest["time"],
                "ignition": latest.get("ignition"),
                "speed": latest.get("speed"),
                "gsm_sig": latest.get("gsm_sig"),
            })
        missingImeis = set(imei_list) - {item['imei'] for item in statuses}
        return (statuses, missingImeis)

    except Exception as e:
        print(f"Error in getVehicleStatus: {e}")
        return []

def getStopTimeToday(imei):
    try:
        utc_now = datetime.now(timezone('UTC'))
        start_of_day = utc_now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = utc_now.replace(hour=23, minute=59, second=59, microsecond=999999)
        pipeline = [
            {"$match": {
                "imei": {"$in": imei},
                "ignition": "0",
                "speed": "0.0",
                "date_time": {
                    "$gte": start_of_day,
                    "$lt": end_of_day
                },
            }},
            {"$sort": {"imei": 1, "date_time": 1}},
            {"$group": {
                "_id": "$imei",
                "stoppages": {"$push": "$date_time"}
            }},
            {"$project": {
                "imei": "$_id",
                "total_stoppage_seconds": {
                    "$reduce": {
                        "input": "$stoppages",
                        "initialValue": {"total": 0, "prev": None},
                        "in": {
                            "total": {
                                "$cond": [
                                    {"$eq": ["$$value.prev", None]},
                                    0,
                                    {"$add": [
                                        "$$value.total",
                                        {"$subtract": ["$$this", "$$value.prev"]}
                                    ]}
                                ]
                            },
                            "prev": "$$this"
                        }
                    }
                }
            }},
            {"$project": {
                "imei": 1,
                "total_stoppage_seconds": "$total_stoppage_seconds.total"
            }}
        ]

        result = list(atlanta_collection.aggregate(pipeline))
        
        missingImeis = set(imei) - {item['imei'] for item in result}
        
        pipeline = [
                {"$match": {
                    "imei": {"$in": missingImeis},
                    "timestamp": {"$gte": start_of_day, "$lt": end_of_day},
                    "telemetry.speed": {"$gt": 0},
                    "telemetry.ignition": 0
                }},
                {"$sort": {"imei": 1, "timestamp": -1}},
                {"$group": {
                    "_id": "$imei",
                    "timestamps": {"$push": "$timestamp"}
                }},
                {"$project": {
                    "imei": "$_id",
                    "timestamps": 1
                }},
                {"$project": {
                    "imei": 1,
                    "timestamps": 1
                }}
        ]

        distances = list(atlantaAis140_collection.aggregate(pipeline))

        for distance in distances:
            stoppageTime = timedelta(0)
            index = 0 
            for timestamp in distance['timestamps']:
                stoppageTime = stoppageTime + (distance['timestamps'][index] - distance['timestamps'][index + 1] if index + 1 < len(distance['timestamps']) else timedelta(0))
                index += 1
            result.append({"_id": distance['_id'], "imei": distance['imei'], "total_stoppage_seconds": int(stoppageTime.total_seconds())})
        
        for item in result:
            seconds = item.get('total_stoppage_seconds', 0)
            item['stoppage_time_str'] = format_seconds(seconds)

        return result

    except Exception as e:
        print(f"Error calculating stoppage times: {e}")
        return []

def getVehicleDistances(imei):
    try:
        utc_now = datetime.now(timezone('UTC'))
        start_of_day = utc_now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = utc_now.replace(hour=23, minute=59, second=59, microsecond=999999)
        pipeline = [
            {"$match": {
                "date_time": {
                    "$gte": start_of_day,
                    "$lt": end_of_day
                },
                "imei": {"$in":imei}
            }},
            {"$project": {  
                "imei": 1,
                "odometer": {"$toDouble": "$odometer"} 
            }},
            {"$group": {
                "_id": "$imei",
                "start_odometer": {"$min": "$odometer"},
                "end_odometer": {"$max": "$odometer"}
            }},
            {"$project": {
                "imei": "$_id",
                "distance_traveled": {"$subtract": ["$end_odometer", "$start_odometer"]}
            }}
        ]

        distances = list(atlanta_collection.aggregate(pipeline))

        missingImeis = set(imei) - {item['imei'] for item in distances}
        
        pipeline = [
            {"$match": {
                "imei": {"$in": missingImeis},
                "timestamp": {"$gte": start_of_day, "$lt": end_of_day}
            }},
            {"$sort": {"timestamp": -1}},
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
        
        distances_ais140 = list(atlantaAis140_collection.aggregate(pipeline))
        
        for distance in distances_ais140:
            first_odometer = float(distance.get('first_odometer', 0) or 0)
            last_odometer = float(distance.get('last_odometer', 0) or 0)
            distance_traveled = last_odometer - first_odometer
            distances.append({
                'imei': distance['imei'],
                'distance_traveled': distance_traveled
            })
        
        allDistances = {item['imei']: item['distance_traveled'] for item in distances}

        return allDistances
    except Exception as e:
        print(f"Error fetching distances for IMEI {imei}: {e}")
        flash("Error fetching distances", "danger")
        return jsonify({"error": str(e)}), 500

def build_vehicle_data(inventory_data, distances, stoppage_times, statuses, imei_list, missingImeis):
    vehicles = []

    inventory_lookup = {v.get('IMEI'): v for v in inventory_data}
    stoppage_lookup = {item['imei']: item for item in stoppage_times}
    status_lookup = {item['imei']: item for item in statuses}

    print("[DEBUG] Fetching Vehicle data from atlanta collection")
    vehicleData = atlantaLatest_collection.find({"_id": {"$in": imei_list}}, {"timestamp": 0})

    for imei in imei_list:
        data = atlantaAis140Latest_collection.find_one({"_id": imei})
        if data:
            vehicleData.append(atlantaAis140ToFront(data))

    print("[DEBUG] Fetched data from atlanta collection, processing data")
    
    for vehicle in vehicleData:
        imei = vehicle.get('imei')
        if not imei:
            continue

        inventory = inventory_lookup.get(imei, {})
        vehicle["LicensePlateNumber"] = inventory.get('LicensePlateNumber', 'Unknown')
        vehicle["VehicleType"] = inventory.get('VehicleType', 'Unknown')
        vehicle["slowSpeed"] =  float(inventory.get('slowSpeed', "0") or 40.0)
        vehicle["normalSpeed"] = float(inventory.get('normalSpeed', "0") or 60.0)
        
        vehicle["distance"] = round(distances.get(imei, 0), 2)

        stoppage_time_item = stoppage_lookup.get(imei, {})
        vehicle['stoppage_time'] = stoppage_time_item.get('stoppage_time_str', '0 seconds')
        vehicle['stoppage_time_delta'] = stoppage_time_item.get('total_stoppage_seconds', 0)

        if imei not in missingImeis:
            status_item = status_lookup.get(imei, {})
            vehicle['status'] = status_item.get('status', 'unknown')
            vehicle['status_time_str'] = status_item.get('status_time_str', '0 seconds')
            vehicle['status_time_delta'] = status_item.get('status_time_delta', 0)
            date = vehicle.get('date')
            time = vehicle.get('time')
            ignition = vehicle.get('ignition')
            speed = vehicle.get('speed')
            gsm_sig = vehicle.get('gsm_sig')
            vehicle['date'] = status_item.get('date', date)
            vehicle['time'] = status_item.get('time', time)
            vehicle['ignition'] = status_item.get('ignition', ignition)
            vehicle['speed'] = status_item.get('speed', speed)
            vehicle['gsm_sig'] = status_item.get('gsm_sig', gsm_sig)
        else:
            vehicle['status'] = 'offline'
            now = now = datetime.now(timezone('UTC')).timestamp() * 1000
            date_timeMs = vehicle.get('date_time').timestamp() * 1000
            status_time_delta = (now - date_timeMs)
            status_time_str = format_seconds(status_time_delta)
            vehicle['status_time_str'] = status_time_str
            vehicle['status_time_delta'] = status_time_delta
        
        vehicles.append(vehicle)
    return vehicles

@vehicle_bp.route('/api/vehicles', methods=['GET'])
@jwt_required()
@roles_required('admin', 'user', 'clientAdmin')
def get_vehicles():
    try:
        claims = get_jwt()
        user_roles = claims.get('roles', [])
        vehicles = []

        if 'admin' in user_roles:
            inventory_data = list(vehicle_inventory_collection.find())
        elif 'user' in user_roles:
            userID = claims.get('user_id')
            userCompany = claims.get('company')
            inventory_data = list(vehicle_inventory_collection.find({
                'CompanyName': userCompany,
                'AssignedUsers': ObjectId(userID),
            }))
        else:
            userCompany = claims.get('company')
            inventory_data = list(vehicle_inventory_collection.find({'CompanyName': userCompany}))

        imei_list = [vehicle.get('IMEI') for vehicle in inventory_data if vehicle.get('IMEI')]
        if not imei_list:
            return jsonify([]), 200

        distances = getVehicleDistances(imei_list)
        stoppage_times = getStopTimeToday(imei_list)
        print("Getting Vehicle statuses")
        statuses, missingImeis = getVehicleStatus(imei_list)

        print("Building vehicle data")
        vehicles = build_vehicle_data(inventory_data, distances, stoppage_times, statuses, imei_list, missingImeis)

        print("[DEBUG] Processed vehicle data")
        
        for vehicle in vehicles:
            vehicle['_id'] = str(vehicle['_id'])
            lat = vehicle.get('latitude')
            lng = vehicle.get('longitude')
            vehicle['location'] = geocodeInternal(lat, lng)

        return jsonify(vehicles), 200
    except Exception as e:
        print("Error fetching vehicle data:", e)
        return jsonify({'error': str(e)}), 500