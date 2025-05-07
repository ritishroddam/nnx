from flask import Flask, Blueprint, render_template, request, jsonify, flash
from datetime import datetime, timedelta
from pytz import timezone
from app.database import db
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app.models import User
from app.utils import roles_required
from app.geocoding import geocodeInternal


vehicle_bp = Blueprint('Vehicle', __name__, static_folder='static', template_folder='templates')

@vehicle_bp.route('/map')
@jwt_required()
def map():
    return render_template('vehicleMap.html')

collection = db['distinctAtlanta']
atlanta_collection = db['atlanta']
vehicle_inventory_collection = db['vehicle_inventory']

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
                "imei": {"$in":imei}
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

        allDistances = {item['imei']: item['distance_traveled'] for item in distances}

        return allDistances
    except Exception as e:
        print(f"Error fetching distances for IMEI {imei}: {e}")
        flash("Error fetching distances", "danger")
        return jsonify({"error": str(e)}), 500

@vehicle_bp.route('/api/vehicles', methods=['GET'])
@jwt_required()
@roles_required('admin', 'user', 'clientAdmin')
def get_vehicles():
    try:
        claims = get_jwt()
        user_roles = claims.get('roles', [])
        vehicles = []
        if 'admin' in user_roles:
            # Fetch data from the distinctAtlanta collection
            inventory_data = list(vehicle_inventory_collection.find())
            imei_list = [vehicle.get('IMEI') for vehicle in inventory_data if vehicle.get('IMEI')]
            distances = getVehicleDistances(imei_list)
            
            for vehicle in inventory_data:
                vehicleData = list(collection.find({"imei": vehicle.get('IMEI')}, {'timestamp': 0}))
                for data in vehicleData:
                    data['LicensePlateNumber'] = vehicle.get('LicensePlateNumber', 'Unknown')
                    data['VehicleType'] = vehicle.get('VehicleType', 'Unknown')
                    data['distance'] = round(distances.get(vehicle.get('IMEI'), 0), 2)
                    vehicles.append(data)
        elif 'user' in user_roles:
            userID = claims.get('user_id')
            userCompany = claims.get('company')
            inventory_data = list(vehicle_inventory_collection.find({
                'CompanyName': userCompany,
                'AssignedUsers': {'$in': [userID]}
            }))

            imei_list = [vehicle.get('IMEI') for vehicle in inventory_data if vehicle.get('IMEI')]
            distances = getVehicleDistances(imei_list)
            
            for vehicle in inventory_data:
                vehicleData = list(collection.find({"imei": vehicle.get('IMEI')}, {'timestamp': 0}))
                for data in vehicleData:
                    data['LicensePlateNumber'] = vehicle.get('LicensePlateNumber', 'Unknown')
                    data['VehicleType'] = vehicle.get('VehicleType', 'Unknown')
                    data['distance'] = round(distances.get(vehicle.get('IMEI'), 0), 2)
        else:
            userCompany = claims.get('company')
            inventory_data = list(vehicle_inventory_collection.find({'CompanyName': userCompany}))
            for vehicle in inventory_data:
                vehicleData = list((collection.find({"imei": vehicle.get('IMEI')}, {'timestamp': 0})))

                imei_list = [vehicle.get('IMEI') for vehicle in inventory_data if vehicle.get('IMEI')]
                distances = getVehicleDistances(imei_list)

                for data in vehicleData:  # Iterate over the list of documents
                    data['LicensePlateNumber'] = vehicle.get('LicensePlateNumber', 'Unknown')
                    data['VehicleType'] = vehicle.get('VehicleType', 'Unknown')
                    data['distance'] = round(distances.get(vehicle.get('IMEI'), 0), 2)
                    vehicles.append(data)

        for vehicle in vehicles:
            vehicle['_id'] = str(vehicle['_id'])  

            lat = vehicle.get('latitude')
            lng = vehicle.get('longitude')
            location = geocodeInternal(lat, lng)
            vehicle['location'] = location

        
        return jsonify(vehicles), 200
    except Exception as e:
        print("Error fetching vehicle data:", e)
        return jsonify({'error': str(e)}), 500