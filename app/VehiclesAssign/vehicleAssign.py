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
        company_id = get_jwt_identity().get('company_id')
        vehicles = list(vehicle_collection.find({"CompanyID": company_id}))
        users = list(db['users'].find({"CompanyID": company_id}, {"_id": 1, "username": 1}))

        return render_template('vehicleAssign.html', vehicles=vehicles, users=users)

    elif request.method == 'POST':
        data = request.json
        vehicle_id = data.get('vehicle_id')
        user_ids = data.get('user_ids', [])

        # Update the AssignedUsers field in the vehicle document
        result = vehicle_collection.update_one(
            {"_id": ObjectId(vehicle_id)},
            {"$set": {"AssignedUsers": [ObjectId(user_id) for user_id in user_ids]}}
        )

        if result.modified_count > 0:
            return jsonify({"success": True, "message": "Vehicle assigned successfully!"}), 200
        else:
            return jsonify({"success": False, "message": "Failed to assign vehicle."}), 400