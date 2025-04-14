from flask import Blueprint, render_template, request, jsonify
from pymongo import MongoClient
from datetime import datetime, timedelta
from pytz import timezone
import pytz
from app.database import db
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.geocoding import geocodeInternal
from bson import ObjectId

alerts_bp = Blueprint('Alerts', __name__, static_folder='static', template_folder='templates')

def nmea_to_decimal(nmea_value):
    if nmea_value.startswith('0'):
        nmea_value = nmea_value[1:]
    
    if len(nmea_value) >= 5:
        degrees = float(nmea_value[:-7])
        minutes = float(nmea_value[-7:])
    else:
        parts = nmea_value.split('.')
        degrees = float(parts[0][:-2])
        minutes = float(parts[0][-2:] + '.' + parts[1] if len(parts) > 1 else parts[0][-2:])
    
    decimal_degrees = degrees + (minutes / 60.0)
    return decimal_degrees

def get_alert_type(record):
    """Determine the alert type based on record data"""
    if record.get('sos') in ["1", 1, True] or record.get('status') == "SOS" or record.get('alarm') == "SOS":
        return "Panic Alert"
    elif float(record.get('speed', 0)) >= 60:
        return "Speeding Alert"
    elif record.get('harsh_break') == "1":
        return "Harsh Break Alert"
    elif record.get('harsh_speed') == "1":
        return "Harsh Acceleration Alert"
    elif record.get('internal_bat') == "1":
        return "Internal Battery Low Alert"
    elif record.get('main_power') == "0":
        return "Main Supply Remove Alert"
    elif record.get('door') == "1":
        return "Door Open Alert"
    elif record.get('door') == "0":
        return "Door Close Alert"
    elif record.get('speed') == "0.0" and record.get('ignition') == "1":
        return "Idle Alert"
    elif record.get('ignition') == "1":
        return "Ignition On Alert"
    elif record.get('ignition') == "0":
        return "Ignition Off Alert"
    return "Unknown Alert"

def get_alert_counts(start_date, end_date, vehicle_number=None):
    """Get counts of different alert types for the given date range"""
    # Get vehicle IMEI if vehicle number is specified
    imei = None
    if vehicle_number:
        vehicle = db['vehicle_inventory'].find_one(
            {"LicensePlateNumber": vehicle_number},
            {"IMEI": 1, "_id": 0}
        )
        if vehicle:
            imei = vehicle["IMEI"]
    
    # Base query with date range
    query = {
        "date_time": {
            "$gte": start_date,
            "$lte": end_date
        },
        "gps": "A"
    }
    
    if imei:
        query["imei"] = imei
    
    # Critical alerts (panic and speeding)
    critical_query = query.copy()
    critical_query["$or"] = [
        {"sos": {"$in": ["1", 1, True]}},
        {"status": "SOS"},
        {"alarm": "SOS"},
        {"speed": {"$gte": "60"}}
    ]
    critical_count = db['atlanta'].count_documents(critical_query)
    
    # Non-critical alerts (everything except panic and speeding)
    non_critical_query = query.copy()
    non_critical_query["$nor"] = [
        {"sos": {"$in": ["1", 1, True]}},
        {"status": "SOS"},
        {"alarm": "SOS"},
        {"speed": {"$gte": "60"}}
    ]
    non_critical_count = db['atlanta'].count_documents(non_critical_query)
    
    # Count for each alert type
    alert_types = {
        "panic": {
            "$or": [
                {"sos": {"$in": ["1", 1, True]}},
                {"status": "SOS"},
                {"alarm": "SOS"}
            ]
        },
        "speeding": {"speed": {"$gte": "60"}},
        "harsh_break": {"harsh_break": "1"},
        "harsh_acceleration": {"harsh_speed": "1"},
        "gsm_low": {"gsm_sig": "0"},
        "internal_battery_low": {"internal_bat": "1"},
        "external_battery_low": {"external_bat": "1"},
        "main_power_off": {"main_power": "0"},
        "door_open": {"door": "1"},
        "door_close": {"door": "0"},
        "idle": {"$and": [{"speed": "0.0"}, {"ignition": "1"}]},
        "ignition_off": {"ignition": "0"},
        "ignition_on": {"ignition": "1"}
    }
    
    type_counts = {}
    for alert_type, condition in alert_types.items():
        type_query = query.copy()
        type_query.update(condition)
        type_counts[alert_type] = db['atlanta'].count_documents(type_query)
    
    return {
        "critical": critical_count,
        "non_critical": non_critical_count,
        "all": critical_count + non_critical_count,
        "type_counts": type_counts
    }

@alerts_bp.route('/')
@jwt_required()
def page():
    vehicles = list(db['vehicle_inventory'].find({}, {"LicensePlateNumber": 1, "_id": 0}))
    now = datetime.now()
    default_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    default_end = now.replace(hour=23, minute=59, second=59, microsecond=0)
    return render_template('alerts.html', 
                         vehicles=vehicles,
                         default_start_date=default_start.strftime('%Y-%m-%dT%H:%M'),
                         default_end_date=default_end.strftime('%Y-%m-%dT%H:%M'))

