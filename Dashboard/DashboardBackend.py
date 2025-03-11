from flask import Blueprint, app, jsonify, render_template, Flask, request, redirect, url_for, session, flash, send_file
from pymongo import MongoClient
from datetime import datetime, timedelta
from bson.objectid import ObjectId
import bcrypt
import os
from werkzeug.utils import secure_filename
import pandas as pd
from geopy.distance import geodesic


dashboard_bp = Blueprint('Dashboard', __name__, static_folder='static', template_folder='templates')

@dashboard_bp.route('/page')
def page():
    return render_template('admin_dashboard.html')

client = MongoClient("mongodb+srv://doadmin:4T81NSqj572g3o9f@db-mongodb-blr1-27716-c2bd0cae.mongo.ondigitalocean.com/admin?tls=true&authSource=admin")
db = client['nnx']
collection = db['distinctAtlanta']


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
        
        # Debugging logs
        print("Processed Results:", results)

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

        print(f"Total Devices: {total_devices}, Moving: {moving_vehicles}, Idle: {idle_vehicles}")
        
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
        # Fetch all documents from the atlanta collection
        results = list(collection.find())

        # Dictionary to store total distance per day
        distance_per_day = {}

        for record in results:
            date_str = record['date']
            imei = record['imei']
            latitude = record['latitude']
            longitude = record['longitude']

            # Convert latitude and longitude to decimal format
            lat = convert_to_decimal(latitude, record['dir1'])
            lon = convert_to_decimal(longitude, record['dir2'])

            # Initialize the dictionary for the date if not already present
            if date_str not in distance_per_day:
                distance_per_day[date_str] = {}

            # Initialize the list for the IMEI if not already present
            if imei not in distance_per_day[date_str]:
                distance_per_day[date_str][imei] = []

            # Append the coordinates to the list
            distance_per_day[date_str][imei].append((lat, lon))

        # Calculate total distance per day
        total_distance_per_day = {}
        for date_str, imei_data in distance_per_day.items():
            total_distance = 0
            for imei, coordinates in imei_data.items():
                for i in range(1, len(coordinates)):
                    total_distance += geodesic(coordinates[i - 1], coordinates[i]).meters
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