from flask import Flask, Blueprint, render_template, request, jsonify, flash
from pymongo import MongoClient
from app.database import db
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app.models import User
from app.utils import roles_required
from datetime import datetime, timedelta
import os


vehicle_bp = Blueprint('Vehicle', __name__, static_folder='static', template_folder='templates')

@vehicle_bp.route('/map')
@jwt_required()
def map():
    return render_template('vehicleMap.html')

collection = db['distinctAtlanta']
atlanta_collection = db['atlanta']
vehicle_inventory_collection = db['vehicle_inventory']

@vehicle_bp.route('/getVehiclesDistances/<imei>', methods=['GET'])
@jwt_required()
def getVehicleDistances(imei):
    try:
        today_str = datetime.now().strftime('%d%m%y')
        pipeline = [
            {"$match": {
                "date": today_str,
                "imei": imei
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
            }}
        ]

        distances = list(atlanta_collection.aggregate(pipeline))

        distance = distances['distance_traveled']

        return jsonify(distances), 200
    except Exception as e:
        print(f"Error fetching distances for IMEI {imei}: {e}")
        flash("Error fetching distances", "danger")
        return jsonify({"error": str(e)}), 500

@vehicle_bp.route('/api/vehicles', methods=['GET'])
@jwt_required()
def get_vehicles():
    try:
        # Fetch data from the distinctAtlanta collection
        vehicles = list(collection.find({},{'timestamp': 0}))
        
        # Iterate through vehicles and fetch the LicensePlateNumber from vehicle_inventory
        for vehicle in vehicles:
            vehicle['_id'] = str(vehicle['_id'])  # Convert ObjectId to string
            
            # Match IMEI with vehicle_inventory collection
            inventory_data = vehicle_inventory_collection.find_one({'IMEI': vehicle.get('imei')})
            if inventory_data:
                vehicle['LicensePlateNumber'] = inventory_data.get('LicensePlateNumber', 'Unknown')
                vehicle['VehicleType'] = inventory_data.get('VehicleType', 'Unknown')   
            else:
                vehicle['LicensePlateNumber'] = 'Unknown'  # Default if no match is found
                vehicle['VehicleType'] = 'Unknown'
        
        return jsonify(vehicles), 200
    except Exception as e:
        print("Error fetching vehicle data:", e)
        return jsonify({'error': str(e)}), 500