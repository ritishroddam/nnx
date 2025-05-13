from flask import Flask, jsonify, request, render_template, redirect, Blueprint, flash
from pymongo import MongoClient
from flask_cors import CORS
from datetime import datetime, timedelta
import pytz
import requests
from app.database import db
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app.models import User
from app.utils import roles_required
from app.geocoding import geocodeInternal
from config import config

route_bp = Blueprint('RouteHistory', __name__, static_folder='static', template_folder='templates')

data_collection = db["vehicle_inventory"]
distinct_atlanta_collection = db["distinctAtlanta"]
atlanta_collection = db["atlanta"]
company_collection = db["customers_list"]

def convertDate(ddmmyy, hhmmss):
    day = int(ddmmyy[0:2])
    month = int(ddmmyy[2:4])
    year = 2000 + int(ddmmyy[4:6])  # assuming YY is 2000+
    
    hour = int(hhmmss[0:2])
    minute = int(hhmmss[2:4])
    second = int(hhmmss[4:6])
    
    return datetime(year, month, day, hour, minute, second, tzinfo=pytz.UTC)
    
@route_bp.route("/vehicle/<LicensePlateNumber>", methods=["GET"])
@jwt_required()
def show_vehicle_data(LicensePlateNumber):
    try:
        # Fetch vehicle data for the given vehicle number
        print(f"Request received for LicensePlateNumber: {LicensePlateNumber}")
        vehicleData = data_collection.find_one({"LicensePlateNumber": LicensePlateNumber})
        if not vehicleData:
            flash(f"Vehicle with License Plate Number '{LicensePlateNumber}' does not exist.", "warning")
            return render_template('vehicleMap.html')

        processed_data = []
        recent_data = None
        print(vehicleData['IMEI'])
        now = datetime.now()
        five_minutes_ago = now - timedelta(minutes=5)

        pipeline = [
            {"$match": {"imei": vehicleData['IMEI'], "gps": "A", "date_time": {"$gte": five_minutes_ago}}},
            {"$sort": {"date_time": -1}},  
        ]

        vehicle_data = list(atlanta_collection.aggregate(pipeline))
        print("history", vehicle_data)

        is_active = False
        most_recent_entry = None
        if vehicle_data:
            vehicle_data = [
                entry for entry in vehicle_data
                if entry.get("date") and
                   entry.get("latitude") is not None and
                   entry.get("longitude") is not None and
                   entry.get("speed") is not None
            ]
            if vehicle_data:
                most_recent_entry = vehicle_data[0]
                if float(most_recent_entry.get("speed","0.0")) > 0:
                    is_active = True

                recent_data = [
                    {
                        "time": entry["time"],
                        "speed": entry["speed"]
                    }
                    for entry in vehicle_data
                ]

        if vehicleData.get("latitude") and vehicleData.get("longitude"):
            latitude = vehicleData["latitude"]
            longitude = vehicleData["longitude"]
            addres = geocodeInternal(latitude, longitude)

        processed_data.append({
            "License Plate Number": vehicleData.get("LicensePlateNumber", "Unknown"),
            "Address": addres if vehicleData.get("latitude") and vehicleData.get("longitude") else "Unknown",
            "Vehicle Type": vehicleData.get("VehicleType", "Unknown"),
            "Vehicle Model": vehicleData.get("VehicleModel", "Unknown"),
            "Vehicle Make": vehicleData.get("VehicleMake", "Unknown"),
            "Driver Name": vehicleData.get("DriverName", "Unknown"),
            "Current Status": "Active" if is_active else "Inactive",
            "Time": most_recent_entry.get("time", "N/A") if most_recent_entry else "N/A",
            "Latitude": most_recent_entry.get("latitude", "N/A") if most_recent_entry else "N/A",
            "Longitude": most_recent_entry.get("longitude", "N/A") if most_recent_entry else "N/A",
            "Speed": most_recent_entry.get("speed", "N/A") if most_recent_entry else "N/A",
            "Date": most_recent_entry.get("date", "N/A") if most_recent_entry else "N/A",
            "Ignition": most_recent_entry.get("ignition", "Unknown") if most_recent_entry else "Unknown",
            "Door": most_recent_entry.get("door", "Unknown") if most_recent_entry else "Unknown",
            "SOS": most_recent_entry.get("sos", "Unknown") if most_recent_entry else "Unknown",
            "Odometer": most_recent_entry.get("odometer", "Unknown") if most_recent_entry else "Unknown",
            "IMEI": vehicleData.get("IMEI", "Unknown"),
        })

        # Fetch alerts for the vehicle
        alerts = list(db['sos_logs'].find({"imei": vehicleData['IMEI']}))

        return render_template('vehicle.html', vehicle_data=processed_data, recent_data=recent_data, alerts=alerts)
    except Exception as e:
        print(f"Error processing vehicle data for {LicensePlateNumber}: {e}")
        return "An error occurred while processing vehicle data.", 500

    

