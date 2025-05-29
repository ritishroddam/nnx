from flask import Blueprint, render_template, request, jsonify, url_for # type: ignore
from pymongo import MongoClient # type: ignore
from datetime import datetime, timedelta
from pytz import timezone # type: ignore
import pytz # type: ignore
from app.database import db # type: ignore
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt # type: ignore
from app.geocoding import geocodeInternal # type: ignore
from bson import ObjectId # type: ignore
from functools import wraps
from app.utils import roles_required, get_filtered_results # type: ignore

alerts_bp = Blueprint('Alerts', __name__, static_folder='static', template_folder='templates')

def get_alert_type(record):
    if record.get('source') == 'sos_logs':
        return "Panic Alert"
    if record.get('sos') in ["1", 1, True] or record.get('status') == "SOS" or record.get('alarm') == "SOS":
        return "Panic Alert"
    if float(record.get('speed', 0.0)) >= 60:
        return f"Speeding Alert ({float(record.get('speed', 0.0))} km/h)"
    if record.get('harsh_break') == "1":
        return "Harsh Break Alert"
    if record.get('harsh_speed') == "1":
        return "Harsh Acceleration Alert"
    if record.get('internal_bat') == "0.0" or float(record.get('internal_bat', 3.7)) < 3.7:
        return "Internal Battery Low Alert"
    if record.get('main_power') == "0":
        return "Main Supply Remove Alert"
    if record.get('speed') == "0.0" and record.get('ignition') == "1":
        return "Idle Alert"
    if record.get('ignition') == "1" and record.get('speed') != "0.0":
        return "Ignition On Alert"
    if record.get('ignition') == "0":
        return "Ignition Off Alert"
    if record.get('gsm_sig') == "0" or (record.get('gsm_sig') and int(float(record.get('gsm_sig'))) < 7):
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
            per_page = data.get("per_page", 100)

            start_date = datetime.fromisoformat(start_date) if start_date else datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            end_date = datetime.fromisoformat(end_date) if end_date else datetime.now()

            if not vehicle_number: 
                max_allowed_end = start_date + timedelta(hours=24)
                if end_date > max_allowed_end:
                    end_date = max_allowed_end
            else: 
                max_allowed_start = end_date - timedelta(days=30)
                if start_date < max_allowed_start:
                    start_date = max_allowed_start

            tz = pytz.timezone('UTC')
            start_date = start_date.astimezone(tz)
            end_date = end_date.astimezone(tz)

            imei = None
            if vehicle_number:
                vehicle = db['vehicle_inventory'].find_one(
                    {"LicensePlateNumber": vehicle_number},
                    {"IMEI": 1, "_id": 0}
                )
                if vehicle:
                    imei = vehicle["IMEI"]
            else:
                claims = get_jwt()
                user_roles = claims.get('roles', [])
                userID = claims.get('user_id')
                userCompany = claims.get('company')
                vehicle_inventory = db["vehicle_inventory"]

                if 'admin' in user_roles:
                    imeis = list((vehicle_inventory.find({},{"IMEI": 1, "_id": 0})).distinct("IMEI"))
                elif 'user' in user_roles:
                    imeis = list((vehicle_inventory.find({
                        'CompanyName': userCompany,
                        'AssignedUsers': {'$in': [userID]}
                    },{"IMEI": 1, "_id": 0})).distinct("IMEI"))
                else:
                    imeis = list((vehicle_inventory.find({'CompanyName': userCompany}, {"IMEI": 1, "_id": 0})).distinct("IMEI"))

            base_projection = {
                "date_time": 1,
                "latitude": 1,
                "longitude": 1,
                "imei": 1,
                "_id": 1
            }

            if alert_type == "panic":
                panic_query = {
                    "date_time": {
                        "$gte": start_date,
                        "$lte": end_date
                    },
                    "latitude": {"$exists": True, "$ne": None, "$ne": ""},
                    "longitude": {"$exists": True, "$ne": None, "$ne": ""}
                }
                if vehicle_number:
                    if imei:
                        panic_query["imei"] = imei
                else:
                    if imeis:
                        panic_query["imei"] = {"$in": imeis}
                
                count = db['sos_logs'].count_documents(panic_query)
                
                if request.endpoint.endswith('_alerts'):
                    records = list(db['sos_logs'].find(
                        panic_query,
                        {
                            **base_projection,
                            "speed": 1,
                            "ignition": 1,
                            "sos": 1
                        }
                    ).sort("date_time", -1))
                    for rec in records:
                        rec['source'] = 'sos_logs'
            else:
                query = {
                    "date_time": {
                        "$gte": start_date,
                        "$lte": end_date
                    },
                    "gps": "A",
                    "latitude": {"$exists": True, "$ne": None, "$ne": ""},
                    "longitude": {"$exists": True, "$ne": None, "$ne": ""}
                }
                
                if vehicle_number:
                    if imei:
                        query["imei"] = imei
                else:
                    if imeis:
                        query["imei"] = {"$in": imeis}

                if alert_type == "speeding":
                    query["$expr"] = {
                        "$gte": [
                            {"$toDouble": {"$ifNull": ["$speed", 0]}},
                            60
                        ]
                    }
                    projection = {
                        **base_projection,
                        "speed": 1
                    }
                elif alert_type == "harsh_break":
                    query["harsh_break"] = "1"
                    projection = {
                        **base_projection,
                        "harsh_break": 1
                    }
                elif alert_type == "harsh_acceleration":
                    query["harsh_speed"] = "1"
                    projection = {
                        **base_projection,
                        "harsh_speed": 1
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
                        **base_projection,
                        "gsm_sig": 1
                    }
                elif alert_type == "internal_battery_low":
                    query["$or"] = [
                        {"internal_bat": "0.0"},
                        {"internal_bat": {"$lt": "3.7"}}
                    ]
                    projection = {
                        **base_projection,
                        "internal_bat": 1
                    }
                elif alert_type == "main_power_off":
                    query["main_power"] = "0"
                    projection = {
                        **base_projection,
                        "main_power": 1
                    }
                elif alert_type == "idle":
                    query["$and"] = [
                        {"speed": "0.0"},
                        {"ignition": "1"}
                    ]
                    projection = {
                        **base_projection,
                        "speed": 1,
                        "ignition": 1
                    }
                elif alert_type == "ignition_off":
                    query["ignition"] = "0"
                    projection = {
                        **base_projection,
                        "ignition": 1
                    }
                elif alert_type == "ignition_on":
                    query["$and"] = [
                        {"ignition": "1"},
                        {"speed": {"$ne": "0.0"}}
                    ]
                    projection = {
                        **base_projection,
                        "ignition": 1,
                        "speed": 1
                    }
                else:
                    projection = base_projection
                
                count = db['atlanta'].count_documents(query)
                
                if request.endpoint.endswith('_alerts'):
                    records = list(db['atlanta'].find(
                        query,
                        projection
                    ).sort("date_time", -1))
                else:
                    records = []
            
            processed_records = []
            for record in records:
                if not record.get("latitude") or not record.get("longitude"):
                    continue
                try:
                    latitude = record["latitude"]
                    longitude = record["longitude"]
                    
                    if latitude is None or longitude is None:
                        continue
                    
                    vehicle = db['vehicle_inventory'].find_one(
                        {"IMEI": record["imei"]},
                        {"LicensePlateNumber": 1, "DriverName": 1, "_id": 0}
                    )
                    
                    location = geocodeInternal(latitude, longitude)
                
                    alert_type_detected = get_alert_type(record)
                    acknowledged = db['Ack_alerts'].find_one({"alert_id": str(record["_id"])}) is not None
                    
                    processed_records.append({
                        "_id": str(record["_id"]),
                        "vehicle_number": vehicle["LicensePlateNumber"] if vehicle else "Unknown",
                        "driver": vehicle["DriverName"] if vehicle and "DriverName" in vehicle else "N/A",
                        "date_time": record["date_time"],
                        "alert_type": alert_type_detected,
                        "speed": float(record.get("speed", 0.0)) if alert_type == "speeding" else None,
                        "latitude": latitude,
                        "longitude": longitude,
                        "location": location,
                        "acknowledged": acknowledged
                    })
                except Exception as e:
                    print(f"Error processing record: {e}")
                    continue
                
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

