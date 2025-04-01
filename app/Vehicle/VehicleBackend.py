from flask import Flask, Blueprint, render_template, request, jsonify
from pymongo import MongoClient
from app.database import db
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app.models import User
from app.utils import roles_required
import os


vehicle_bp = Blueprint('Vehicle', __name__, static_folder='static', template_folder='templates')

@vehicle_bp.route('/map')
@jwt_required()
def map():
    return render_template('vehicleMap.html')

collection = db['distinctAtlanta']
vehicle_inventory_collection = db['vehicle_inventory']

@vehicle_bp.route('/api/vehicles', methods=['GET'])
@jwt_required()
def get_vehicles():
    try:
        # Fetch data from the distinctAtlanta collection
        vehicles = list(collection.find())
        
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
