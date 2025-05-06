from flask import Flask, Blueprint, render_template, request, jsonify, flash
from datetime import datetime, timedelta
from pytz import timezone
from bson.objectid import ObjectId 
from app.database import db
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app.models import User
from app.utils import roles_required
from app.geocoding import geocodeInternal

vehicleAssign_bp = Blueprint('VehicleAssign', __name__, static_folder='static', template_folder='templates')

vehicle_collection = db['vehicle_inventory']

@vehicleAssign_bp.route('/assign_vehicles', methods=['GET', 'POST'])
@jwt_required()
@roles_required('clientAdmin')  # Restrict access to client admins
def assign_vehicles():
    if request.method == 'GET':
        # Fetch vehicles and users belonging to the same company
        company_id = get_jwt().get('company_id')
        companyName = get_jwt().get('company')
        vehicles = list(vehicle_collection.find({"CompanyName": companyName}))
        users = list(db['users'].find({"company": company_id, "role": "user"}, {"_id": 1, "username": 1}))

        return render_template('vehicleAssign.html', vehicles=vehicles, users=users)

    elif request.method == 'POST':
        data = request.json
        vehicle_ids = data.get('vehicle_ids')
        user_ids = data.get('user_ids', [])

        if not vehicle_ids or not user_ids:
            return jsonify({"success": False, "message": "Vehicle IDs and User IDs are required."}), 400

        try:
            for vehicle_id in vehicle_ids:
                result = vehicle_collection.update_one(
                    {"_id": ObjectId(vehicle_id)},
                    {"$set": {"AssignedUsers": [ObjectId(user_id) for user_id in user_ids]}}
                )
                if result.matched_count == 0:
                    return jsonify({"success": False, "message": f"Vehicle with ID {vehicle_id} not found."}), 404

            return jsonify({"success": True, "message": "Vehicles assigned successfully!"}), 200

        except Exception as e:
            # Log the error for debugging purposes
            print(f"Error during vehicle assignment: {e}")
            return jsonify({"success": False, "message": "An error occurred during the assignment operation."}), 500