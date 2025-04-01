from flask import Flask, Blueprint, render_template, request, redirect, url_for, jsonify, flash, send_file, Response
from pymongo import MongoClient
import pandas as pd
import os
import re
import sys
from bson.objectid import ObjectId  # For ObjectId generation
from io import BytesIO
from app.database import db
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app.models import User
from app.utils import roles_required

vehicleDetails_bp = Blueprint('VehicleDetails', __name__, static_folder='static', template_folder='templates')

vehicle_collection = db['vehicle_inventory']
sim_collection = db['sim_inventory']
device_collection = db['device_inventory']
companies_collection = db['customers_list']
cities_collection = db['cities']

# Home route
@vehicleDetails_bp.route('/page')
@jwt_required()
def page():
    vehicles = list(vehicle_collection.find({}))
    for vehicle in vehicles:
        vehicle["_id"] = str(vehicle["_id"])  # Convert ObjectId to string for the frontend
    return render_template('vehicleDetails.html', vehicles=vehicles)

# API to fetch IMEI Numbers
@vehicleDetails_bp.route('/get_device_inventory', methods=['GET'])
@jwt_required()
def get_device_inventory():
    try:
        devices = device_collection.find({}, {"IMEI": 1, "_id": 0})
        imei_list = [{"imei": device["IMEI"]} for device in devices]


        used_imeis = set(vehicle["IMEI"] for vehicle in vehicle_collection.find({}, {"IMEI": 1, "_id": 0}))


        imei_list = [imei for imei in imei_list if imei["imei"] not in used_imeis]

        return jsonify(imei_list), 200
    except Exception as e:
        print(f"Error fetching IMEI data: {e}")
        return jsonify({"error": "Failed to fetch IMEI data"}), 500
    
@vehicleDetails_bp.route('/get_companies', methods=['GET'])
@jwt_required()
def get_companies():
    try:
        companies = list(companies_collection.find({}, {"_id": 1, "Company Name": 1}))
        print(f"Companies fetched: {companies}")  # Debug print
        company_list = [{"id": str(company["_id"]), "name": company["Company Name"]} for company in companies]
        return jsonify(company_list), 200
    except Exception as e:
        print(f"Error fetching companies: {e}")
        return jsonify({"error": "Failed to fetch companies"}), 500
    
@vehicleDetails_bp.route('/get_cities', methods=['GET'])
@jwt_required()
def get_cities():
    try:
        cities = list(cities_collection.find({}, {"_id": 0, "name": 1, "state_name": 1}))
        city_list = [{"city": city["name"], "state": city["state_name"]} for city in cities]
        return jsonify(city_list), 200
    except Exception as e:
        print(f"Error fetching cities: {e}")
        return jsonify({"error": "Failed to fetch cities"}), 500

@vehicleDetails_bp.route('/get_sim_inventory', methods=['GET'])
@jwt_required()
def get_sim_inventory():
    try:
        sims = sim_collection.find({}, {"SimNumber": 1, "_id": 0})
        sim_list = [{"sim_number": sim["SimNumber"]} for sim in sims]

        used_sims = set(vehicle["SIM"] for vehicle in vehicle_collection.find({}, {"SIM": 1, "_id": 0}))

        sim_list = [sim for sim in sim_list if sim["sim_number"] not in used_sims]

        return jsonify(sim_list), 200

    except Exception as e:
        print(f"Error fetching SIM data: {e}")
        return jsonify({"error": "Failed to fetch SIM data"}), 500

