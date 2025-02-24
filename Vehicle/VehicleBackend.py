from flask import Blueprint, render_template, request, jsonify
from pymongo import MongoClient
import os

vehicle_bp = Blueprint('Vehicle', __name__, static_folder='static', template_folder='templates')

MONGO_URI = os.getenv(
    'MONGO_URI',
    'mongodb+srv://doadmin:4T81NSqj572g3o9f@db-mongodb-blr1-27716-c2bd0cae.mongo.ondigitalocean.com/admin?tls=true&authSource=admin'
)
client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
db = client['nnx']
collection = db['atlanta']

@vehicle_bp.route('/api/vehicle/<imei>', methods=['GET'])
def get_vehicle_data(imei):
    try:
        # Fetch the most recent data for the vehicle based on IMEI
        vehicle_data = collection.find_one({'imei': imei}, sort=[('timestamp', -1)])
        if vehicle_data:
            vehicle_data['_id'] = str(vehicle_data['_id'])  # Convert ObjectId to string
            return jsonify(vehicle_data), 200
        else:
            return jsonify({'error': 'No data found for the specified IMEI'}), 404
    except Exception as e:
        print("Error fetching vehicle data:", e)
        return jsonify({'error': str(e)}), 500

@vehicle_bp.route('/map')
def map():
    return render_template('vehicleMap.html')
