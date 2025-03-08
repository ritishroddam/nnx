from flask import Flask, Blueprint, render_template, request, redirect, url_for, jsonify, flash, send_file, Response
from pymongo import MongoClient
import pandas as pd
import os
import sys
from bson.objectid import ObjectId  # For ObjectId generation
from io import BytesIO

vehicleDetails_bp = Blueprint('VehicleDetails', __name__, static_folder='static', template_folder='templates')

# MongoDB connection
client = MongoClient("mongodb+srv://doadmin:4T81NSqj572g3o9f@db-mongodb-blr1-27716-c2bd0cae.mongo.ondigitalocean.com/admin?tls=true&authSource=admin")
db = client['nnx']
vehicle_collection = db['vehicle_inventory']
sim_collection = db['sim_inventory']
device_collection = db['device_inventory']

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
        devices = device_collection.find({}, {"IMEI": 1, "_id": 0})
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
            return redirect(url_for('VehicleDetails.page'))
        
    if vehicle_collection.find_one({"LicensePlateNumber": data['LicensePlateNumber']}):
        flash("Liscense Plate Number already exists", "danger")

        if vehicle_collection.find_one({"IMEI": data['IMEI']}):
            flash("IMEI Number has already been allocated to another License Plate Number", "danger")

            if vehicle_collection.find_one({"SIM": data['SIM']}):
                flash("Sim Number has already been allocated to another License Plate Number", "danger")

        return redirect(url_for('VehicleDetails.page'))

    if vehicle_collection.find_one({"IMEI": data['IMEI']}):
        flash("IMEI Number has already been allocated to another License Plate Number", "danger")

        if vehicle_collection.find_one({"SIM": data['SIM']}):
            flash("Sim Number has already been allocated to another License Plate Number", "danger")

        return redirect(url_for('VehicleDetails.page'))
    
    if vehicle_collection.find_one({"SIM": data['SIM']}):
        flash("Sim Number has already been allocated to another License Plate Number", "danger")

        return redirect(url_for('SimInvy.page'))
        
    # Insert record into MongoDB
    try:
        vehicle_collection.insert_one(data)
        flash("Vehicle added successfully!", "success")
    except Exception as e:
        flash(f"Error adding vehicle: {str(e)}", "danger")

    return redirect(url_for('VehicleDetails.page'))

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
        return redirect(url_for('VehicleDetails.page'))

    file = request.files['file']
    if file.filename == '':
        flash("No selected file", "danger")
        return redirect(url_for('VehicleDetails.page'))

    try:
        df = pd.read_excel(file)

        required_columns = [
            'LicensePlateNumber', 'IMEI', 'SIM', 'VehicleModel', 'VehicleMake',
            'YearOfManufacture', 'DateOfPurchase', 'InsuranceNumber', 'DriverName',
            'CurrentStatus', 'Location', 'OdometerReading', 'ServiceDueDate'
        ]

        # Check if all required columns are present
        for column in required_columns:
            if column not in df.columns:
                flash(f"Missing required column: {column}", "danger")
                return redirect(url_for('VehicleDetails.page'))

        records = []
        for index, row in df.iterrows():
            license_plate_number = str(row['LicensePlateNumber']).strip()
            imei = str(row['IMEI']).strip()
            sim = str(row['SIM']).strip()
            vehicle_model = str(row['VehicleModel']).strip()
            vehicle_make = str(row['VehicleMake']).strip()
            year_of_manufacture = str(row['YearOfManufacture']).strip()
            date_of_purchase = str(row['DateOfPurchase']).strip()
            insurance_number = str(row['InsuranceNumber']).strip()
            driver_name = str(row['DriverName']).strip()
            current_status = str(row['CurrentStatus']).strip()
            location = str(row['Location']).strip()
            odometer_reading = str(row['OdometerReading']).strip()
            service_due_date = str(row['ServiceDueDate']).strip()



            record = {
                "LicensePlateNumber": license_plate_number,
                "IMEI": imei,
                "SIM": sim,
                "VehicleModel": vehicle_model,
                "VehicleMake": vehicle_make,
                "YearOfManufacture": year_of_manufacture,
                "DateOfPurchase": date_of_purchase,
                "InsuranceNumber": insurance_number,
                "DriverName": driver_name,
                "CurrentStatus": current_status,
                "Location": location,
                "OdometerReading": odometer_reading,
                "ServiceDueDate": service_due_date,
            }

            records.append(record)

        if records:
            vehicle_collection.insert_many(records)
            flash("File uploaded and SIMs added successfully!", "success")
        else:
            flash("No records found in the file", "danger")

        return redirect(url_for('VehicleDetails.page'))

    except Exception as e:
        flash(f"Error uploading file: {str(e)}", "danger")
        print(e)
        return redirect(url_for('VehicleDetails.page'))

# Download template route
@vehicleDetails_bp.route('/download_vehicle_template')
def download_vehicle_template():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(base_dir, 'templates', 'vehicle_upload_template.xlsx')
    return send_file(path, as_attachment=True)

@vehicleDetails_bp.route('/download_excel')
def download_excel():
    sims = list(vehicle_collection.find({}, {"_id": 0}))  # Fetch all SIMs (excluding _id)
    
    if not sims:
        return "No data available", 404

    df = pd.DataFrame(sims)  # Convert MongoDB data to DataFrame
    
    # Convert DataFrame to Excel
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="SIM Inventory")

    output.seek(0)

    return Response(
        output,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment;filename=SIM_Inventory.xlsx"}
    )






