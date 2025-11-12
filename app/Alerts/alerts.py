from flask import Blueprint, render_template, request, jsonify, url_for
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from datetime import datetime, timedelta, timezone
import pytz
from bson import ObjectId

from app.database import db
from app.geocoding import geocodeInternal
from app.utils import roles_required, get_filtered_results, get_vehicle_data
from app.parser import getCollectionImeis

alerts_bp = Blueprint('Alerts', __name__, static_folder='static', template_folder='templates')

alertCollectionKeys = {
    'panic': 'panic', 'speeding': 'speedingAlerts', 
    'harsh_break': 'harshBrakes', 'harsh_acceleration': 'harshAccelerations', 
    'gsm_low': 'gsmSignalLows', 'internal_battery_low': 'internalBatteryLows', 
    'main_power_off': 'powerSupplyDissconnects', 'idle': 'idles', 
    'ignition_off': 'ignitionOffs', 'ignition_on': 'ignitionOns', 
    'geofence_in': 'geofenceIns', 'geofence_out': 'geofenceOuts'
}

alertConfigKeys = {
    "panic_alert": 'panic', "main_power_alerts": 'powerSupplyDissconnects', 
    "speeding_alerts": 'speedingAlerts', "harsh_break_alerts": 'harshBrakes',
    "harsh_acceleration_alerts": 'harshAccelerations', "gsm_low_alerts": 'gsmSignalLows', 
    "internal_battery_low_alerts": 'internalBatteryLows', "main_power_off_alerts": 'powerSupplyDissconnects', 
    "idle_alerts": 'idle', "ignition_off_alerts": 'ignitionOffs', 
    "ignition_on_alerts": 'ignitionOns', 'geofenceIns': 'geofenceIns',
    'geofenceOuts': 'geofenceOuts'
}

speedingCollection = db['speedingAlerts']
harshBrakeCollection = db['harshBrakes']
harshAccelerationCollection = db['harshAccelerations']
gsmSignalLowCollection = db['gsmSignalLows']
internalBatterLowCollection = db['internalBatteryLows']
mainPowerSupplyDissconnectCollection = db['powerSupplyDissconnects']
idleCollection = db['idles']
ignitionOnCollection = db['ignitionOns']
ignitionOffCollection = db['ignitionOffs']
geofenceInCollection = db['geofenceIns']
geofenceOutCollection = db['geofenceOuts']
panicCollection = db['panic']

def getVehicles():
    claims = get_jwt()
    user_roles = claims.get('roles', [])
    userID = claims.get('user_id')
    userCompany = claims.get('company')
    vehicle_inventory = db["vehicle_inventory"]

    if 'admin' in user_roles:
        return vehicle_inventory.find({}, {"IMEI": 1, "normalSpeed": 1,"_id": 0})
    elif 'user' in user_roles:
        return vehicle_inventory.find({
            'CompanyName': userCompany,
            'AssignedUsers': ObjectId(userID)
        }, {"IMEI": 1, "normalSpeed": 1,"_id": 0})
    else:
        return vehicle_inventory.find({'CompanyName': userCompany}, {"IMEI": 1, "normalSpeed": 1,"_id": 0})