@alerts_bp.route('/get_alerts', methods=['POST'])
@jwt_required()
def get_alerts():
    try:
        data = request.get_json()
        alert_type = data.get("alertType", "all")
        start_date = datetime.fromisoformat(data.get("startDate"))
        end_date = datetime.fromisoformat(data.get("endDate"))
        vehicle_number = data.get("vehicleNumber")
        only_critical = data.get("onlyCritical", False)
        only_non_critical = data.get("onlyNonCritical", False)
        
        # Convert to UTC
        tz = pytz.timezone('UTC')
        start_date = start_date.astimezone(tz)
        end_date = end_date.astimezone(tz)
        
        # Get vehicle IMEI if vehicle number is specified
        imei = None
        if vehicle_number:
            vehicle = db['vehicle_inventory'].find_one(
                {"LicensePlateNumber": vehicle_number},
                {"IMEI": 1, "LicensePlateNumber": 1, "DriverName": 1, "_id": 0}
            )
            if not vehicle:
                return jsonify({"success": False, "message": "Vehicle not found"}), 404
            imei = vehicle["IMEI"]
        
        # Base query with date range
        query = {
            "date_time": {
                "$gte": start_date,
                "$lte": end_date
            },
            "gps": "A"
        }
        
        if imei:
            query["imei"] = imei
        
        if only_critical:
            query["$or"] = [
                {"sos": {"$in": ["1", 1, True]}},
                {"status": "SOS"},
                {"alarm": "SOS"},
                {"speed": {"$gte": "60"}}
            ]
        elif only_non_critical:
            query["$nor"] = [
                {"sos": {"$in": ["1", 1, True]}},
                {"status": "SOS"},
                {"alarm": "SOS"},
                {"speed": {"$gte": "60"}}
            ]
        elif alert_type != "all":
            # Handle specific alert type
            alert_conditions = {
                "panic": {
                    "$or": [
                        {"sos": {"$in": ["1", 1, True]}},
                        {"status": "SOS"},
                        {"alarm": "SOS"}
                    ]
                },
                "speeding": {"speed": {"$gte": "60"}},
                "harsh_break": {"harsh_break": "1"},
                "harsh_acceleration": {"harsh_speed": "1"},
                "gsm_low": {"gsm_sig": "0"},
                "internal_battery_low": {"internal_bat": "1"},
                "external_battery_low": {"external_bat": "1"},
                "main_power_off": {"main_power": "0"},
                "door_open": {"door": "1"},
                "door_close": {"door": "0"},
                "idle": {"$and": [{"speed": "0.0"}, {"ignition": "1"}]},
                "ignition_off": {"ignition": "0"},
                "ignition_on": {"ignition": "1"}
            }
            if alert_type in alert_conditions:
                query.update(alert_conditions[alert_type])
        
        # Fetch data
        records = list(db['atlanta'].find(
            query,
            {
                "date_time": 1,
                "latitude": 1,
                "longitude": 1,
                "imei": 1,
                "speed": 1,
                "ignition": 1,
                "sos": 1,
                "harsh_break": 1,
                "harsh_speed": 1,
                "main_power": 1,
                "door": 1,
                "internal_bat": 1,
                "external_bat": 1,
                "gsm_sig": 1,
                "_id": 1
            }
        ).sort("date_time", -1).limit(50))
        
        # Process the records
        alerts = []
        for record in records:
            # Get vehicle details
            vehicle = db['vehicle_inventory'].find_one(
                {"IMEI": record["imei"]},
                {"LicensePlateNumber": 1, "DriverName": 1, "_id": 0}
            )
            
            # Convert coordinates
            latitude = nmea_to_decimal(record["latitude"]) if "latitude" in record and record["latitude"] else None
            longitude = nmea_to_decimal(record["longitude"]) if "longitude" in record and record["longitude"] else None
            
            # Get location from geocoding
            location = None
            if latitude and longitude:
                location = geocodeInternal(latitude, longitude)
            
            # Determine alert type
            alert_type_detected = get_alert_type(record)
            
            # Check if alert is acknowledged
            acknowledged = db['Ack_alerts'].find_one({"alert_id": str(record["_id"])}) is not None
            
            alerts.append({
                "_id": str(record["_id"]),
                "vehicle_number": vehicle["LicensePlateNumber"] if vehicle else "Unknown",
                "driver": vehicle["DriverName"] if vehicle and "DriverName" in vehicle else "N/A",
                "date_time": record["date_time"],
                "alert_type": alert_type_detected,
                "latitude": latitude,
                "longitude": longitude,
                "location": location,
                "acknowledged": acknowledged
            })
            
            counts = get_alert_counts(start_date, end_date, vehicle_number)
        
        return jsonify({
            "success": True,
            "alerts": alerts,
            "counts": counts
        })
        
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@alerts_bp.route('/acknowledge', methods=['POST'])
@jwt_required()
def acknowledge_alert():
    try:
        data = request.get_json()
        alert_id = data.get("alertId")
        pressed_for = data.get("pressedFor")
        reason = data.get("reason", "")
        user_id = get_jwt_identity()
        
        if not alert_id or not pressed_for:
            return jsonify({"success": False, "message": "Missing required fields"}), 400
        
        # Save acknowledgment
        db['Ack_alerts'].insert_one({
            "alert_id": alert_id,
            "pressed_for": pressed_for,
            "reason": reason,
            "acknowledged_by": user_id,
            "acknowledged_at": datetime.now()
        })
        
        return jsonify({
            "success": True,
            "message": "Alert acknowledged successfully"
        })
        
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500