@alerts_bp.route('/notification_alerts', methods=['GET'])
@jwt_required()
def notification_alerts():
    from datetime import datetime, timedelta
    import pytz

    tz = pytz.timezone('UTC')
    now = datetime.now(tz)
    start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_day = now.replace(hour=23, minute=59, second=59, microsecond=999999)

    # Only unacknowledged alerts
    acknowledged_ids = set(
        ack['alert_id'] for ack in db['Ack_alerts'].find({}, {'alert_id': 1})
    )

    # Panic Alerts
    panic_alerts = list(db['sos_logs'].find({
        "date_time": {"$gte": start_of_day, "$lte": end_of_day},
        "latitude": {"$exists": True, "$ne": None, "$ne": ""},
        "longitude": {"$exists": True, "$ne": None, "$ne": ""}
    }, {"_id": 1, "date_time": 1, "imei": 1}).sort("date_time", -1))

    # Speeding Alerts
    speeding_alerts = list(db['atlanta'].find({
        "date_time": {"$gte": start_of_day, "$lte": end_of_day},
        "gps": "A",
        "latitude": {"$exists": True, "$ne": None, "$ne": ""},
        "longitude": {"$exists": True, "$ne": None, "$ne": ""},
        "$expr": {"$gte": [{"$toDouble": {"$ifNull": ["$speed", 0]}}, 60]}
    }, {"_id": 1, "date_time": 1, "imei": 1}).sort("date_time", -1))

    # Main Power Discontinue Alerts
    main_power_alerts = list(db['atlanta'].find({
        "date_time": {"$gte": start_of_day, "$lte": end_of_day},
        "gps": "A",
        "latitude": {"$exists": True, "$ne": None, "$ne": ""},
        "longitude": {"$exists": True, "$ne": None, "$ne": ""},
        "main_power": "0"
    }, {"_id": 1, "date_time": 1, "imei": 1}).sort("date_time", -1))

    def enrich(alerts, alert_type):
        enriched = []
        for alert in alerts:
            if str(alert["_id"]) in acknowledged_ids:
                continue
            vehicle = db['vehicle_inventory'].find_one(
                {"IMEI": alert.get("imei")},
                {"LicensePlateNumber": 1, "_id": 0}
            )
            enriched.append({
                "id": str(alert["_id"]),
                "type": alert_type,
                "alert_type": alert_type,  # <-- Add this line
                "vehicle": vehicle["LicensePlateNumber"] if vehicle else "Unknown",
                "vehicle_number": vehicle["LicensePlateNumber"] if vehicle else "Unknown",  # for frontend
                "date_time": alert["date_time"].isoformat() if alert.get("date_time") else "",
                "acknowledged": False  # or set based on your logic
            })
        return enriched

    notifications = (
        enrich(panic_alerts, "Panic Alert") +
        enrich(speeding_alerts, "Speeding Alert") +
        enrich(main_power_alerts, "Main Power Discontinue Alert")
    )

    notifications.sort(key=lambda x: x["date_time"], reverse=True)

    return jsonify({
        "success": True,
        "count": len(notifications),
        "alerts": notifications
    })

