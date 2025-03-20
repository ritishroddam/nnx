from flask import Flask, Blueprint, render_template, request, jsonify
from pymongo import MongoClient
import os

vehicle_bp = Blueprint('Vehicle', __name__, static_folder='static', template_folder='templates')

@vehicle_bp.route('/map')
def map():
    return render_template('vehicleMap.html')

# Initialize MongoDB client
MONGO_URI = os.getenv(
    'MONGO_URI',
    'mongodb+srv://doadmin:4T81NSqj572g3o9f@db-mongodb-blr1-27716-c2bd0cae.mongo.ondigitalocean.com/admin?tls=true&authSource=admin'
)
client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
db = client['nnx']
collection = db['distinctAtlanta']
vehicle_inventory_collection = db['vehicle_inventory']

@vehicle_bp.route('/api/vehicles', methods=['GET'])
def get_vehicles():
    try:
        # Fetch data from the distinctAtlanta collection
        vehicles = list(collection.find())
        
        # Iterate through vehicles and fetch the LicensePlateNumber from vehicle_inventory
        for vehicle in vehicles:
            vehicle['_id'] = str(vehicle['_id'])  # Convert ObjectId to string
            
            # Match IMEI with vehicle_inventory collection
            inventory_data = vehicle_inventory_collection.find_one({'IMEI': vehicle.get('IMEI')})
            print(inventory_data.get('LicensePlateNumber'))
            if inventory_data:
                vehicle['LicensePlateNumber'] = inventory_data.get('LicensePlateNumber', 'Unknown')
            else:
                vehicle['LicensePlateNumber'] = 'Unknown'  # Default if no match is found
            print(vehicle['LicensePlateNumber'])
        
        return jsonify(vehicles), 200
    except Exception as e:
        print("Error fetching vehicle data:", e)
        return jsonify({'error': str(e)}), 500

# def get_vehicles():
    # try:
    #     vehicles = list(collection.find())
    #     for vehicle in vehicles:
    #         vehicle['_id'] = str(vehicle['_id'])  # Convert ObjectId to string
    #     return jsonify(vehicles), 200
    # except Exception as e:
    #     print("Error fetching vehicle data:", e)
    #     return jsonify({'error': str(e)}), 500