from flask import Blueprint, render_template, request, jsonify, send_file
from pymongo import MongoClient
import pandas as pd
from datetime import datetime, timedelta
from pytz import timezone
from io import BytesIO
from app.database import db
from flask_jwt_extended import jwt_required, get_jwt_identity
import pytz
from app.geocoding import geocodeInternal

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

def get_date_range_filter(date_range):
    """Improved date range filter using datetime objects"""
    tz = pytz.timezone('UTC')
    now = datetime.now(tz)
    
    if date_range == "last24hours":
        return {'date_time': {'$gte': now - timedelta(hours=24)}}
    elif date_range == "today":
        today_start = datetime(now.year, now.month, now.day, tzinfo=tz)
        return {'date_time': {'$gte': today_start}}
    elif date_range == "yesterday":
        yesterday_start = datetime(now.year, now.month, now.day, tzinfo=tz) - timedelta(days=1)
        yesterday_end = datetime(now.year, now.month, now.day, tzinfo=tz)
        return {'date_time': {'$gte': yesterday_start, '$lt': yesterday_end}}
    elif date_range == "last7days":
        return {'date_time': {'$gte': now - timedelta(days=7)}}
    elif date_range == "last30days":
        return {'date_time': {'$gte': now - timedelta(days=30)}}
    elif date_range == "custom":
        # You'll need to implement custom date range handling
        return {}
    return {}

def get_alert_query(alert_type, imei=None):
    """Returns the MongoDB query for the specified alert type"""
    query = {"gps": "A"}
    
    if imei:
        query["imei"] = imei
    
    if alert_type == "panic":
        query["$or"] = [
            {"sos": {"$in": ["1", 1, True]}},
            {"status": "SOS"},
            {"alarm": "SOS"}
        ]
    elif alert_type == "speeding":
        query["speed"] = {"$gte": "60"}
    elif alert_type == "harsh_break":
        query["harsh_break"] = "1"
    elif alert_type == "harsh_acceleration":
        query["harsh_speed"] = "1"
    elif alert_type == "gsm_low":
        query["gsm_sig"] = "0"
    elif alert_type == "internal_battery_low":
        query["internal_bat"] = "1"
    elif alert_type == "external_battery_low":
        query["external_bat"] = "1"  # Assuming this field exists
    elif alert_type == "main_power_off":
        query["main_power"] = "0"
    elif alert_type == "door_open":
        query["door"] = "1"
    elif alert_type == "door_close":
        query["door"] = "0"
    elif alert_type == "idle":
        query["speed"] = "0.0"
        query["ignition"] = "1"
    elif alert_type == "ignition_off":
        query["ignition"] = "0"
    elif alert_type == "ignition_on":
        query["ignition"] = "1"
    
    return query

def get_alert_type_name(alert_type):
    """Returns the display name for the alert type"""
    names = {
        "panic": "Panic Alert",
        "speeding": "Speeding Alert",
        "harsh_break": "Harsh Break Alert",
        "harsh_acceleration": "Harsh Acceleration Alert",
        "gsm_low": "GSM Signal Low Alert",
        "internal_battery_low": "Internal Battery Low Alert",
        "external_battery_low": "External Battery Low Alert",
        "main_power_off": "Main Supply Remove Alert",
        "door_open": "Door Open Alert",
        "door_close": "Door Close Alert",
        "idle": "Idle Alert",
        "ignition_off": "Ignition Off Alert",
        "ignition_on": "Ignition On Alert"
    }
    return names.get(alert_type, "Alert")

@alerts_bp.route('/')
@jwt_required()
def page():
    vehicles = list(db['vehicle_inventory'].find({}, {"LicensePlateNumber": 1, "_id": 0}))
    return render_template('alerts.html', vehicles=vehicles)

@alerts_bp.route('/get_alerts', methods=['POST'])
@jwt_required()
def get_alerts():
    try:
        data = request.get_json()
        alert_type = data.get("alertType")
        date_range = data.get("dateRange")
        vehicle_number = data.get("vehicleNumber")
        
        if not alert_type:
            return jsonify({"success": False, "message": "Alert type is required"}), 400
        
        # Get vehicle IMEI if vehicle number is specified
        imei = None
        if vehicle_number:
            vehicle = db['vehicle_inventory'].find_one(
                {"LicensePlateNumber": vehicle_number},
                {"IMEI": 1, "LicensePlateNumber": 1, "_id": 0}
            )
            if not vehicle:
                return jsonify({"success": False, "message": "Vehicle not found"}), 404
            imei = vehicle["IMEI"]
        
        # Build the query
        query = get_alert_query(alert_type, imei)
        
        # Add date range filter
        date_filter = get_date_range_filter(date_range)
        if date_filter:
            query.update(date_filter)
        
        # Fetch data from atlanta collection (historical data)
        records = list(db['atlanta'].find(
            query,
            {
                "date_time": 1,
                "latitude": 1,
                "longitude": 1,
                "imei": 1,
                "_id": 0
            }
        ).sort("date_time", -1))
        
        # Process the records
        alerts = []
        for record in records:
            # Get vehicle number from IMEI
            vehicle = db['vehicle_inventory'].find_one(
                {"IMEI": record["imei"]},
                {"LicensePlateNumber": 1, "_id": 0}
            )
            
            # Convert coordinates
            latitude = nmea_to_decimal(record["latitude"]) if "latitude" in record and record["latitude"] else None
            longitude = nmea_to_decimal(record["longitude"]) if "longitude" in record and record["longitude"] else None
            
            # Get location from geocoding
            location = None
            if latitude and longitude:
                location = geocodeInternal(latitude, longitude)
            
            alerts.append({
                "vehicle_number": vehicle["LicensePlateNumber"] if vehicle else "Unknown",
                "date_time": record["date_time"],
                "alert_type": get_alert_type_name(alert_type),
                "latitude": latitude,
                "longitude": longitude,
                "location": location
            })
        
        return jsonify({
            "success": True,
            "alerts": alerts
        })
        
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@alerts_bp.route('/download_alerts', methods=['POST'])
@jwt_required()
def download_alerts():
    try:
        data = request.get_json()
        alerts = data.get("alerts")
        alert_type = data.get("alertType")
        
        if not alerts or not isinstance(alerts, list):
            return jsonify({"success": False, "message": "No alerts data provided"}), 400
        
        # Create DataFrame
        df = pd.DataFrame(alerts)
        
        # Reorder columns
        columns_order = ['vehicle_number', 'date_time', 'alert_type', 'location', 'latitude', 'longitude']
        df = df[columns_order]
        
        # Generate Excel
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name=f"{alert_type}_alerts")
        
        output.seek(0)
        return send_file(
            output,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            as_attachment=True,
            download_name=f"{alert_type}_alerts_{datetime.now().strftime('%Y%m%d')}.xlsx"
        )
        
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# WebSocket endpoint for real-time alerts
@alerts_bp.route('/ws')
def ws():
    # This would be implemented with Flask-SocketIO or similar
    pass