@alerts_bp.route('/')
@jwt_required()
def page():
    imeis = list(get_filtered_results("atlanta").distinct("imei"))
    vehicles = list(db['vehicle_inventory'].find({"IMEI": {"$in": imeis}}, {"LicensePlateNumber": 1, "_id": 0}))
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
        if not data:
            return jsonify({"success": False, "message": "No data provided"}), 400

        alert_id = data.get("alertId")
        pressed_for = data.get("pressedFor")
        reason = data.get("reason", "")
        user_id = get_jwt_identity()

        if not alert_id or not pressed_for:
            return jsonify({"success": False, "message": "Missing required fields"}), 400

        alert = db['atlanta'].find_one({"_id": ObjectId(alert_id)})
        if not alert:
            alert = db['sos_logs'].find_one({"_id": ObjectId(alert_id)})
            if not alert:
                return jsonify({"success": False, "message": "Alert not found"}), 404

        existing_ack = db['Ack_alerts'].find_one({"alert_id": alert_id})
        if existing_ack:
            return jsonify({"success": False, "message": "Alert already acknowledged"}), 400

        ack_data = {
            "alert_id": alert_id,
            "pressed_for": pressed_for,
            "reason": reason,
            "acknowledged_by": user_id,
            "acknowledged_at": datetime.now(pytz.utc),
            "alert_data": alert
        }
        
        result = db['Ack_alerts'].insert_one(ack_data)
        
        if not result.inserted_id:
            return jsonify({"success": False, "message": "Failed to save acknowledgment"}), 500

        return jsonify({
            "success": True,
            "message": "Alert acknowledged successfully",
            "alert_id": alert_id
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "message": f"Server error: {str(e)}"
        }), 500