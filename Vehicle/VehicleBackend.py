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

@vehicle_bp.route('/api/vehicles', methods=['GET'])
def get_vehicles():
    try:
        vehicles = list(collection.find())
        for vehicle in vehicles:
            vehicle['_id'] = str(vehicle['_id'])  # Convert ObjectId to string
        return jsonify(vehicles), 200
    except Exception as e:
        print("Error fetching vehicle data:", e)
        return jsonify({'error': str(e)}), 500