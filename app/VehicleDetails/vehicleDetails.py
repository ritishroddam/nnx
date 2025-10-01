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
company_config_collection = db['company_config']

@vehicleDetails_bp.route('/page')
@jwt_required()
def page():
    vehicles = list(vehicle_collection.find({}))
    
    company_names = set()
    for vehicle in vehicles:
        if 'CompanyName' in vehicle and vehicle['CompanyName']:
            company_names.add(vehicle['CompanyName'])
    
    vehicle_data = []
    for vehicle in vehicles:
        vehicle_dict = dict(vehicle)
        vehicle_dict['_id'] = str(vehicle['_id'])
        vehicle_data.append(vehicle_dict)
    
    companies_data = [{"name": name} for name in sorted(company_names)]
    
    return render_template(
        'vehicleDetails.html',
        vehicles=vehicle_data,
        companies=companies_data
    )

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
        sims = sim_collection.find({}, {"MobileNumber": 1, "_id": 0})
        sim_list = [{"MobileNumber": sim["MobileNumber"]} for sim in sims]

        used_sims = set(vehicle["SIM"] for vehicle in vehicle_collection.find({}, {"SIM": 1, "_id": 0}))

        sim_list = [sim for sim in sim_list if sim["MobileNumber"] not in used_sims]

        return jsonify(sim_list), 200

    except Exception as e:
        print(f"Error fetching SIM data: {e}")
        return jsonify({"error": "Failed to fetch SIM data"}), 500

