from flask import Flask, render_template, request, redirect, url_for, jsonify, flash, send_file, Response
from pymongo import MongoClient
from bson.objectid import ObjectId
import pandas as pd
import os
import sys
from io import BytesIO
from flask import Blueprint, render_template
from app.database import db
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app.models import User
from app.utils import roles_required

from config import config

device_bp = Blueprint('DeviceInvy', __name__, static_folder='static', template_folder='templates')

app = Flask(__name__)
app.config.from_object(config['default'])
config['default'].init_app(app)
app.secret_key = app.config['SECRET_KEY']

collection = db['device_inventory']
vehicle_collection = db['vehicle_inventory']


@device_bp.route('/page')
@jwt_required()
def page():
    devices = list(collection.find({}))
    imeiList = [device['IMEI'] for device in devices if 'IMEI' in device]
    
    vehiclesData = vehicle_collection.find(
        {"IMEI": {"$in": imeiList}}, 
        {"_id": 0, "LicensePlateNumber": 1, "CompanyName": 1, "IMEI":1}
    )
    
    VehicleData = {vehicle['IMEI']: vehicle for vehicle in vehiclesData}
    
    for device in devices:
        vehicle = VehicleData.get(device['IMEI']) 
        if not vehicle:
            device['LicensePlateNumber'] = None
            device['CompanyName'] = None
        else:
            device['LicensePlateNumber'] = vehicle['LicensePlateNumber'] if vehicle else None
            device['CompanyName'] = vehicle['CompanyName'] if vehicle else None
    
    return render_template('device.html', devices=devices)

@device_bp.route('/search_devices')
@jwt_required()
def search_devices():
    try:
        imei_query = request.args.get('imei', '').strip()
        
        if not imei_query:
            return jsonify([])
        
        query = {
            "$or": [
                {"IMEI": imei_query},
                {"IMEI": {"$regex": f"{imei_query}$"}}  
            ]
        }
        
        devices = list(collection.find(query, {"_id": 1, "IMEI": 1, "GLNumber": 1, "DeviceModel": 1, 
                                             "DeviceMake": 1, "DateIn": 1, "Warranty": 1, 
                                             "SentBy": 1, "OutwardTo": 1, "Package": 1, 
                                             "Tenure": 1, "Status": 1}))
        
        if not devices:
            return jsonify([])
            
        imeiList = [device['IMEI'] for device in devices if 'IMEI' in device]
        
        vehiclesData = list(vehicle_collection.find(
            {"IMEI": {"$in": imeiList}}, 
            {"_id": 0, "LicensePlateNumber": 1, "CompanyName": 1, "IMEI":1}
        ))
        
        VehicleData = {vehicle['IMEI']: vehicle for vehicle in vehiclesData}
        
        for device in devices:
            vehicle = VehicleData.get(device['IMEI'], {})
            device['LicensePlateNumber'] = vehicle.get('LicensePlateNumber')
            device['CompanyName'] = vehicle.get('CompanyName')
            device['_id'] = str(device['_id'])
        
        return jsonify(devices)
        
    except Exception as e:
        print(f"Error in search_devices: {str(e)}", file=sys.stderr)
        return jsonify({'error': 'Failed to search devices'}), 500

@device_bp.route('/manual_entry', methods=['POST'])
@jwt_required()
def manual_entry():
    data = request.form.to_dict()
    data['IMEI'] = data['IMEI'].strip()
    data['GLNumber'] = data.get('GLNumber', '').strip() 

    if len(data['IMEI']) != 15:
        flash("Invalid IMEI length", "danger")
        return redirect(url_for('DeviceInvy.page'))

    print (data['GLNumber'])

    if(data['GLNumber'] != ""):
        if collection.find_one({"IMEI": data['IMEI']}) or collection.find_one({"GLNumber": data['GLNumber']}):
            flash("IMEI or GL Number already exists", "danger")
            return redirect(url_for('DeviceInvy.page'))

    if data.get('OutwardTo'):
        data['Status'] = 'Active'

    package_type = data.get("Package", "")
    tenure = data.get("Tenure", "").strip() if package_type == "Package" else None

    data["Package"] = package_type
    data["Tenure"] = tenure

    collection.insert_one(data)
    flash("Device added successfully!", "success")
    return redirect(url_for('DeviceInvy.page'))

@device_bp.route('/download_template')
@jwt_required()
def download_template():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(base_dir, 'templates', 'device_inventory_template.xlsx')
    return send_file(path, as_attachment=True)

