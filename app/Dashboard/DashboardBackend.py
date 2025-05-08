from flask import Blueprint, json, app, jsonify, render_template, Flask, request, redirect, url_for, session, flash, send_file
from pymongo import MongoClient
from datetime import datetime, timedelta
from pytz import timezone
from bson.objectid import ObjectId
import bcrypt
import os
from werkzeug.utils import secure_filename
import pandas as pd
from app.database import db
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app.models import User
from app.utils import roles_required, get_filtered_results


dashboard_bp = Blueprint('Dashboard', __name__, static_folder='static', template_folder='templates')

@dashboard_bp.route('/page')
@jwt_required()
def page():
    return render_template('admin_dashboard.html')

atlanta_collection = db["atlanta"]
collection = db['distinctAtlanta']
distance_travelled_collection = db['distanceTravelled']
vehicle_inventory = db["vehicle_inventory"]

@dashboard_bp.route('/dashboard_data', methods=['GET'])
@jwt_required()
@roles_required('admin')  # Restrict access to admin and client admins
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
@jwt_required()
@roles_required('admin', 'clientAdmin', 'user')
def atlanta_pie_data():
    try:
        results = list(get_filtered_results("distinctAtlanta"))

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
@jwt_required()
@roles_required('admin', 'clientAdmin', 'user')
def atlanta_distance_data():
    try:
        today = datetime.now().strftime('%d%m%y')

        distances = {}

        for i in range(7):
            date = (datetime.now() - timedelta(days=(i+1))).strftime('%d%m%y')
            if date:
                imei_data = get_filtered_results("atlanta", collection_query = {'date': date}).distinct('imei')
                total_distance = 0

                for imei in imei_data:
                    records = list(atlanta_collection.find({'date': date, 'imei': imei}).sort('time'))
                    if len(records) >= 2:
                        start_odometer = float(records[0].get('odometer', 0))
                        end_odometer = float(records[-1].get('odometer', 0))
                        distance = end_odometer - start_odometer
                        total_distance += distance
                
                distances[date] = total_distance

        distancesJson = {
            "labels": list(distances.keys())[::-1],
            "distances": list(distances.values())[::-1]
        }

        return jsonify(distancesJson), 200

    except Exception as e:
        print(f"🚨 Error fetching distance data: {e}")
        return jsonify({"error": "Failed to fetch distance data"}), 500

@dashboard_bp.route('/get_vehicle_distances', methods=['GET'])
@jwt_required()
@roles_required('admin', 'clientAdmin', 'user')
def get_vehicle_distances():
    try:
        utc_now = datetime.now(timezone('UTC'))
        start_of_day = utc_now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = utc_now.replace(hour=23, minute=59, second=59, microsecond=999999)

        imeis = list(get_filtered_results("atlanta",collection_query={"$query": {}, "$projection": {"imei": 1}}).distinct('imei'))

        vehicle_map_cursor = vehicle_inventory.find({"IMEI": {"$in": imeis}}, {"IMEI": 1, "LicensePlateNumber": 1, "_id": 0})
        vehicle_map = {vehicle["IMEI"]: vehicle["LicensePlateNumber"] for vehicle in vehicle_map_cursor}

        pipeline = [
            {"$match": {"date_time": {
                    "$gte": start_of_day,
                    "$lt": end_of_day
                }},
                "imei": {"$in": imeis}},
            {"$project": {  
                "imei": 1,
                "odometer": {"$toDouble": "$odometer"} 
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


@dashboard_bp.route('/get_status_data', methods=['GET'])
@jwt_required()
@roles_required('admin', 'clientAdmin', 'user')
def get_status_data():
    try:
        now = datetime.now()
        total_vehicles = collection.count_documents({})

        response_data, statusCode = atlanta_pie_data()
        if statusCode != 200:
            return jsonify({"error": "Failed to fetch vehicle data"}), 500
        
        data = json.loads(response_data.get_data(as_text=True))
 
        running_vehicles = data.get('moving_vehicles', 0)
 
        idle_vehicles = data.get('idle_vehicles', 0)
 
        parked_vehicles = 0
        results = list(collection.find({
            "$and": [
                {"speed": "0.0"},
                {"ignition": "0"}
            ]
        }))

        for record in results:
            date_str = record["date"]
            time_str = record["time"]
            datetime_str = date_str + time_str
            record_datetime = datetime.strptime(datetime_str, '%d%m%y%H%M%S')
            if (now - record_datetime).total_seconds() > 5 * 60:
                parked_vehicles += 1

        speed_vehicles = collection.count_documents({
            "$expr": {
                "$and": [
                    {"$gte": [{"$toDouble": "$speed"}, 40]},
                    {"$lt": [{"$toDouble": "$speed"}, 60]}
                ]
            }
        })
        


        overspeed_vehicles = collection.count_documents({
            "$expr": {
                "$and": [
                    {"$gte": [{"$toDouble": "$speed"}, 60]}
                ]
            }
        })

        disconnected_vehicles = collection.count_documents({
           "main_power": "0"
        })
 
        no_gps_vehicles = collection.count_documents({
            "gps": False
        })
 
        return jsonify({
            'runningVehicles': running_vehicles,
            'idleVehicles': idle_vehicles,
            'parkedVehicles': parked_vehicles,
            'speedVehicles': speed_vehicles,
            'overspeedVehicles': overspeed_vehicles,
            'disconnectedVehicles': disconnected_vehicles,
            'noGpsVehicles': no_gps_vehicles,
            'totalVehicles': total_vehicles
        }), 200
    except Exception as e:
        print(f"Error fetching status data: {e}")
        return jsonify({"error": "Failed to fetch status data"}), 500