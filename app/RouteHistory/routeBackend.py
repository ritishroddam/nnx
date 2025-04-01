from flask import Flask, jsonify, request, render_template, redirect, Blueprint
from pymongo import MongoClient
from flask_cors import CORS
from datetime import datetime, timedelta
import sys
import os
from app.database import db
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app.models import User
from app.utils import roles_required

route_bp = Blueprint('RouteHistory', __name__, static_folder='static', template_folder='templates')

data_collection = db["data"]
atlanta_collection = db["atlanta"]

def convert_to_decimal(degrees_minutes, direction):
    """Convert GPS coordinates from degrees-minutes to decimal format."""
    degrees = int(float(degrees_minutes) / 100)
    minutes = float(degrees_minutes) - (degrees * 100)
    decimal = degrees + (minutes / 60)
    if direction in ["S", "W"]:
        decimal = -decimal
    return decimal


@route_bp.route('/page')
@jwt_required()
def page():
    return render_template('vehicle_list.html')

@route_bp.route("/vehicle", methods=["GET"])
@jwt_required()
def show_all_vehicles():
    try:
        vehicle_data = list(data_collection.find({}))
        vehicle_list = []
        for item in vehicle_data:
            vehicle_list.append({
                "License Plate Number": item.get("Vehicle Data", {}).get("License Plate Number", "Unknown"),
                "IMEI Number": item.get("IMEI Number", "Unknown"),
                "Vehicle Model": item.get("Vehicle Data", {}).get("Vehicle Model", "Unknown"),
                "Vehicle Make": item.get("Vehicle Data", {}).get("Vehicle Make", "Unknown"),
                "Company Name": item.get("Company Name", "Unknown"),
                "Driver Name": item.get("Driver Name", "Unknown"),
                "Current Status": item.get("Vehicle Data", {}).get("Current Status", "Unknown"),
                "Location": f"{item.get('Vehicle Data', {}).get('Latitude', 'N/A')}, {item.get('Vehicle Data', {}).get('Longitude', 'N/A')}",
                "Odometer Reading": item.get("Vehicle Data", {}).get("Odometer", "Unknown")
            })
        return render_template('vehicle_list.html', vehicle_list=vehicle_list)
    except Exception as e:
        print(f"Error fetching vehicle list: {e}")
        return "An error occurred while fetching vehicle list.", 500
    
@route_bp.route("/vehicle/<vehicle_number>", methods=["GET"])
@jwt_required()
def show_vehicle_data(vehicle_number):
    try:
        # Fetch vehicle data for the given vehicle number
        vehicle_data = list(data_collection.find({"Vehicle Data.License Plate Number": vehicle_number}))
        if not vehicle_data:
            return render_template('vehicle.html', vehicle_data=None, recent_data=None, alerts=None)

        processed_data = []
        recent_data = None
        for item in vehicle_data:
            imei_number = item.get("IMEI Number", "Unknown")
            atlanta_data = item.get("Atlanta Data", [])
            driver_name = item.get("Driver Name", "No Data Provided")
            license_number = item.get("Vehicle Data", {}).get("License", "No Data Provided")
            phone_number = item.get("Vehicle Data", {}).get("Phone", "No Data Provided")

            # Process Atlanta data for most recent entry and determine current status
            is_active = False
            most_recent_entry = None
            if atlanta_data:
                atlanta_data = [
                    entry for entry in atlanta_data
                    if entry.get("date") and
                       entry.get("latitude") is not None and
                       entry.get("longitude") is not None and
                       entry.get("speed") is not None
                ]
                if atlanta_data:
                    most_recent_entry = max(
                        atlanta_data,
                        key=lambda x: datetime.strptime(x["date"] + x["time"], "%y%m%d%H%M%S")
                    )
                    most_recent_datetime = datetime.strptime(
                        most_recent_entry["date"] + most_recent_entry["time"], "%y%m%d%H%M%S"
                    )
                    if most_recent_datetime.date() == datetime.utcnow().date():
                        is_active = True

                    # Get data from the last 5 minutes
                    now = datetime.utcnow()
                    five_minutes_ago = now - timedelta(minutes=5)
                    recent_data = [
                        {
                            "time": entry["time"],
                            "speed": entry["speed"]
                        }
                        for entry in atlanta_data
                        if datetime.strptime(entry["date"] + entry["time"], "%y%m%d%H%M%S") >= five_minutes_ago
                    ]

            processed_data.append({
                "License Plate Number": item.get("Vehicle Data", {}).get("License Plate Number", "Unknown"),
                "Vehicle Model": item.get("Vehicle Data", {}).get("Vehicle Model", "Unknown"),
                "Vehicle Make": item.get("Vehicle Data", {}).get("Vehicle Make", "Unknown"),
                "Driver Name": driver_name,
                "License Number": license_number,
                "Phone Number": phone_number,
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
                "IMEI Number": imei_number
            })

        # Fetch alerts for the vehicle
        alerts = list(db['sos_logs'].find({"imei": imei_number}))

        return render_template('vehicle.html', vehicle_data=processed_data, recent_data=recent_data, alerts=alerts)
    except Exception as e:
        print(f"Error processing vehicle data for {vehicle_number}: {e}")
        return "An error occurred while processing vehicle data.", 500

    

@route_bp.route("/vehicle/<imei>/alerts", methods=["GET"])
@jwt_required()
def fetch_vehicle_alerts(imei):
    try:
        # Query the `sos_logs` collection for the specific IMEI
        alerts = list(db["sos_logs"].find({"imei": imei}, {"_id": 0, "timestamp": 1, "location": 1}))

        # If no alerts found, return an empty list
        if not alerts:
            return jsonify([])

        # Format alerts for frontend
        formatted_alerts = [
            {
                "timestamp": datetime.strptime(alert["timestamp"], "%Y-%m-%d %H:%M:%S").strftime("%d-%m-%Y %H:%M:%S"),
                "location": alert.get("location", "Unknown"),
                "severity": "Critical",
                "status": "Active",
            }
            for alert in alerts
        ]

        return jsonify(formatted_alerts)
    except Exception as e:
        print(f"Error fetching alerts for IMEI {imei}: {e}")
        return jsonify({"error": "Error fetching alerts"}), 500

@route_bp.route("/api/alerts", methods=["GET"])
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

    try:
        # Step 1: Verify if the IMEI number exists in the 'data' collection
        data_record = data_collection.find_one({"IMEI Number": {"$regex": f".*{imei_numeric}$"}})
        if not data_record:
            return jsonify({"error": f"IMEI number {imei_numeric} not found in data collection"}), 404

        # Step 2: Fetch path data from the 'atlanta' collection for the verified IMEI
        query = {
            "imei": {"$regex": f".*{imei_numeric}$"},
            "date": {"$gte": start_date, "$lte": end_date}
        }
        records = atlanta_collection.find(query, {"_id": 0, "latitude": 1, "longitude": 1, "dir1": 1, "dir2": 1, "time": 1})
        records_list = list(records)

        if not records_list:
            return jsonify({"error": "No path data found for the specified IMEI and date range"}), 404

        # Step 3: Convert latitude and longitude to decimal format and prepare path data
        path_data = []
        for record in records_list:
            latitude = convert_to_decimal(record["latitude"], record["dir1"])
            longitude = convert_to_decimal(record["longitude"], record["dir2"])
            path_data.append({
                "latitude": latitude,
                "longitude": longitude,
                "time": record["time"]
            })

        return jsonify(path_data)

    except Exception as e:
        print(f"Error fetching path data: {str(e)}")
        return jsonify({"error": "Error fetching path data"}), 500