from flask import Flask, Blueprint, render_template, request, redirect, url_for, jsonify, flash, send_file
from pymongo import MongoClient
import pandas as pd
import os
import sys
from bson.objectid import ObjectId  # For ObjectId generation

vehicleDetails_bp = Blueprint('VehicleDetails', __name__, static_folder='static', template_folder='templates')

# MongoDB connection
client = MongoClient("mongodb+srv://doadmin:4T81NSqj572g3o9f@db-mongodb-blr1-27716-c2bd0cae.mongo.ondigitalocean.com/admin?tls=true&authSource=admin")
db = client['nnx']
vehicle_collection = db['vehicle_inventory']
sim_collection = db['sim_inventory']


# Home route
@vehicleDetails_bp.route('/page')
def page():
    vehicles = list(vehicle_collection.find({}))
    for vehicle in vehicles:
        vehicle["_id"] = str(vehicle["_id"])  # Convert ObjectId to string for the frontend
    return render_template('vehicleDetails.html', vehicles=vehicles)

# API to fetch IMEI Numbers
@vehicleDetails_bp.route('/get_device_inventory', methods=['GET'])
def get_device_inventory():
    try:
        devices = db['device_inventory'].find({}, {"IMEI": 1, "_id": 0})
        imei_list = [{"imei": device["IMEI"]} for device in devices]
        return jsonify(imei_list), 200
    except Exception as e:
        print(f"Error fetching IMEI data: {e}")
        return jsonify({"error": "Failed to fetch IMEI data"}), 500

@vehicleDetails_bp.route('/get_sim_inventory', methods=['GET'])
def get_sim_inventory():
    try:
        sims = sim_collection.find({}, {"SimNumber": 1, "_id": 0})  # Fetch SimNumber field
        sim_list = [{"sim_number": sim["SimNumber"]} for sim in sims]
        return jsonify(sim_list), 200
    except Exception as e:
        print(f"Error fetching SIM data: {e}")
        return jsonify({"error": "Failed to fetch SIM data"}), 500

# Manual entry route
@vehicleDetails_bp.route('/manual_entry', methods=['POST'])
def manual_entry():
    data = request.form.to_dict()
    data = {key.strip(): value.strip() for key, value in data.items()}  # Clean input

    # Validate required fields
    required_fields = ['LicensePlateNumber', 'IMEI', 'SIM', 'Location']
    for field in required_fields:
        if not data.get(field):
            flash(f"{field} is required.", "danger")
            return redirect(url_for('vehicleDetails.html'))
        
    # Check for duplicates
    duplicate = vehicle_collection.find_one({
        "$or": [
            {"License Plate Number": data["LicensePlateNumber"]},
            {"IMEI Number": data["IMEI"]},
            {"SIM Number": data["SIM"]}
        ]
    })
    if duplicate:
        flash("Duplicate entry found: License Plate Number, IMEI, or SIM already exists.", "danger")
        return redirect(url_for('vehicleDetails.html'))

    duplicate_imei = vehicle_collection.find_one({
        "IMEI": data["IMEI"],
        "LicensePlateNumber": {"$ne": data["LicensePlateNumber"]}
    })
    if duplicate_imei:
        flash(f"IMEI {data['IMEI']} is already allocated to another License Plate Number.", "danger")
        return redirect(url_for('vehicleDetails.html'))

    duplicate_sim = vehicle_collection.find_one({
        "SIM": data["SIM"],
        "LicensePlateNumber": {"$ne": data["LicensePlateNumber"]}
    })
    if duplicate_sim:
        flash(f"SIM {data['SIM']} is already allocated to another License Plate Number.", "danger")
        return redirect(url_for('vehicleDetails.html'))

    # Insert record into MongoDB
    try:
        vehicle_collection.insert_one(data)
        flash("Vehicle added successfully!", "success")
    except Exception as e:
        flash(f"Error adding vehicle: {str(e)}", "danger")

    return redirect(url_for('vehicleDetails.html'))

