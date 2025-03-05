from flask import Blueprint, app, jsonify, render_template, Flask, request, redirect, url_for, session, flash, send_file
from pymongo import MongoClient
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
collection = db['atlanta']


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
        # Aggregation to find the latest speed per IMEI
        pipeline = [
            {"$match": {"speed": {"$exists": True, "$ne": None}}},  # Ignore missing speed
            {"$sort": {"imei": 1, "timestamp": -1}},  # Sort by IMEI and latest timestamp
            {"$group": {
                "_id": "$imei",
                "latest_speed": {"$first": "$speed"}
            }}
        ]
        results = list(db["atlanta"].aggregate(pipeline))
        
        # Debugging logs
        print("Processed Results:", results)

        # If results are empty, return a default response
        if not results:
            return jsonify({
                "total_devices": 0,
                "moving_vehicles": 0,
                "idle_vehicles": 0
            }), 200

        # Calculate counts
        total_devices = len(results)
        moving_vehicles = sum(1 for record in results if float(record["latest_speed"] or 0) > 0)
        idle_vehicles = total_devices - moving_vehicles

        print(f"Total Devices: {total_devices}, Moving: {moving_vehicles}, Idle: {idle_vehicles}")
        
        return jsonify({
            "total_devices": total_devices,
            "moving_vehicles": moving_vehicles,
            "idle_vehicles": idle_vehicles
        }), 200
    except Exception as e:
        print(f"🚨 Error fetching pie chart data: {e}")
        return jsonify({"error": "Failed to fetch pie chart data"}), 500
 