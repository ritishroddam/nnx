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

def deltaTimeString(status_time_delta):
    days = status_time_delta.days
    seconds = status_time_delta.seconds
    hours, remainder = divmod(seconds, 3600)
    minutes, seconds = divmod(remainder, 60)

    if days > 0:
        return f"{days} days, {hours} hours"
    elif hours > 0:
        return f"{hours} hours, {minutes} minutes"
    elif minutes > 0:
        return f"{minutes} minutes, {seconds} seconds"
    else:
        return f"{seconds} seconds"
    
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

        pipeline = [
            {"$match": {"imei": vehicleData['IMEI'], "gps": "A" }},
            {"$sort": {"date_time": -1}},
            {"$limit": 50}
        ]

        vehicle_data = list(atlanta_collection.aggregate(pipeline))

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

                now = datetime.now()
                five_minutes_ago = now - timedelta(hours=1)

                for entry in vehicle_data:
                    if entry.get("date_time") and entry.get("date_time") > five_minutes_ago.replace(tzinfo=pytz.UTC):
                        if recent_data is None:
                            recent_data = []
                        if entry.get("speed") is not "0.0":
                            recent_data.append(
                                {
                                    "time": entry["time"],
                                    "speed": entry["speed"]
                                }
                            )

        if recent_data and vehicle_data:
            print(f"Recent data for vehicle {LicensePlateNumber}: {recent_data}")
            print(f"Vehicle data for vehicle {LicensePlateNumber}: {vehicle_data}")
            

        if most_recent_entry.get("latitude") and most_recent_entry.get("longitude"):
            latitude = most_recent_entry["latitude"]
            longitude = most_recent_entry["longitude"]
            address = geocodeInternal(latitude, longitude)

        if vehicleData and most_recent_entry:
            processed_data.append({
                "License Plate Number": vehicleData.get("LicensePlateNumber", "Unknown"),
                "Address": address if address else "Unknown",
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
        else:
            processed_data.append({
                "License Plate Number": vehicleData.get("LicensePlateNumber", "Unknown"),
                "Address": "Unknown",
                "Vehicle Type": vehicleData.get("VehicleType", "Unknown"),
                "Vehicle Model": vehicleData.get("VehicleModel", "Unknown"),
                "Vehicle Make": vehicleData.get("VehicleMake", "Unknown"),
                "Driver Name": vehicleData.get("DriverName", "Unknown"),
                "Current Status": "Inactive",
                "Time": "N/A",
                "Latitude": "N/A",
                "Longitude": "N/A",
                "Speed": "N/A",
                "Date": "N/A",
                "Ignition": vehicleData.get("ignition", "Unknown"),
                "Door": vehicleData.get("door", "Unknown"),
                "SOS": vehicleData.get("sos", "Unknown"),
                "Odometer": vehicleData.get("odometer", "Unknown"),
                "IMEI": vehicleData.get("IMEI", "Unknown"),
            })

        # Fetch alerts for the vehicle
        alerts = list(db['sos_logs'].find({"imei": vehicleData['IMEI']}))

        return render_template('vehicle.html', vehicle_data=processed_data, recent_data=recent_data, alerts=alerts)
    except Exception as e:
        print(f"Error processing vehicle data for {LicensePlateNumber}: {e}")
        return "An error occurred while processing vehicle data.", 500

@route_bp.route("/vehicle/<imei>/liveData", methods=["GET"])
@jwt_required()
def fetch_live_data(imei):
    try:
        now = datetime.now().astimezone(pytz.UTC)
        thirty_minutes_ago = now - timedelta(minutes=30)

        pipeline = [
            {"$match": {"imei": imei, "gps": "A", "date_time": {"$gte": thirty_minutes_ago.replace(tzinfo=pytz.UTC)}}},
            {"$sort": {"date_time": 1}},
            {"$project": {"_id": 0, "latitude": 1, "longitude": 1, "speed": 1, "ignition": 1, "date_time": 1, "course": 1}}
        ]

        liveData = list(atlanta_collection.aggregate(pipeline))

        if not liveData:
            pipeline = [
                {"$match": {"imei": imei, "gps": "A"}},
                {"$sort": {"date_time": -1}},
                {"$project": {"_id": 0, "latitude": 1, "longitude": 1, "speed": 1, "ignition": 1, "date_time": 1, "course": 1}},
                {"$limit": 1}
            ]
            data = list(atlanta_collection.aggregate(pipeline))
            if data:
                status_time_delta = now - data[0]["date_time"]
                status_time = deltaTimeString(status_time_delta)

                data[0]["status"] = "Inactive"
                data[0]["status_time"] = status_time
                data[0]["status_time_delta"] = int(status_time_delta.total_seconds()  * 1000)
                return jsonify(data), 200
            else:
                return jsonify({"error": "No data found for the specified vehicle"}), 404
        else:
            address = geocodeInternal(liveData[-1]["latitude"], liveData[-1]["longitude"])

            if address:
                liveData[-1]["address"] = address

            if liveData[-1]["ignition"] == "0" and liveData[-1]["speed"] == "0.0":
                index = len(liveData) - 1
                for entry in reversed(liveData):
                    if entry["ignition"] != "1" or entry["speed"] != "0.0":
                        index = liveData.index(entry)
                        break
                status_time_delta = liveData[-1]["date_time"] - liveData[index]["date_time"]
                status_time = deltaTimeString(status_time_delta)

                liveData[-1]["status"] = "Stopped"
                liveData[-1]["status_time"] = status_time
                liveData[-1]["status_time_delta"] = int(status_time_delta.total_seconds()  * 1000)
                return jsonify(liveData), 200
            elif liveData[-1]["ignition"] == "1" and liveData[-1]["speed"] != "0.0":
                index = len(liveData) - 1
                for entry in reversed(liveData):
                    if entry["ignition"] != "1" or entry["speed"] == "0.0":
                        index = liveData.index(entry)
                        break
                status_time_delta = liveData[-1]["date_time"] - liveData[index]["date_time"]
                status_time = deltaTimeString(status_time_delta)

                liveData[-1]["status"] = "Moving"
                liveData[-1]["status_time"] = status_time
                liveData[-1]["status_time_delta"] = int(status_time_delta.total_seconds()  * 1000)
                return jsonify(liveData), 200
            elif liveData[-1]["ignition"] == "1" and liveData[-1]["speed"] == "0.0":
                index = len(liveData) - 1
                for entry in reversed(liveData):
                    if entry["ignition"] != "1" or entry["speed"] != "0.0":
                        index = liveData.index(entry)
                        break
                status_time_delta = liveData[-1]["date_time"] - liveData[index]["date_time"]
                status_time = deltaTimeString(status_time_delta)

                liveData[-1]["status"] = "Idle"
                liveData[-1]["status_time"] = status_time
                liveData[-1]["status_time_delta"] = int(status_time_delta.total_seconds()  * 1000)
                return jsonify(liveData), 200
            else:
                liveData[-1]["status"] = "unknown"
                liveData[-1]["status_time"] = "unknown"
                liveData[-1]["status_time_delta"] = "unknown"
                return jsonify(liveData), 200
            
    except Exception as e:
        print(f"Error fetching live data for IMEI {imei}: {e}")
        return jsonify({"error": "Error fetching live data"}), 500

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
                    "date_time": 1,
                    "course": 1,
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
                "time": record["date_time"].astimezone(ist).strftime("%d-%m-%Y %I:%M:%S %p"),
                "course": record["course"],
            })

        return jsonify(path_data)

    except Exception as e:
        print(f"Error fetching path data: {str(e)}")
        return jsonify({"error": "Error fetching path data"}), 500
