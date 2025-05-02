from flask import Flask, Blueprint, render_template, request, jsonify, flash
from pymongo import MongoClient
from datetime import datetime, timedelta
import os
from pytz import timezone
from app.database import db
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app.models import User
from app.utils import roles_required
from app.geocoding import geocodeInternal, nmea_to_decimal


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
        utc_now = datetime.now(timezone('UTC'))
        start_of_day = utc_now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = utc_now.replace(hour=23, minute=59, second=59, microsecond=999999)
        pipeline = [
            {"$match": {
                "date_time": {
                    "$gte": start_of_day,
                    "$lt": end_of_day
                },
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

        if distances:  # Check if the list is not empty
            distance = distances[0]['distance_traveled']  # Access the first document
            return jsonify({"distance_traveled": distance}), 200
        else:
            return jsonify({"distance_traveled": 0}), 200  # No data found

        return jsonify(distances), 200
    except Exception as e:
        print(f"Error fetching distances for IMEI {imei}: {e}")
        flash("Error fetching distances", "danger")
        return jsonify({"error": str(e)}), 500

@vehicle_bp.route('/api/vehicles', methods=['GET'])
@jwt_required()
def get_vehicles():
    try:
        claims = get_jwt()
        user_roles = claims.get('roles', [])
        vehicles = []
        if 'admin' in user_roles:
            # Fetch data from the distinctAtlanta collection
            inventory_data = list(vehicle_inventory_collection.find())
            for vehicle in inventory_data:
                vehicleData = list(collection.find({"imei": vehicle.get('IMEI')}, {'timestamp': 0}))
                for data in vehicleData:  # Iterate over the list of documents
                    data['LicensePlateNumber'] = vehicle.get('LicensePlateNumber', 'Unknown')
                    data['VehicleType'] = vehicle.get('VehicleType', 'Unknown')
                    vehicles.append(data)
        else:
            userCompany = claims.get('company')
            userRole = claims.get('role')
            inventory_data = list(vehicle_inventory_collection.find({'CompanyName': userCompany}))
            for vehicle in inventory_data:
                vehicleData = list((collection.find({"imei": vehicle.get('IMEI')}, {'timestamp': 0})))
                for data in vehicleData:  # Iterate over the list of documents
                    data['LicensePlateNumber'] = vehicle.get('LicensePlateNumber', 'Unknown')
                    data['VehicleType'] = vehicle.get('VehicleType', 'Unknown')
                    vehicles.append(data)

        # Iterate through vehicles and fetch the LicensePlateNumber from vehicle_inventory
        for vehicle in vehicles:
            vehicle['_id'] = str(vehicle['_id'])  # Convert ObjectId to string
            
            if vehicle['latitude'] != "" and vehicle['longitude'] != "":
                lat = nmea_to_decimal(vehicle['latitude'])
                lng = nmea_to_decimal(vehicle['longitude'])

                location = geocodeInternal(lat, lng)
                vehicle['location'] = location

        
        return jsonify(vehicles), 200
    except Exception as e:
        print("Error fetching vehicle data:", e)
        return jsonify({'error': str(e)}), 500