@vehicleDetails_bp.route('/manual_entry', methods=['POST'])
@jwt_required()
def manual_entry():
    data = request.form.to_dict()
    data = {key.strip(): value.strip() for key, value in data.items()}  
    
    vehicleNumbersDict = vehicle_collection.find({}, {"LicensePlateNumber": 1})
    vehicleNumbersList = [vehicle['LicensePlateNumber'] for vehicle in vehicleNumbersDict]
    
    if data['LicensePlateNumber'] in vehicleNumbersList:
        flash(f"License Plate Number {data['LicensePlateNumber']} already exists", "danger")
        return redirect(url_for('VehicleDetails.page'))
    
    data['CompanyName'] = data.get('CompanyName', '')
    
    company = db['customers_list'].find_one({"Company Name": data.get('CompanyName', '')})
    
    if not company:
        flash("Invalid company name", "danger")
        return redirect(url_for('VehicleDetails.page'))

    required_fields = ['LicensePlateNumber', 'IMEI', 'SIM', 'Location', 'CompanyName', 'VehicleType']
    for field in required_fields:
        if not data.get(field):
            flash(f"{field} is required.", "danger")
            return redirect(url_for('VehicleDetails.page'))

    if data['VehicleType'] in ['bus', "sedan", "hatchback", "suv", "van"] and not data.get('NumberOfSeatsContainer'):
        flash(f"Number of seats is required {data['VehicleType']}.", "danger")
        return redirect(url_for('VehicleDetails.page'))

    companyId = companies_collection.find_one({"Company Name": data['CompanyName']}, {"_id": 1})
    
    if not companyId:
        flash(f"Company {data['CompanyName']} does not exist.", "danger")
        return redirect(url_for('VehicleDetails.page'))
    
    speedConfigs = company_config_collection.find_one({"companyId": companyId['_id']},{"_id": 0, f"{data['VehicleType']}SlowSpeed": 1, f"{data['VehicleType']}NormalSpeed": 1})

    if not speedConfigs:
        data['slowSpeed'] = data['slowSpeed'] if data['slowSpeed'] != '' else "20"
        data['normalSpeed'] = data['normalSpeed'] if data['normalSpeed'] != '' else "60"
    else:
        data['slowSpeed'] = data['slowSpeed'] if data['slowSpeed'] != '' else speedConfigs.get(f"{data['VehicleType']}SlowSpeed", "20")
        data['normalSpeed'] = data['normalSpeed'] if data['normalSpeed'] != '' else speedConfigs.get(f"{data['VehicleType']}NormalSpeed", "60")
    
    location = data['Location'].split(',')
    data['Location'] = f"{location[0].strip()}, {location[1].strip()}"
    
    data.pop('csrf_token', None)
    data.pop('CompanyId', None)
    
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

        updated_data = {key: value for key, value in updated_data.items() if value.strip()}

        if "IMEI" in updated_data:
            duplicate_imei = vehicle_collection.find_one({
                "IMEI": updated_data["IMEI"],
                "LicensePlateNumber": {"$ne": updated_data.get("LicensePlateNumber", "")},
                "_id": {"$ne": ObjectId(vehicle_id)} 
            })
            if duplicate_imei:
                return jsonify({"success": False, "message": f"IMEI {updated_data['IMEI']} is already allocated to another License Plate Number."}), 400

        if "SIM" in updated_data:
            duplicate_sim = vehicle_collection.find_one({
                "SIM": updated_data["SIM"],
                "LicensePlateNumber": {"$ne": updated_data.get("LicensePlateNumber", "")},
                "_id": {"$ne": ObjectId(vehicle_id)}  
            })
            if duplicate_sim:
                return jsonify({"success": False, "message": f"SIM {updated_data['SIM']} is already allocated to another License Plate Number."}), 400

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
            'LicensePlateNumber', 'CompanyName', 'IMEI', 'SIM', 'VehicleType', 'NumberOfSeatsContainer', 'VehicleModel', 'VehicleMake',
            'YearOfManufacture', 'DateOfPurchase', 'InsuranceNumber', 'DriverName',
            'CurrentStatus', 'Location', 'OdometerReading', 'ServiceDueDate'
        ]

        for column in required_columns:
            if column not in df.columns:
                flash(f"Missing required column: {column}", "danger")
                return redirect(url_for('VehicleDetails.page'))

        records = []
        for index, row in df.iterrows():
            license_plate_number = str(row['LicensePlateNumber']).strip()
            companyName = str(row['CompanyName']).strip()
            imei = str(row['IMEI']).strip()
            sim = str(row['SIM']).strip()
            vehicle_type = (str(row['VehicleType']).strip()).lower()
            number_of_seats = str(row['NumberOfSeatsContainer']).strip()
            vehicle_model = str(row['VehicleModel']).strip()
            vehicle_make = str(row['VehicleMake']).strip()
            year_of_manufacture = str(row['YearOfManufacture']).strip()
            if isinstance(row['DateOfPurchase'], pd.Timestamp):
                date_of_purchase = row['DateOfPurchase'].strftime('%Y-%m-%d')
            else:
                date_of_purchase = str(row['DateOfPurchase']).strip()
            insurance_number = str(row['InsuranceNumber']).strip()
            if isinstance(row['InsuranceExpiry'], pd.Timestamp):
                insurance_expiry_date = row['InsuranceExpiry'].strftime('%Y-%m-%d')
            else:
                insurance_expiry_date = str(row['InsuranceExpiry']).strip()
            driver_name = str(row['DriverName']).strip()
            current_status = str(row['CurrentStatus']).strip()
            location = str(row['Location']).strip()
            odometer_reading = str(row['OdometerReading']).strip()
            if isinstance(row['ServiceDueDate'], pd.Timestamp):
                service_due_date = row['ServiceDueDate'].strftime('%Y-%m-%d')
            else:
                service_due_date = str(row['ServiceDueDate']).strip()
            slowSpeed = str(row['slowSpeed']).strip()
            normalSpeed = str(row['normalSpeed']).strip()
            
            if not license_plate_number or not imei or not sim or not location:
                flash(f"For row {index} LicensePlateNumber, IMEI, SIM, and Location are required.", "danger")
                return redirect(url_for('VehicleDetails.page'))

            if vehicle_type not in ['bus', "sedan", "hatchback", "suv", "van", "truck", "bike"]:
                flash(f"For vehicle {license_plate_number} Vehicle Type: {vehicle_type} is invalid.", "danger")
                return redirect(url_for('VehicleDetails.page'))
            
            
            companyId = companies_collection.find_one({"Company Name": companyName}, {"_id": 1})

            if not companyId:
                flash(f"For vehicle {license_plate_number}, The company {companyName} does not exist.", "danger")
                return redirect(url_for('VehicleDetails.page'))
            
            speedConfigs = company_config_collection.find_one({"companyId": companyId['_id']},{"_id": 0, f"{vehicle_type}SlowSpeed": 1, f"{vehicle_type}NormalSpeed": 1})
            print("speed Configs are: ",speedConfigs)
            number_of_seats = number_of_seats if number_of_seats != 'nan' else ""
            vehicle_model = vehicle_model if vehicle_model != 'nan' else ""
            vehicle_make = vehicle_make if vehicle_make != 'nan' else ""
            year_of_manufacture = year_of_manufacture if year_of_manufacture != 'nan' else ""
            date_of_purchase = date_of_purchase if date_of_purchase != 'nan' else ""
            insurance_number = insurance_number if insurance_number != 'nan' else ""
            insurance_expiry_date = insurance_expiry_date if insurance_expiry_date != 'nan' else ""
            driver_name = driver_name if driver_name != 'nan' else ""
            current_status = current_status if current_status != 'nan' else ""
            odometer_reading = odometer_reading if odometer_reading != 'nan' else ""
            service_due_date = service_due_date if service_due_date != 'nan' else ""

            if not speedConfigs:
                slowSpeed = slowSpeed if slowSpeed != 'nan' else "20"
                normalSpeed = normalSpeed if normalSpeed != 'nan' else "60"
            else:
                slowSpeed = slowSpeed if slowSpeed != 'nan' else speedConfigs.get(f"{vehicle_type}SlowSpeed", "20")
                normalSpeed = normalSpeed if normalSpeed != 'nan' else speedConfigs.get(f"{vehicle_type}NormalSpeed", "60")
            
            
            pattern1 = re.compile(r'^[A-Z]{2}\d{2}[A-Z]*\d{4}$')
            pattern2 = re.compile(r'^\d{2}BH\d{4}[A-Z]{1,2}$') 
            if not (pattern1.match(license_plate_number) or pattern2.match(license_plate_number)):
                flash(f"License Plate Number {license_plate_number} is invalid.", "danger")
                return redirect(url_for('VehicleDetails.page'))
            
            company = db['customers_list'].find_one({"Company Name": companyName})
            if not company:
                flash(f"For vehcile {license_plate_number} Company Name invalid", "danger")
                return redirect(url_for('VehicleDetails.page'))

            if not (10 <= len(sim) <= 15):
                flash(f"For vehicle {license_plate_number}, SIM {sim} must be between 10 and 15 characters long.", "danger")
                return redirect(url_for('VehicleDetails.page'))
            
            if vehicle_type in ['bus', "sedan", "hatchback", "suv", "van"]:
                if not number_of_seats:
                    flash(f"For vehicle {license_plate_number}, Number of seats is required for vehicle type: {vehicle_type}.", "danger")
                    return redirect(url_for('VehicleDetails.page'))

            if len(imei) != 15:
                flash(f"For vehicle {license_plate_number}, IMEI {imei} must be 15 characters long.", "danger")
                return redirect(url_for('VehicleDetails.page'))
            
            if vehicle_collection.find_one({"LicensePlateNumber": license_plate_number}):
                flash(f"For vehicle {license_plate_number}, Liscense Plate Number {license_plate_number} already exists", "danger")

            if vehicle_collection.find_one({"IMEI": imei}):
                flash(f"For vehicle {license_plate_number}, IMEI Number {imei} has already been allocated to another License Plate Number", "danger")

                if vehicle_collection.find_one({"SIM": sim}):
                    flash(f"For vehicle {license_plate_number}, Sim Number {sim} has already been allocated to another License Plate Number", "danger")
                    return redirect(url_for('VehicleDetails.page'))

            if vehicle_collection.find_one({"IMEI": imei}):
                flash(f"For vehicle {license_plate_number}, IMEI Number {imei} has already been allocated to another License Plate Number", "danger")

                if vehicle_collection.find_one({"SIM": sim}):
                    flash(f"For vehicle {license_plate_number}, Sim Number {sim} has already been allocated to another License Plate Number", "danger")

                return redirect(url_for('VehicleDetails.page'))
    
            if vehicle_collection.find_one({"SIM": sim}):
                flash(f"For vehicle {license_plate_number}, Sim Number {sim} has already been allocated to another License Plate Number", "danger")
                return redirect(url_for('VehicleDetails.page'))

            record = {
                "LicensePlateNumber": license_plate_number,
                "CompanyName": companyName,
                "IMEI": imei,
                "SIM": sim,
                "VehicleType": vehicle_type,
                "NumberOfSeatsContainer": number_of_seats,
                "VehicleModel": vehicle_model,
                "VehicleMake": vehicle_make,
                "YearOfManufacture": year_of_manufacture,
                "DateOfPurchase": date_of_purchase,
                "InsuranceNumber": insurance_number,
                "InsuranceExpiry": insurance_expiry_date,
                "DriverName": driver_name,
                "CurrentStatus": current_status,
                "Location": location,
                "OdometerReading": odometer_reading,
                "ServiceDueDate": service_due_date,
                "normalSpeed": normalSpeed,
                "slowSpeed": slowSpeed
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

@vehicleDetails_bp.route('/download_vehicle_template')
@jwt_required()
def download_vehicle_template():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(base_dir, 'templates', 'vehicle_upload_template.xlsx')
    return send_file(path, as_attachment=True)

@vehicleDetails_bp.route('/download_excel')
@jwt_required()
def download_excel():
    sims = list(vehicle_collection.find({}, {"_id": 0, "AssignedUsers": 0})) 
    
    if not sims:
        return "No data available", 404

    df = pd.DataFrame(sims)  
    
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="SIM Inventory")

    output.seek(0)

    return Response(
        output,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment;filename=SIM_Inventory.xlsx"}
    )

@vehicleDetails_bp.route('/get_vehicles_paginated')
@jwt_required()
def get_vehicles_paginated():
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 100))
        skip = (page - 1) * per_page

        total = vehicle_collection.count_documents({})
        vehicles = list(vehicle_collection.find({}).skip(skip).limit(per_page))

        for vehicle in vehicles:
            vehicle['_id'] = str(vehicle['_id'])

        return jsonify({
            "total": total,
            "page": page,
            "per_page": per_page,
            "vehicles": vehicles
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


