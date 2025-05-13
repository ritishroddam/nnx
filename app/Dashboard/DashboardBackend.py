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
from app.utils import roles_required, get_filtered_results, get_vehicle_data


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
        imeis = list(get_vehicle_data().distinct("IMEI"))

        pipeline = [
            {
                "$match": {
                    "date_time": {
                        "$gte": datetime.now() - timedelta(days=7),
                        "$lt": datetime.now()
                    },
                    "imei": {"$in": imeis}
                }
            },
            {
                "$group": {
                    "_id": {
                        "date": {"$dateToString": {"format": "%d%m%y", "date": "$date_time"}},
                        "imei": "$imei"
                    },
                    "start_odometer": {"$min": {"$toDouble": "$odometer"}},
                    "end_odometer": {"$max": {"$toDouble": "$odometer"}}
                }
            },
            {
                "$project": {
                    "date": "$_id.date",
                    "imei": "$_id.imei",
                    "distance_traveled": {"$subtract": ["$end_odometer", "$start_odometer"]}
                }
            },
            {
                "$group": {
                    "_id": "$date",
                    "total_distance": {"$sum": "$distance_traveled"}
                }
            },
            {
                "$sort": {"_id": 1}  # Sort by date in ascending order
            }
        ]

        results = list(atlanta_collection.aggregate(pipeline))

        # Convert results to the required format
        distances = {result["_id"]: result["total_distance"] for result in results}

        distancesJson = {
            "labels": list(distances.keys()),
            "distances": list(distances.values())
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

        imeis = list(get_vehicle_data().distinct("IMEI"))

        vehicle_map_cursor = vehicle_inventory.find({"IMEI": {"$in": imeis}}, {"IMEI": 1, "LicensePlateNumber": 1, "_id": 0})
        vehicle_map = {vehicle["IMEI"]: vehicle["LicensePlateNumber"] for vehicle in vehicle_map_cursor}

        pipeline = [
            {"$match": {
                "date_time": {
                    "$gte": start_of_day,
                    "$lt": end_of_day
                },
                "imei": {"$in": imeis}
            }},
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
            }},
            {"$sort": {"distance_traveled": -1}}  # Sort by distance_traveled in descending order
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
        imeis = list(get_vehicle_data().distinct("IMEI"))  # Get the list of IMEIs to filter by

        # If no IMEIs are found, return default response
        if not imeis:
            return jsonify({
                'runningVehicles': 0,
                'idleVehicles': 0,
                'parkedVehicles': 0,
                'speedVehicles': 0,
                'overspeedVehicles': 0,
                'disconnectedVehicles': 0,
                'noGpsVehicles': 0,
                'totalVehicles': 0
            }), 200

        # Aggregation pipeline
        pipeline = [
            {"$match": {"imei": {"$in": imeis}}},  # Filter by IMEIs
            {
                "$facet": {
                    "totalVehicles": [
                        {"$count": "count"}
                    ],
                    "runningVehicles": [
                        {"$match": {"speed": {"$ne": "0.0"}}},
                        {"$count": "count"}
                    ],
                    "idleVehicles": [
                        {"$match": {"speed": "0.0", "ignition": "1"}},
                        {"$count": "count"}
                    ],
                    "parkedVehicles": [
                        {
                            "$match": {
                                "speed": "0.0",
                                "ignition": "0",
                                "date_time": {"$lt": now - timedelta(minutes=5)}
                            }
                        },
                        {"$count": "count"}
                    ],
                    "speedVehicles": [
                        {
                            "$match": {
                                "$expr": {
                                    "$and": [
                                        {"$gte": [{"$toDouble": "$speed"}, 40]},
                                        {"$lt": [{"$toDouble": "$speed"}, 60]}
                                    ]
                                }
                            }
                        },
                        {"$count": "count"}
                    ],
                    "overspeedVehicles": [
                        {
                            "$match": {
                                "$expr": {
                                    "$gte": [{"$toDouble": "$speed"}, 60]
                                }
                            }
                        },
                        {"$count": "count"}
                    ],
                    "disconnectedVehicles": [
                        {"$match": {"main_power": "0"}},
                        {"$count": "count"}
                    ],
                    "noGpsVehicles": [
                        {"$match": {"gps": False}},
                        {"$count": "count"}
                    ]
                }
            }
        ]

        # Execute the query
        results = list(db["distinctAtlanta"].aggregate(pipeline))

        # If results are empty, return default response
        if not results or not results[0]:
            return jsonify({
                'runningVehicles': 0,
                'idleVehicles': 0,
                'parkedVehicles': 0,
                'speedVehicles': 0,
                'overspeedVehicles': 0,
                'disconnectedVehicles': 0,
                'noGpsVehicles': 0,
                'totalVehicles': 0
            }), 200

        # Extract counts or default to 0 if not present
        results = results[0]
        print(results)
        # Extract counts or default to 0 if not present or the list is empty
        total_vehicles = results.get("totalVehicles", [{}])[0].get("count", 0) if results.get("totalVehicles") else 0
        running_vehicles = results.get("runningVehicles", [{}])[0].get("count", 0) if results.get("runningVehicles") else 0
        idle_vehicles = results.get("idleVehicles", [{}])[0].get("count", 0) if results.get("idleVehicles") else 0
        parked_vehicles = results.get("parkedVehicles", [{}])[0].get("count", 0) if results.get("parkedVehicles") else 0
        speed_vehicles = results.get("speedVehicles", [{}])[0].get("count", 0) if results.get("speedVehicles") else 0
        overspeed_vehicles = results.get("overspeedVehicles", [{}])[0].get("count", 0) if results.get("overspeedVehicles") else 0
        disconnected_vehicles = results.get("disconnectedVehicles", [{}])[0].get("count", 0) if results.get("disconnectedVehicles") else 0
        no_gps_vehicles = results.get("noGpsVehicles", [{}])[0].get("count", 0) if results.get("noGpsVehicles") else 0

        # Return the consolidated response
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