@vehicleDetails_bp.route('/manual_entry', methods=['POST'])
@jwt_required()
def manual_entry():
    data = request.form.to_dict()
    data = {key.strip(): value.strip() for key, value in data.items()}  # Clean input

    # Validate required fields
    required_fields = ['LicensePlateNumber', 'IMEI', 'SIM', 'Location', 'CompanyID', 'VehicleType']
    for field in required_fields:
        if not data.get(field):
            flash(f"{field} is required.", "danger")
            return redirect(url_for('VehicleDetails.page'))

    # Additional validation for number of seats
    if data['VehicleType'] in ['bus', 'car'] and not data.get('NumberOfSeats'):
        flash("Number of seats is required for bus and car.", "danger")
        return redirect(url_for('VehicleDetails.page'))

    # ...existing validation code...

    # Save city and state in the same column
    location = data['Location'].split(',')
    data['Location'] = f"{location[0].strip()}, {location[1].strip()}"
    
    try:
        vehicle_collection.insert_one(data)
        flash("Vehicle added successfully!", "success")
    except Exception as e:
        flash(f"Error adding vehicle: {str(e)}", "danger")

    return redirect(url_for('VehicleDetails.page'))

@vehicleDetails_bp.route('/edit_vehicle/<vehicle_id>', methods=['PATCH'])
@jwt_required()
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
@jwt_required()
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
@jwt_required()
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

            vehicle_model = vehicle_model if vehicle_model != 'nan' else ""
            vehicle_make = vehicle_make if vehicle_make != 'nan' else ""
            year_of_manufacture = year_of_manufacture if year_of_manufacture != 'nan' else ""
            date_of_purchase = date_of_purchase if date_of_purchase != 'nan' else ""
            insurance_number = insurance_number if insurance_number != 'nan' else ""
            driver_name = driver_name if driver_name != 'nan' else ""
            current_status = current_status if current_status != 'nan' else ""
            odometer_reading = odometer_reading if odometer_reading != 'nan' else ""
            service_due_date = service_due_date if service_due_date != 'nan' else ""

            if not license_plate_number or not imei or not sim or not location:
                flash(f"For row {row} LicensePlateNumber, IMEI, SIM, and Location are required.", "danger")
                return redirect(url_for('VehicleDetails.page'))
            
            pattern1 = re.compile(r'^[A-Z]{2}\d{2}[A-Z]*\d{4}$')
            pattern2 = re.compile(r'^\d{2}BH\d{4}[A-Z]{2}$')
            if not (pattern1.match(license_plate_number) or pattern2.match(license_plate_number)):
                flash(f"License Plate Number {license_plate_number} is invalid.", "danger")
                return redirect(url_for('VehicleDetails.page'))

            # Validate length of SIM and IMEI
            if len(sim) != 20:
                flash(f"SIM {sim} must be 20 characters long.", "danger")
                return redirect(url_for('VehicleDetails.page'))

            if len(imei) != 15:
                flash(f"IMEI {imei} must be 15 characters long.", "danger")
                return redirect(url_for('VehicleDetails.page'))
            
            if vehicle_collection.find_one({"LicensePlateNumber": license_plate_number}):
                flash(f"Liscense Plate Number {license_plate_number} already exists", "danger")

            if vehicle_collection.find_one({"IMEI": imei}):
                flash(f"IMEI Number {imei} has already been allocated to another License Plate Number", "danger")

                if vehicle_collection.find_one({"SIM": sim}):
                    flash(f"Sim Number {sim} has already been allocated to another License Plate Number", "danger")
                    return redirect(url_for('VehicleDetails.page'))

            if vehicle_collection.find_one({"IMEI": imei}):
                flash(f"IMEI Number {imei} has already been allocated to another License Plate Number", "danger")

                if vehicle_collection.find_one({"SIM": sim}):
                    flash(f"Sim Number {sim} has already been allocated to another License Plate Number", "danger")

                return redirect(url_for('VehicleDetails.page'))
    
            if vehicle_collection.find_one({"SIM": sim}):
                flash(f"Sim Number {sim} has already been allocated to another License Plate Number", "danger")
                return redirect(url_for('VehicleDetails.page'))
        

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
@jwt_required()
def download_vehicle_template():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(base_dir, 'templates', 'vehicle_upload_template.xlsx')
    return send_file(path, as_attachment=True)

@vehicleDetails_bp.route('/download_excel')
@jwt_required()
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