@alerts_bp.route('/get_alerts', methods=['POST'])
@jwt_required()
def get_alerts():
    data = request.get_json()
    start_date = data.get("startDate")
    end_date = data.get("endDate")
    vehicle_number = data.get("vehicleNumber")
    page = data.get("page", 1)
    per_page = data.get("per_page", 100)
    alert_type = data.get("alertType")
    
    if not alert_type:
        return jsonify({"success": False, "message": "Please select a alert type"}), 404
    
    IST = timezone(timedelta(hours=5, minutes=30))
    
    if start_date and end_date:
        start_date = datetime.fromisoformat(start_date) 
        end_date = datetime.fromisoformat(end_date) 
        
        end_date = end_date.replace(tzinfo=IST)
        start_date = start_date.replace(tzinfo=IST)
    else:
        start_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = datetime.now()
        
    
    if not vehicle_number: 
        max_allowed_end = start_date + timedelta(hours=24)
        if end_date > max_allowed_end:
            end_date = max_allowed_end
    else: 
        max_allowed_start = end_date - timedelta(days=30)
        if start_date < max_allowed_start:
            start_date = max_allowed_start
            
    start_date = start_date.astimezone(timezone.utc)
    end_date = end_date.astimezone(timezone.utc)

    if not vehicle_number:
        vehicles = getVehicles()
        if not vehicles:
            return jsonify({"success": False, "message": "No vehicles found for the user"}), 404
        
        vehicleInvyImeis = [v['IMEI'] for v in vehicles]
        
        imeis = getCollectionImeis(vehicleInvyImeis)
        
    try:
        page = int(page) if page else 1
    except (TypeError, ValueError):
        page = 1
    try:
        per_page = int(per_page) if per_page else 100
    except (TypeError, ValueError):
        per_page = 100
    per_page = max(1, min(per_page, 1000))
    skip = max(0, (page - 1) * per_page)

    collection = db[alertCollectionKeys[alert_type]]

    if not vehicle_number:
        query = {
            'imei': {'$in': imeis},
            'date_time': {
                '$gte': start_date,
                '$lte': end_date,
            },
        }
    else:
        query = {
            'LicensePlateNumber': vehicle_number,
            'date_time': {
                '$gte': start_date,
                '$lte': end_date,
            },
        }

    # Total for pagination (if needed later)
    total_count = collection.count_documents(query)

    # Apply pagination
    records = list(collection.find(query, {'imei': 0}).sort('date_time', -1).skip(skip).limit(per_page))
    
    for record in records:
        if 'date_time' in record:
            date = record['date_time']
            istDate = date.astimezone(IST)
            record['date_time'] = istDate.strftime('%d-%b-%Y %I:%M:%S %p')
            
            record['_id'] = str(record['_id'])
            
            record.pop('imei', None)
    
    return jsonify({
        "success": True, 
        "alerts": records, 
        "count": total_count,
        "page": page,
        "per_page": per_page,
        "total_pages": (total_count // per_page) + (1 if total_count % per_page > 0 else 0)
    })

def get_filtered_alerts(imeis, start_of_day, end_of_day, alert_type):
    query = {
        'imei': {'$in': imeis},
        'date_time': {
            '$gte': start_of_day,
            '$lte': end_of_day,
        },
    }
    
    collection = db[alertConfigKeys[alert_type]]
    
    return collection.find(query, {"_id": 1, "date_time": 1, "imei": 1}).sort("date_time", -1)

@alerts_bp.route('/notification_alerts', methods=['GET'])
@jwt_required()
def notification_alerts():
    tz = pytz.timezone('UTC')
    now = datetime.now(tz)
    start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_day = now.replace(hour=23, minute=59, second=59, microsecond=999999)
    
    claims = get_jwt()
    userId = claims.get('user_id')
    
    if not userId:
        return jsonify({"success": False, "message": "User ID not found in JWT claims"}), 400
    
    alertConfig = db['userConfig'].find_one({"userID": ObjectId(userId)}, {"_id": 0, "alerts": 1})

    vehicles = getVehicles()
    if not vehicles:
        return jsonify({"success": False, "message": "No vehicles found for the user"}), 404
    
    vehicleInvyImeis = [v['IMEI'] for v in vehicles]
    
    imeis = getCollectionImeis(vehicleInvyImeis)

    if not imeis:
        return
    
    def enrich(alerts, alert_type):
        enriched = []
        vehicles = db['vehicle_inventory'].find(
            {"IMEI": {"$in": imeis}},
            {"IMEI": 1, "LicensePlateNumber": 1, "_id": 0}
        )
        vehicle_map = {vehicle["IMEI"]: vehicle for vehicle in vehicles}
        ist = pytz.timezone("Asia/Kolkata")

        acknowledged_ids = set(
            ack['alert_id'] for ack in db['Ack_alerts'].find({}, {'alert_id': 1})
        )

        for alert in alerts:
            if str(alert["_id"]) in acknowledged_ids:
                continue
            vehicle = vehicle_map.get(alert["imei"])
            dt_utc = alert.get("date_time")
            if dt_utc:
                dt_ist = dt_utc.astimezone(ist)
                date_time_str = dt_ist.isoformat()
            else:
                date_time_str = ""

            is_acknowledged = str(alert["_id"]) in acknowledged_ids

            enriched.append({
                "id": str(alert["_id"]),
                "type": alert_type,
                "alert_type": alert_type,
                "vehicle": vehicle["LicensePlateNumber"] if vehicle else "Unknown",
                "vehicle_number": vehicle["LicensePlateNumber"] if vehicle else "Unknown",
                "date_time": date_time_str,
                "acknowledged": is_acknowledged
            })

        return enriched
    
    panic_alerts = get_filtered_alerts(imeis, start_of_day, end_of_day, "panic_alert")
    main_power_off_alerts = get_filtered_alerts(imeis, start_of_day, end_of_day, "main_power_alerts")
    
    notifications = (
        enrich(panic_alerts, "Panic Alert") +
        enrich(main_power_off_alerts, "Main Power Discontinue Alert") 
    )
    
    if not alertConfig or not alertConfig.get("alerts") or "" in alertConfig["alerts"]:
        notifications.sort(key=lambda x: x["date_time"], reverse=True)

        return jsonify({
            "success": True,
            "count": len(notifications),
            "alerts": notifications
        })
        
    alert_types = alertConfig["alerts"]
    if not alert_types:
        notifications.sort(key=lambda x: x["date_time"], reverse=True)

        return jsonify({
            "success": True,
            "count": len(notifications),
            "alerts": notifications
        })

    for alert_type in alert_types:
        if alert_type not in ["panic_alert", "main_power_alerts", "speeding_alerts", "harsh_break_alerts",
                              "harsh_acceleration_alerts", "gsm_low_alerts", "internal_battery_low_alerts",
                              "main_power_off_alerts", "idle_alerts", "ignition_off_alerts", "ignition_on_alerts", "geofence_alerts"]:
            return jsonify({"success": False, "message": f"Unsupported alert type: {alert_type}"}), 400
        
        if alert_type == 'geofence_alerts':
            notifications += enrich(get_filtered_alerts(imeis, start_of_day, end_of_day, "geofenceIns"), 'Geofence Entry')
            notifications += enrich(get_filtered_alerts(imeis, start_of_day, end_of_day, "geofenceOuts"), 'Geofence Exit')
        else:
            notifications += enrich(get_filtered_alerts(imeis, start_of_day, end_of_day, alert_type), alert_type.replace("_alerts", "").replace("_", " ").title())

    notifications.sort(key=lambda x: x["date_time"], reverse=True)

    return jsonify({
        "success": True,
        "count": len(notifications),
        "alerts": notifications
    })

@alerts_bp.route('/')
@jwt_required()
def page():
    vehicleData = get_vehicle_data()
    if not vehicleData:
        vehicles = []
    else:
        vehicleInvyImeis = [v['IMEI'] for v in vehicleData]
        imeis = getCollectionImeis(vehicleInvyImeis)
        print(imeis)
        print(list(vehicleData))
        vehicles = list(v['LicensePlateNumber'] for v in vehicleData if v['IMEI'] in imeis)
        print(vehicles)
    
    now = datetime.now()
    default_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    default_end = now
    
    return render_template('alerts.html', 
                         vehicles=vehicles,
                         default_start_date=default_start.strftime('%Y-%m-%dT%H:%M'),
                         default_end_date=default_end.strftime('%Y-%m-%dT%H:%M'))

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

        if not alert_id:
            return jsonify({"success": False, "message": "Missing required fields"}), 400

        # Check if alert exists in either collection
        alert = db['atlanta'].find_one({"_id": ObjectId(alert_id)})
        source_collection = 'atlanta'
        if not alert:
            alert = db['sos_logs'].find_one({"_id": ObjectId(alert_id)})
            source_collection = 'sos_logs'
            if not alert:
                return jsonify({"success": False, "message": "Alert not found"}), 404

        # Check if already acknowledged
        existing_ack = db['Ack_alerts'].find_one({"alert_id": alert_id})
        if existing_ack:
            return jsonify({"success": True, "message": "Alert already acknowledged", "alert_id": alert_id})

        ack_data = {
            "alert_id": alert_id,
            "pressed_for": pressed_for or "notification_click",
            "reason": reason,
            "acknowledged_by": user_id,
            "acknowledged_at": datetime.now(pytz.utc),
            "alert_data": alert,
            "source_collection": source_collection
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