@device_bp.route('/upload_file', methods=['POST'])
@jwt_required()
def upload_file():
    if 'file' not in request.files or request.files['file'].filename == '':
        flash("No file selected", "danger")
        return redirect(url_for('DeviceInvy.page'))

    file = request.files['file']
    if file and file.filename.endswith(('.xls', '.xlsx')):
        df = pd.read_excel(file)
        records = []
        for index, row in df.iterrows():
            imei = str(row['IMEI']).strip()
            gl_number = str(row.get('GLNumber', '')).strip() 

            if len(imei) != 15:
                flash(f"Invalid data at row {index + 2}", "danger")
                return redirect(url_for('DeviceInvy.page'))

            if collection.find_one({"IMEI": imei}) or collection.find_one({"GLNumber": gl_number}):
                flash(f"Duplicate data at row {index + 2}", "danger")
                return redirect(url_for('DeviceInvy.page'))

            package_type = str(row.get("Package", "")).strip()
            tenure = str(row.get("Tenure", "")).strip() if package_type == "Package" else None

            record = {
                "IMEI": imei,
                "GLNumber": gl_number,
                "DeviceModel": row['Device Model'],
                "DeviceMake": row['Device Make'],
                "DateIn": str(row['DateIn']).split(' ')[0],
                "Warranty": str(row['Warranty']).split(' ')[0],
                "SentBy": row['Sent By'],
                "OutwardTo": row.get('Outward to', ''),
                "Package": package_type,
                "Tenure": tenure,
                "Status": row.get('Status', 'Inactive'),
            }
            records.append(record)

        if records:
            collection.insert_many(records)
            flash("File uploaded successfully!", "success")
        return redirect(url_for('DeviceInvy.page'))
    else:
        flash("Unsupported file format", "danger")
        return redirect(url_for('DeviceInvy.page'))

@device_bp.route('/download_excel')
@jwt_required()
def download_excel():
    projection = {
        "_id": 0, 
        "IMEI": 1,
        "GLNumber": 1,
        "DeviceModel": 1,
        "DeviceMake": 1,
        "DateIn": 1,
        "Warranty": 1,
        "SentBy": 1,
        "OutwardTo": 1,
        "Package": 1,
        "Tenure": 1,
        "Status": 1
    }
    
    devices = list(collection.find({}, projection))
    
    imeiList = [device['IMEI'] for device in devices if 'IMEI' in device]
    
    vehiclesData = vehicle_collection.find(
        {"IMEI": {"$in": imeiList}}, 
        {"_id": 0, "LicensePlateNumber": 1, "CompanyName": 1, "IMEI":1}
    )
    
    VehicleData = {vehicle['IMEI']: vehicle for vehicle in vehiclesData}
    
    for device in devices:
        vehicle = VehicleData[device['IMEI']]
        device['LicensePlateNumber'] = vehicle['LicensePlateNumber'] if vehicle else None
        device['CompanyName'] = vehicle['CompanyName'] if vehicle else None

    if not devices:
        return jsonify({"error": "No data available"}), 404

    df = pd.DataFrame(devices)
    
    column_order = [
        'IMEI',
        'GLNumber',
        'LicensePlateNumber',
        'CompanyName',
        'DeviceModel',
        'DeviceMake',
        'DateIn',
        'Warranty',
        'SentBy',
        'OutwardTo',
        'Package',
        'Tenure',
        'Status'
    ]
    df = df[column_order]
    
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Devices")
    
    output.seek(0)
    
    return Response(
        output,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment;filename=Device_Inventory.xlsx"}
    )

@device_bp.route('/edit_device/<device_id>', methods=['POST'])
@jwt_required()
def edit_device(device_id):
    try:
        print(f"\n=== DEBUG: Updating device with ID: {device_id} ===") 

        try:
            object_id = ObjectId(device_id)
        except Exception:
            print("ERROR: Invalid device ID")
            return jsonify({'success': False, 'message': 'Invalid device ID'}), 400

        updated_data = request.json
        print("Received Data:", updated_data) 
        
        package_type = updated_data.get("Package", "")
        tenure = updated_data.get("Tenure", "").strip() if package_type == "Package" else None

        result = collection.update_one(
            {'_id': object_id},
            {'$set': {
                "IMEI": updated_data.get("IMEI"),
                "GLNumber": updated_data.get("GLNumber"),
                "DeviceModel": updated_data.get("DeviceModel"),
                "DeviceMake": updated_data.get("DeviceMake"),
                "DateIn": updated_data.get("DateIn"),
                "Warranty": updated_data.get("Warranty"),
                "SentBy": updated_data.get("SentBy"),
                "OutwardTo": updated_data.get("OutwardTo"),
                "Package": package_type,
                "Tenure": tenure,
                "Status": updated_data.get("Status"),
            }}
        )

        print(f"Matched Count: {result.matched_count}, Modified Count: {result.modified_count}")  # Debug log

        if result.matched_count == 0:
            print("ERROR: Device not found in MongoDB.")
            return jsonify({'success': False, 'message': 'Device not found.'})

        if result.modified_count > 0:
            print("SUCCESS: Device updated successfully!")
            return jsonify({'success': True, 'message': 'Device updated successfully!'})
        else:
            print("WARNING: No changes made to the device.")
            return jsonify({'success': False, 'message': 'No changes made to the device.'})

    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return jsonify({'success': False, 'message': 'Error updating device.'}), 500

@device_bp.route('/delete_device/<device_id>', methods=['DELETE'])
@jwt_required()
def delete_device(device_id):
    try:
        result = collection.delete_one({"_id": ObjectId(device_id)})

        if result.deleted_count == 1:
            return jsonify({'success': True, 'message': 'Device deleted successfully'})
        else:
            return jsonify({'success': False, 'message': 'Device not found'}), 404
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500