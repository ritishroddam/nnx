from flask import Blueprint, render_template, request, jsonify
from pymongo import MongoClient
from datetime import datetime, timedelta
from pytz import timezone
import pytz
from app.database import db
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.geocoding import geocodeInternal
from bson import ObjectId
from functools import wraps

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
    elif record.get('internal_bat') == "0.0" or float(record.get('internal_bat', 3.7)) < 3.7:
        return "Internal Battery Low Alert"
    elif record.get('main_power') == "0":
        return "Main Supply Remove Alert"
    elif record.get('speed') == "0.0" and record.get('ignition') == "1":
        return "Idle Alert"
    elif record.get('ignition') == "1":
        return "Ignition On Alert"
    elif record.get('ignition') == "0":
        return "Ignition Off Alert"
    elif record.get('gsm_sig') == "0" or (record.get('gsm_sig') and int(record.get('gsm_sig')) < 7):
        return "GSM Signal Low Alert"
    return "Unknown Alert"

def alert_card_endpoint(alert_type):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            data = request.get_json()
            start_date = data.get("startDate")
            end_date = data.get("endDate")
            vehicle_number = data.get("vehicleNumber")
            
            # Convert to datetime objects
            start_date = datetime.fromisoformat(start_date)
            end_date = datetime.fromisoformat(end_date)
            
            # Convert to UTC
            tz = pytz.timezone('UTC')
            start_date = start_date.astimezone(tz)
            end_date = end_date.astimezone(tz)
            
            # Get vehicle IMEI if specified
            imei = None
            if vehicle_number:
                vehicle = db['vehicle_inventory'].find_one(
                    {"LicensePlateNumber": vehicle_number},
                    {"IMEI": 1, "_id": 0}
                )
                if vehicle:
                    imei = vehicle["IMEI"]
            
            # Base query
            query = {
                "date_time": {
                    "$gte": start_date,
                    "$lte": end_date
                },
                "gps": "A"
            }
            
            if imei:
                query["imei"] = imei
            
            # Specific alert type conditions
            alert_conditions = {
                "critical": {
                    "$or": [
                        {"sos": {"$in": ["1", 1, True]}},
                        {"status": "SOS"},
                        {"alarm": "SOS"},
                        {"speed": {"$gte": 60}}
                    ]
                },
                "non_critical": {
                    "$and": [
                        {"sos": {"$nin": ["1", 1, True]}},
                        {"status": {"$ne": "SOS"}},
                        {"alarm": {"$ne": "SOS"}},
                        {"speed": {"$lt": 60}}
                    ]
                },
                "panic": {
                    "$or": [
                        {"sos": {"$in": ["1", 1, True]}},
                        {"status": "SOS"},
                        {"alarm": "SOS"}
                    ]
                },
                "speeding": {"speed": {"$gte": 60}},
                "harsh_break": {"harsh_break": "1"},
                "harsh_acceleration": {"harsh_speed": "1"},
                "gsm_low": {
                    "$or": [
                        {"gsm_sig": "0"},
                        {"gsm_sig": {"$lt": "7"}}
                    ]
                },
                "internal_battery_low": {
                    "$or": [
                        {"internal_bat": "0.0"},
                        {"internal_bat": {"$lt": "3.7"}}
                    ]
                },
                "main_power_off": {"main_power": "0"},
                "idle": {"$and": [{"speed": "0.0"}, {"ignition": "1"}]},
                "ignition_off": {"ignition": "0"},
                "ignition_on": {"ignition": "1"}
            }
            
            if alert_type in alert_conditions:
                if alert_type == 'internal_battery_low':
                    query['$or'] = [
                        {'internal_bat': '0.0'},
                        {'internal_bat': {'$lt': '3.7'}}
                    ]
                elif alert_type == 'gsm_low':
                    query['$or'] = [
                        {'gsm_sig': '0'},
                        {'gsm_sig': {'$lt': '7'}}
                    ]
                else:
                    query.update(alert_conditions[alert_type])
            
            # Get count
            count = db['atlanta'].count_documents(query)
            
            # Get records if needed
            records = []
            if request.endpoint.endswith('_alerts'):
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
                        "internal_bat": 1,
                        "gsm_sig": 1,
                        "_id": 1
                    }
                ).sort("date_time", -1).limit(50))
                
                processed_records = []
                for record in records:
                    vehicle = db['vehicle_inventory'].find_one(
                        {"IMEI": record["imei"]},
                        {"LicensePlateNumber": 1, "DriverName": 1, "_id": 0}
                    )
                    
                    latitude = nmea_to_decimal(record["latitude"]) if "latitude" in record and record["latitude"] else None
                    longitude = nmea_to_decimal(record["longitude"]) if "longitude" in record and record["longitude"] else None
                    
                    location = None
                    if latitude and longitude:
                        location = geocodeInternal(latitude, longitude)
                    
                    alert_type_detected = get_alert_type(record)
                    acknowledged = db['Ack_alerts'].find_one({"alert_id": str(record["_id"])}) is not None
                    
                    processed_records.append({
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
            
            if request.endpoint.endswith('_count'):
                return jsonify({"success": True, "count": count})
            else:
                return jsonify({"success": True, "alerts": processed_records, "count": count})
        return wrapper
    return decorator

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

@alerts_bp.route('/critical_count', methods=['POST'])
@jwt_required()
@alert_card_endpoint("critical")
def critical_count():
    pass

@alerts_bp.route('/non_critical_count', methods=['POST'])
@jwt_required()
@alert_card_endpoint("non_critical")
def non_critical_count():
    pass

@alerts_bp.route('/panic_count', methods=['POST'])
@jwt_required()
@alert_card_endpoint("panic")
def panic_count():
    pass

@alerts_bp.route('/speeding_count', methods=['POST'])
@jwt_required()
@alert_card_endpoint("speeding")
def speeding_count():
    pass

@alerts_bp.route('/harsh_break_count', methods=['POST'])
@jwt_required()
@alert_card_endpoint("harsh_break")
def harsh_break_count():
    pass

@alerts_bp.route('/harsh_acceleration_count', methods=['POST'])
@jwt_required()
@alert_card_endpoint("harsh_acceleration")
def harsh_acceleration_count():
    pass

@alerts_bp.route('/gsm_low_count', methods=['POST'])
@jwt_required()
@alert_card_endpoint("gsm_low")
def gsm_low_count():
    pass

@alerts_bp.route('/internal_battery_low_count', methods=['POST'])
@jwt_required()
@alert_card_endpoint("internal_battery_low")
def internal_battery_low_count():
    pass

@alerts_bp.route('/external_battery_low_count', methods=['POST'])
@jwt_required()
@alert_card_endpoint("external_battery_low")
def external_battery_low_count():
    pass

@alerts_bp.route('/main_power_off_count', methods=['POST'])
@jwt_required()
@alert_card_endpoint("main_power_off")
def main_power_off_count():
    pass

@alerts_bp.route('/idle_count', methods=['POST'])
@jwt_required()
@alert_card_endpoint("idle")
def idle_count():
    pass

@alerts_bp.route('/ignition_off_count', methods=['POST'])
@jwt_required()
@alert_card_endpoint("ignition_off")
def ignition_off_count():
    pass

@alerts_bp.route('/ignition_on_count', methods=['POST'])
@jwt_required()
@alert_card_endpoint("ignition_on")
def ignition_on_count():
    pass

@alerts_bp.route('/critical_alerts', methods=['POST'])
@jwt_required()
@alert_card_endpoint("critical")
def critical_alerts():
    pass

@alerts_bp.route('/non_critical_alerts', methods=['POST'])
@jwt_required()
@alert_card_endpoint("non_critical")
def non_critical_alerts():
    pass

@alerts_bp.route('/panic_alerts', methods=['POST'])
@jwt_required()
@alert_card_endpoint("panic")
def panic_alerts():
    pass

@alerts_bp.route('/speeding_alerts', methods=['POST'])
@jwt_required()
@alert_card_endpoint("speeding")
def speeding_alerts():
    pass

@alerts_bp.route('/harsh_break_alerts', methods=['POST'])
@jwt_required()
@alert_card_endpoint("harsh_break")
def harsh_break_alerts():
    pass

@alerts_bp.route('/harsh_acceleration_alerts', methods=['POST'])
@jwt_required()
@alert_card_endpoint("harsh_acceleration")
def harsh_acceleration_alerts():
    pass

@alerts_bp.route('/gsm_low_alerts', methods=['POST'])
@jwt_required()
@alert_card_endpoint("gsm_low")
def gsm_low_alerts():
    pass

@alerts_bp.route('/internal_battery_low_alerts', methods=['POST'])
@jwt_required()
@alert_card_endpoint("internal_battery_low")
def internal_battery_low_alerts():
    pass

@alerts_bp.route('/external_battery_low_alerts', methods=['POST'])
@jwt_required()
@alert_card_endpoint("external_battery_low")
def external_battery_low_alerts():
    pass

@alerts_bp.route('/main_power_off_alerts', methods=['POST'])
@jwt_required()
@alert_card_endpoint("main_power_off")
def main_power_off_alerts():
    pass

@alerts_bp.route('/idle_alerts', methods=['POST'])
@jwt_required()
@alert_card_endpoint("idle")
def idle_alerts():
    pass

@alerts_bp.route('/ignition_off_alerts', methods=['POST'])
@jwt_required()
@alert_card_endpoint("ignition_off")
def ignition_off_alerts():
    pass

@alerts_bp.route('/ignition_on_alerts', methods=['POST'])
@jwt_required()
@alert_card_endpoint("ignition_on")
def ignition_on_alerts():
    pass

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
        
        # Check if alert exists and not already acknowledged
        alert = db['atlanta'].find_one({"_id": ObjectId(alert_id)})
        if not alert:
            return jsonify({"success": False, "message": "Alert not found"}), 404
            
        existing_ack = db['Ack_alerts'].find_one({"alert_id": alert_id})
        if existing_ack:
            return jsonify({"success": False, "message": "Alert already acknowledged"}), 400
        
        # Save acknowledgment
        result = db['Ack_alerts'].insert_one({
            "alert_id": alert_id,
            "pressed_for": pressed_for,
            "reason": reason,
            "acknowledged_by": user_id,
            "acknowledged_at": datetime.now(pytz.utc),
            "alert_data": alert
        })
        
        if not result.inserted_id:
            return jsonify({"success": False, "message": "Failed to save acknowledgment"}), 500
        
        return jsonify({
            "success": True,
            "message": "Alert acknowledged successfully"
        })
        
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500