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
@roles_required('clientAdmin')  
def assign_vehicles():
    if request.method == 'GET':
        company_id = get_jwt().get('company_id')
        companyName = get_jwt().get('company')
        vehicles = list(vehicle_collection.find({"CompanyName": companyName}))
        users = list(db['users'].find({"company": company_id, "role": "user"}, {"_id": 1, "username": 1}))
        
        assignedData = {}
        
        for user in users:
            assigned_vehicles = list(vehicle_collection.find(
                {
                    "CompanyName": companyName,
                    "AssignedUsers": user["_id"],
                },
                {"_id": 1, "LicensePlateNumber": 1}
            ))
            
            if not assigned_vehicles:
                continue
            for vehicle in assigned_vehicles:
                vehicle["_id"] = str(vehicle["_id"])
            assignedData[str(user["_id"])] = assigned_vehicles

        return render_template('vehicleAssign.html', vehicles=vehicles, users=users, assignedData=assignedData)

    elif request.method == 'POST':
        vehicle_ids = request.form.getlist('vehicle_ids')
        user_id = request.form.get('user_id')
    
        if not vehicle_ids or not user_id:
            flash("Vehicle IDs and User ID are required.", "danger")
            return redirect(url_for('VehicleAssign.assign_vehicles'))
    
        try:
            # 1. Remove this user from all vehicles in this company
            companyName = get_jwt().get('company')
            vehicle_collection.update_many(
                {"CompanyName": companyName, "AssignedUsers": ObjectId(user_id)},
                {"$pull": {"AssignedUsers": ObjectId(user_id)}}
            )
            # 2. Add this user to the selected vehicles
            for vehicle_id in vehicle_ids:
                vehicle_collection.update_one(
                    {"_id": ObjectId(vehicle_id)},
                    {"$addToSet": {"AssignedUsers": ObjectId(user_id)}}
                )
    
            flash("Vehicles assigned successfully!", "success")
            return redirect(url_for('VehicleAssign.assign_vehicles'))
    
        except Exception as e:
            print(f"Error during vehicle assignment: {e}")
            flash("An error occurred during the assignment operation.", "danger")
            return redirect(url_for('VehicleAssign.assign_vehicles'))
        
@vehicleAssign_bp.route('/get_unassigned_vehicles/<user_id>', methods=['GET'])
@jwt_required()
@roles_required('clientAdmin') 
def get_unassigned_vehicles(user_id):
    try:
        companyName = get_jwt().get('company')
        unassigned_vehicles = list(vehicle_collection.find(
            {
                "CompanyName": companyName,
                "$or": [
                    {"AssignedUsers": {"$exists": False}},
                    {"AssignedUsers": {"$not": {"$elemMatch": {"$eq": ObjectId(user_id)}}}}
                ]
            },
            {"_id": 1, "LicensePlateNumber": 1}
        ))
        for vehicle in unassigned_vehicles:
            vehicle["_id"] = str(vehicle["_id"])


        return jsonify({"vehicles": unassigned_vehicles}), 200
    except Exception as e:
        print(f"Error fetching unassigned vehicles: {e}")
        return jsonify({"error": "Failed to fetch unassigned vehicles"}), 500