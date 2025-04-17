from flask import Blueprint, render_template, request, jsonify, url_for
from pymongo import MongoClient
from datetime import datetime, timedelta
from pytz import timezone
import pytz
from app.database import db
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.geocoding import geocodeInternal
from bson import ObjectId
from functools import wraps
from flask_socketio import SocketIO, emit

alerts_bp = Blueprint('Alerts', __name__, static_folder='static', template_folder='templates')
socketio = SocketIO()

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
    elif float(record.get('speed', 0.0)) >= 60:
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
    elif record.get('ignition') == "1" and record.get('speed') != "0.0":
        return "Ignition On Alert"
    elif record.get('ignition') == "0":
        return "Ignition Off Alert"
    elif record.get('gsm_sig') == "0" or (record.get('gsm_sig') and int(float(record.get('gsm_sig'))) < 7):
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
            page = data.get("page", 1)
            per_page = data.get("per_page", 10)
            
            # Convert to datetime objects
            start_date = datetime.fromisoformat(start_date) if start_date else datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            end_date = datetime.fromisoformat(end_date) if end_date else datetime.now()
            
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
            
            # Special handling for panic alerts (from sos_logs)
            if alert_type == "panic":
                panic_query = {
                    "date_time": {
                        "$gte": start_date,
                        "$lte": end_date
                    }
                }
                if imei:
                    panic_query["imei"] = imei
                
                count = db['sos_logs'].count_documents(panic_query)
                
                if request.endpoint.endswith('_alerts'):
                    if alert_type == "panic":
                        records = list(db['sos_logs'].find(
                            panic_query,
                            {
                                "date_time": 1,
                                "latitude": 1,
                                "longitude": 1,
                                "imei": 1,
                                "speed": 1,
                                "ignition": 1,
                                "sos": 1,
                                "_id": 1
                            }
                        ).sort("date_time", -1).skip((page - 1) * per_page).limit(per_page))
                    else:
                        records = list(db['atlanta'].find(
                            query,
                            projection
                        ).sort("date_time", -1).skip((page - 1) * per_page).limit(per_page))
            else:
                # Base query for all other alerts (from atlanta collection)
                query = {
                    "date_time": {
                        "$gte": start_date,
                        "$lte": end_date
                    },
                    "gps": "A"
                }
                
                if imei:
                    query["imei"] = imei
                
                # Add specific conditions for each alert type
                elif alert_type == "speeding":
                    query["$expr"] = {
                        "$gte": [
                            {"$toDouble": {"$ifNull": ["$speed", 0]}},
                            60
                        ]
                    }
                    projection = {
                        "date_time": 1,
                        "latitude": 1,
                        "longitude": 1,
                        "imei": 1,
                        "speed": 1,
                        "_id": 1
                    }
                elif alert_type == "harsh_break":
                    query["harsh_break"] = "1"
                    projection = {
                        "date_time": 1,
                        "latitude": 1,
                        "longitude": 1,
                        "imei": 1,
                        "harsh_break": 1,
                        "_id": 1
                    }
                elif alert_type == "harsh_acceleration":
                    query["harsh_speed"] = "1"
                    projection = {
                        "date_time": 1,
                        "latitude": 1,
                        "longitude": 1,
                        "imei": 1,
                        "harsh_speed": 1,
                        "_id": 1
                    }
                elif alert_type == "gsm_low":
                    query["$or"] = [
                        {"gsm_sig": "0"},
                        {"$expr": {
                            "$lt": [
                                {"$toInt": {"$ifNull": [{"$toInt": "$gsm_sig"}, 99]}}, 
                                7
                            ]
                        }}
                    ]
                    projection = {
                        "date_time": 1,
                        "latitude": 1,
                        "longitude": 1,
                        "imei": 1,
                        "gsm_sig": 1,
                        "_id": 1
                    }
                elif alert_type == "internal_battery_low":
                    query["$or"] = [
                        {"internal_bat": "0.0"},
                        {"internal_bat": {"$lt": "3.7"}}
                    ]
                    projection = {
                        "date_time": 1,
                        "latitude": 1,
                        "longitude": 1,
                        "imei": 1,
                        "internal_bat": 1,
                        "_id": 1
                    }
                elif alert_type == "main_power_off":
                    query["main_power"] = "0"
                    projection = {
                        "date_time": 1,
                        "latitude": 1,
                        "longitude": 1,
                        "imei": 1,
                        "main_power": 1,
                        "_id": 1
                    }
                elif alert_type == "idle":
                    query["$and"] = [
                        {"speed": "0.0"},
                        {"ignition": "1"}
                    ]
                    projection = {
                        "date_time": 1,
                        "latitude": 1,
                        "longitude": 1,
                        "imei": 1,
                        "speed": 1,
                        "ignition": 1,
                        "_id": 1
                    }
                elif alert_type == "ignition_off":
                    query["ignition"] = "0"
                    projection = {
                        "date_time": 1,
                        "latitude": 1,
                        "longitude": 1,
                        "imei": 1,
                        "ignition": 1,
                        "_id": 1
                    }
                elif alert_type == "ignition_on":
                    query["$and"] = [
                        {"ignition": "1"},
                        {"speed": {"$ne": "0.0"}}
                    ]
                    projection = {
                        "date_time": 1,
                        "latitude": 1,
                        "longitude": 1,
                        "imei": 1,
                        "ignition": 1,
                        "speed": 1,
                        "_id": 1
                    }
                
                count = db['atlanta'].count_documents(query)
                
                if request.endpoint.endswith('_alerts'):
                    records = list(db['atlanta'].find(
                        query,
                        projection
                    ).sort("date_time", -1).skip((page - 1) * per_page).limit(per_page))
                else:
                    records = []
            
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
                return jsonify({
                    "success": True, 
                    "alerts": processed_records, 
                    "count": count,
                    "page": page,
                    "per_page": per_page,
                    "total_pages": (count // per_page) + (1 if count % per_page > 0 else 0)
                })
        return wrapper
    return decorator

# WebSocket Events
@socketio.on('connect')
def handle_connect():
    print('Client connected')
    emit('connected', {'data': 'Connected to alerts updates'})

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

@socketio.on('join_alerts')
def handle_join_alerts():
    print('Client joined alerts room')
    emit('alerts_joined', {'data': 'Joined alerts updates'})

def broadcast_new_alert(alert_data):
    socketio.emit('new_alert', {
        'alert': alert_data,
        'timestamp': datetime.now(pytz.utc).isoformat()
    })

def broadcast_alert_update(alert_id, action, user_id):
    socketio.emit('alert_updated', {
        'alert_id': alert_id,
        'action': action,
        'by': user_id,
        'timestamp': datetime.now(pytz.utc).isoformat()
    })

@alerts_bp.route('/')
@jwt_required()
def page():
    vehicles = list(db['vehicle_inventory'].find({}, {"LicensePlateNumber": 1, "_id": 0}))
    now = datetime.now()
    default_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    default_end = now
    
    return render_template('alerts.html', 
                         vehicles=vehicles,
                         default_start_date=default_start.strftime('%Y-%m-%dT%H:%M'),
                         default_end_date=default_end.strftime('%Y-%m-%dT%H:%M'))

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
            alert = db['sos_logs'].find_one({"_id": ObjectId(alert_id)})
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
        
        # Broadcast the update
        broadcast_alert_update(alert_id, 'acknowledged', user_id)
        
        return jsonify({
            "success": True,
            "message": "Alert acknowledged successfully",
            "redirect": url_for('.page')
        })
        
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

def init_socketio(app):
    socketio.init_app(app)