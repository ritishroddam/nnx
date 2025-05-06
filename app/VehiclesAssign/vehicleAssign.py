from flask import Flask, Blueprint, render_template, request, jsonify, flash, redirect, url_for
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
        vehicle_ids = request.form.getlist('vehicle_ids')
        user_ids = request.form.getlist('user_ids')

        if not vehicle_ids or not user_ids:
            flash("Vehicle IDs and User IDs are required.", "danger")
            return redirect(url_for('VehicleAssign.assign_vehicles'))

        try:
            for vehicle_id in vehicle_ids:
                result = vehicle_collection.update_one(
                    {"_id": ObjectId(vehicle_id)},
                    {"$set": {"AssignedUsers": [ObjectId(user_id) for user_id in user_ids]}}
                )
                if result.matched_count == 0:
                    flash(f"Vehicle with ID {vehicle_id} not found.", "danger")
                    return redirect(url_for('VehicleAssign.assign_vehicles'))

            flash("Vehicles assigned successfully!", "success")
            return redirect(url_for('VehicleAssign.assign_vehicles'))

        except Exception as e:
            # Log the error for debugging purposes
            print(f"Error during vehicle assignment: {e}")
            flash("An error occurred during the assignment operation.", "danger")
            return redirect(url_for('VehicleAssign.assign_vehicles'))