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
        # Fetch all documents from the distinctAtlanta collection
        results = list(collection.find())

        # If results are empty, return a default response
        if not results:
            return jsonify({
                "labels": [],
                "distances": []
            }), 200

        # Prepare data for the chart
        distance_data = {}
        for record in results:
            date_str = record['date']
            vehicle_id = record['vehicle_id']
            odometer = float(record.get('odometer', 0))
            datetime_str = record['date'] + record['time']
            record_datetime = datetime.strptime(datetime_str, '%d%m%y%H%M%S')

            if date_str not in distance_data:
                distance_data[date_str] = {}

            if vehicle_id not in distance_data[date_str]:
                distance_data[date_str][vehicle_id] = {
                    'first_odometer': odometer,
                    'last_odometer': odometer,
                    'first_datetime': record_datetime,
                    'last_datetime': record_datetime
                }
            else:
                if record_datetime < distance_data[date_str][vehicle_id]['first_datetime']:
                    distance_data[date_str][vehicle_id]['first_odometer'] = odometer
                    distance_data[date_str][vehicle_id]['first_datetime'] = record_datetime
                if record_datetime > distance_data[date_str][vehicle_id]['last_datetime']:
                    distance_data[date_str][vehicle_id]['last_odometer'] = odometer
                    distance_data[date_str][vehicle_id]['last_datetime'] = record_datetime

        # Calculate the distance travelled for each day
        daily_distances = {}
        for date_str, vehicles in distance_data.items():
            total_distance = 0
            for vehicle_id, odometer_data in vehicles.items():
                distance = odometer_data['last_odometer'] - odometer_data['first_odometer']
                total_distance += distance
            daily_distances[date_str] = total_distance

        # Sort the data by date
        sorted_dates = sorted(daily_distances.keys(), key=lambda x: datetime.strptime(x, '%d%m%y'))
        labels = [datetime.strptime(date, '%d%m%y').strftime('%d %b') for date in sorted_dates]
        distances = [daily_distances[date] for date in sorted_dates]

        return jsonify({
            "labels": labels,
            "distances": distances
        }), 200
    except Exception as e:
        print(f"Error fetching distance data: {e}")
        return jsonify({"error": "Failed to fetch distance data"}), 500