@vehicleDetails_bp.route('/edit_vehicle/<vehicle_id>', methods=['PATCH'])
def edit_vehicle(vehicle_id):
    try:
        updated_data = request.json

        # Remove empty fields to avoid overwriting existing data with empty strings
        updated_data = {key: value for key, value in updated_data.items() if value.strip()}

        # Validate for duplicates only for IMEI and SIM
        if "IMEI" in updated_data:
            duplicate_imei = vehicle_collection.find_one({
                "IMEI": updated_data["IMEI"],
                "LicensePlateNumber": {"$ne": updated_data.get("LicensePlateNumber", "")},
                "_id": {"$ne": ObjectId(vehicle_id)}  # Exclude the current vehicle
            })
            if duplicate_imei:
                return jsonify({"success": False, "message": f"IMEI {updated_data['IMEI']} is already allocated to another License Plate Number."}), 400

        if "SIM" in updated_data:
            duplicate_sim = vehicle_collection.find_one({
                "SIM": updated_data["SIM"],
                "LicensePlateNumber": {"$ne": updated_data.get("LicensePlateNumber", "")},
                "_id": {"$ne": ObjectId(vehicle_id)}  # Exclude the current vehicle
            })
            if duplicate_sim:
                return jsonify({"success": False, "message": f"SIM {updated_data['SIM']} is already allocated to another License Plate Number."}), 400

        # Update the vehicle record
        result = vehicle_collection.update_one(
            {"_id": ObjectId(vehicle_id)},
            {"$set": updated_data}
        )
        if result.modified_count > 0:
            return jsonify({"success": True, "message": "Vehicle updated successfully!"}), 200
        else:
            return jsonify({"success": False, "message": "No changes were made."}), 400
    except Exception as e:
        return jsonify({"success": False, "message": f"Error updating vehicle: {str(e)}"}), 500


# Delete vehicle route
@vehicleDetails_bp.route('/delete_vehicle/<vehicle_id>', methods=['DELETE'])
def delete_vehicle(vehicle_id):
    try:
        result = vehicle_collection.delete_one({"_id": ObjectId(vehicle_id)})
        if result.deleted_count > 0:
            return jsonify({"success": True, "message": "Vehicle deleted successfully!"}), 200
        else:
            return jsonify({"success": False, "message": "Vehicle not found."}), 404
    except Exception as e:
        return jsonify({"success": False, "message": f"Failed to delete vehicle: {str(e)}"}), 500

# File upload route
@vehicleDetails_bp.route('/upload_vehicle_file', methods=['POST'])
def upload_vehicle_file():
    if 'file' not in request.files:
        flash("No file part", "danger")
        return redirect(url_for('vehicleDetails.html'))

    file = request.files['file']
    if file.filename == '':
        flash("No selected file", "danger")
        return redirect(url_for('vehicleDetails.html'))

    try:
        df = pd.read_excel(file)

        # Map fields
        field_mapping = {
            "LicensePlateNumber": "License Plate Number",
            "IMEI": "IMEI Number",
            "SIM": "SIM Number",
            "VehicleModel": "Vehicle Model",
            "VehicleMake": "Vehicle Make",
            "YearOfManufacture": "Year of Manufacture",
            "DateOfPurchase": "Date of Purchase",
            "InsuranceNumber": "Insurance Number",
            "DriverName": "Driver Name",
            "CurrentStatus": "Current Status",
            "Location": "Location",
            "OdometerReading": "Odometer Reading",
            "ServiceDueDate": "Service Due Date"
        }
        df.rename(columns=field_mapping, inplace=True)

        records = df.to_dict(orient="records")

        vehicle_collection.insert_many(records)
        flash("File uploaded successfully!", "success")
    except Exception as e:
        flash(f"Error uploading file: {str(e)}", "danger")

    return redirect(url_for('vehicleDetails.html'))

# Download template route
@vehicleDetails_bp.route('/download_vehicle_template')
def download_vehicle_template():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(base_dir, 'templates', 'vehicle_upload_template.xlsx')
    return send_file(path, as_attachment=True)