@route_bp.route("/vehicle/<imei>/alerts", methods=["GET"])
@jwt_required()
def fetch_vehicle_alerts(imei):
    try:
        # Query the `sos_logs` collection for the specific IMEI
        alerts = list(db["sos_logs"].find({"imei": imei}, {"_id": 0}))

        # If no alerts found, return an empty list
        if not alerts:
            return jsonify([])

        ist = pytz.timezone("Asia/Kolkata")

        # Format alerts for frontend
        formatted_alerts = [
            {
                "timestamp": alert["date_time"].astimezone(ist).strftime("%d-%m-%Y %I:%M:%S %p"),
                "location": f"{alert['latitude']}, {alert['longitude']}",
                "severity": "Critical",
                "status": "Active",
            }
            for alert in alerts
        ]

        return jsonify(formatted_alerts)
    except Exception as e:
        print(f"Error fetching alerts for IMEI {imei}: {e}")
        return jsonify({"error": "Error fetching alerts"}), 500

@route_bp.route("/alerts", methods=["GET"])
@jwt_required()
def get_alerts():
    try:
        imei = request.args.get("imei")
        if not imei:
            return jsonify({"error": "IMEI is required"}), 400

        # Query MongoDB for alerts with the specific IMEI
        alerts = list(db["sos_logs"].find({"imei": imei}, {"_id": 0, "latitude": 1, "longitude": 1, "location": 1, "timestamp": 1}))

        # Format the data for better frontend consumption
        formatted_alerts = [
            {
                "timestamp": alert["timestamp"],
                "location": alert["location"],
                "latitude": alert.get("latitude", "N/A"),
                "longitude": alert.get("longitude", "N/A"),
            }
            for alert in alerts
        ]

        return jsonify(formatted_alerts)

    except Exception as e:
        print(f"Error fetching alerts for IMEI: {imei}. Error: {e}")
        return jsonify({"error": "Error fetching alerts"}), 500


@route_bp.route("/get_vehicle_path", methods=["GET"])
@jwt_required()
def get_vehicle_path():
    imei_numeric = request.args.get("imei")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    iso_start_date = convertDate(start_date, "000000")
    iso_end_date = convertDate(end_date, "235959")

    try:
        # Step 1: Verify if the IMEI number exists in the 'data' collection
        data_record = data_collection.find_one({"IMEI": str(imei_numeric)})
        if not data_record:
            return jsonify({"error": f"IMEI number {imei_numeric} not found in data collection"}), 404

        # Step 2: Fetch path data from the 'atlanta' collection for the verified IMEI
        pipeline = [
            {
                "$match": {
                    "imei": str(imei_numeric),
                    "gps": "A",
                    "date_time": {"$gte": iso_start_date, "$lte": iso_end_date}
                }
            },
            {
                "$sort": {"date_time": 1}  # Sort by date_time in ascending order
            },
            {
                "$project": {
                    "_id": 0,
                    "latitude": 1,
                    "longitude": 1,
                    "speed": 1,
                    "ignition": 1,
                    "dir1": 1,
                    "dir2": 1,
                    "date_time": 1
                }
            }
        ]
        records_list = list(atlanta_collection.aggregate(pipeline))

        if not records_list:
            return jsonify({"error": f"No path data found for the specified IMEI {imei_numeric} and date range {iso_start_date} and {iso_end_date} "}), 404

        # Step 3: Convert latitude and longitude to decimal format and prepare path data
        ist = pytz.timezone("Asia/Kolkata")

        path_data = []
        for record in records_list:
            
            if not record['latitude'] or not record['longitude']:
                continue

            latitude = float(record["latitude"])
            longitude = float(record["longitude"])
            path_data.append({
                "LicensePlateNumber": data_record.get("LicensePlateNumber", "Unknown"),
                "latitude": latitude,
                "longitude": longitude,
                "speed": record["speed"],
                "ignition": record["ignition"],
                "time": record["date_time"].astimezone(ist).strftime("%d-%m-%Y %I:%M:%S %p")
            })

        return jsonify(path_data)

    except Exception as e:
        print(f"Error fetching path data: {str(e)}")
        return jsonify({"error": "Error fetching path data"}), 500

@route_bp.route('/snap-to-roads', methods=['POST'])
def snap_to_roads():
    points = request.json['points']
    api_key = config['development']().GMAPS_API_KEY
    url = f'https://roads.googleapis.com/v1/snapToRoads?path={points}&interpolate=true&key={api_key}'
    
    try:
        response = requests.get(url)
        result = response.json()
        return jsonify(result.get('snappedPoints', []))
    except Exception as e:
        return jsonify({'error': str(e)}), 500