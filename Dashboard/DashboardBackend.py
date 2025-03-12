from flask import Blueprint, app, jsonify, render_template, Flask, request, redirect, url_for, session, flash, send_file
from pymongo import MongoClient
from datetime import datetime, timedelta
from bson.objectid import ObjectId
import bcrypt
import os
from werkzeug.utils import secure_filename
import pandas as pd

dashboard_bp = Blueprint('Dashboard', __name__, static_folder='static', template_folder='templates')

@dashboard_bp.route('/page')
def page():
    return render_template('admin_dashboard.html')

client = MongoClient("mongodb+srv://doadmin:4T81NSqj572g3o9f@db-mongodb-blr1-27716-c2bd0cae.mongo.ondigitalocean.com/admin?tls=true&authSource=admin")
db = client['nnx']
atlanta_collection = db["atlanta"]
collection = db['distinctAtlanta']
distance_travelled_collection = db['distanceTravelled']
vehicle_inventory = db["vehicle_inventory"]

@dashboard_bp.route('/dashboard_data', methods=['GET'])
def dashboard_data():
    try:
        num_devices = db["device_inventory"].count_documents({})
        num_sims = db["sim_inventory"].count_documents({})
        num_customers = db["customers_list"].count_documents({})
        num_employees = db["employees_db"].count_documents({})

        return jsonify({
            "devices": num_devices,
            "sims": num_sims,
            "customers": num_customers,
            "employees": num_employees
        }), 200
    except Exception as e:
        print(f"Error fetching dashboard data: {e}")
        return jsonify({"error": "Failed to fetch dashboard data"}), 500

@dashboard_bp.route('/atlanta_pie_data', methods=['GET'])
def atlanta_pie_data():
    try:
        results = list(collection.find())

        # If results are empty, return a default response
        if not results:
            return jsonify({
                "total_devices": 0,
                "moving_vehicles": 0,
                "offline_vehicles": 0,
                "idle_vehicles": 0
            }), 200

        # Calculate counts
        total_devices = len(results)
        now = datetime.now()
        moving_vehicles = sum(
            1 for record in results 
            if float(record["speed"] or 0) > 0 and
            datetime.strptime(record["date"] + record['time'], '%d%m%y%H%M%S') > now - timedelta(hours=24)
        )
        idle_vehicles = sum(
            1 for record in results 
            if float(record["speed"] or 0) == 0 and
            datetime.strptime(record["date"] + record['time'], '%d%m%y%H%M%S') > now - timedelta(hours=24)
        )
        offline_vehicles = sum(
            1 for record in results 
            if datetime.strptime(record["date"] + record['time'], '%d%m%y%H%M%S') < now - timedelta(hours=24)
        )
        
        return jsonify({
            "total_devices": total_devices,
            "moving_vehicles": moving_vehicles,
            "offline_vehicles": offline_vehicles,
            "idle_vehicles": idle_vehicles   
        }), 200
    except Exception as e:
        print(f"🚨 Error fetching pie chart data: {e}")
        return jsonify({"error": "Failed to fetch pie chart data"}), 500

@dashboard_bp.route('/atlanta_distance_data', methods=['GET'])
def atlanta_distance_data():
    try:

        results = list(distance_travelled_collection.find())

        # Dictionary to store total distance per day
        total_distance_per_day = {}

        now = datetime.now()
        seven_days_ago = now - timedelta(days=7)

        for record in results:
            date_str = record['date']
            total_distance = record.get('totalDistance', 0)

            # Convert date_str to datetime object
            date_obj = datetime.strptime(date_str, '%d%m%y')

            # Filter records for the past seven days
            if date_obj >= seven_days_ago:


                total_distance_per_day[date_str] = total_distance


        # Prepare the response data
        labels = sorted(total_distance_per_day.keys())
        distances = [total_distance_per_day[date_str] for date_str in labels]

        # Format labels to "DD MMM"
        
        formatted_labels = [datetime.strptime(date_str, '%d%m%y').strftime('%d %b') for date_str in labels]

        return jsonify({
            "labels": formatted_labels,
            "distances": distances
        }), 200

    except Exception as e:
        print(f"🚨 Error fetching distance data: {e}")
        return jsonify({"error": "Failed to fetch distance data"}), 500

# @dashboard_bp.route('/get_vehicle_distances', methods=['GET'])
# def get_vehicle_distances():
#     try:
#         today_str = datetime.utcnow().strftime('%d%m%y')  # Format: DDMMYY

#         # Fetch vehicle IMEI mappings
#         vehicle_map = {
#             v.get("imei", "UNKNOWN"): v.get("registration_number", "UNKNOWN") 
#             for v in vehicle_inventory.find({}, {"imei": 1, "registration_number": 1, "_id": 0})
#         }
#         print("Vehicle Map:", vehicle_map)  # Debugging log

#         # Fetch today's odometer readings
#         pipeline = [
#             {"$match": {"date": today_str}},  # Filter today's data
#             {"$group": {
#                 "_id": "$imei",
#                 "start_odometer": {"$min": "$odometer"},
#                 "end_odometer": {"$max": "$odometer"}
#             }},
#             {"$project": {
#                 "imei": "$_id",
#                 "distance_traveled": {"$subtract": ["$end_odometer", "$start_odometer"]}
#             }}
#         ]

#         results = list(atlanta_collection.aggregate(pipeline))
#         print("Odometer Results:", results)  # Debugging log

#         # Convert IMEI to Vehicle Registration
#         vehicle_data = [
#             {
#                 "registration": vehicle_map.get(record["imei"], "UNKNOWN"),
#                 "distance": record.get("distance_traveled", 0)
#             }
#             for record in results
#         ]

#         print("Final Vehicle Data:", vehicle_data)  # Debugging log

#         return jsonify(vehicle_data), 200

#     except Exception as e:
#         print(f"🚨 Error fetching vehicle distances: {e}")
#         return jsonify({"error": str(e)}), 500

@dashboard_bp.route('/get_vehicle_distances', methods=['GET'])
def get_vehicle_distances():
    try:
        today_str = datetime.now().strftime('%d%m%y')  # Format: DDMMYY

        # Fetch vehicle IMEI mappings
        vehicle_map = vehicle_inventory.find({}, {"IMEI": 1, "LicensePlateNumber": 1, "_id": 0})
        

        for vehicle in vehicle_map:
            print("\n \n",vehicle.get("IMEI"), vehicle.get("LicensePlateNumber"))

        # Fetch today's odometer readings with type conversion
        pipeline = [
            {"$match": {"date": today_str}},  # Filter today's data
            {"$project": {  
                "imei": 1,
                "odometer": {"$toDouble": "$odometer"}  # Convert string to number
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

        results = list(atlanta_collection.aggregate(pipeline))

        # Convert IMEI to Vehicle Registration
        vehicle_data = [
            {
                "registration": vehicle_map.get(record["imei"], "UNKNOWN"),
                "distance": round(record.get("distance_traveled", 0), 2)
            }
            for record in results
        ]

        return jsonify(vehicle_data), 200

    except Exception as e:
        print(f"🚨 Error fetching vehicle distances: {e}")
        return jsonify({"error": str(e)}), 500
