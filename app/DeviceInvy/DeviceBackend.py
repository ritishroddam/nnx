from curses.ascii import isdigit
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
from datetime import datetime, timezone, timedelta

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
    # Get pagination parameters
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 100))
    skip = (page - 1) * per_page
    
    total_devices = collection.count_documents({})
    devices = list(collection.find({}))
    
    imeiList = [device['IMEI'] for device in devices if 'IMEI' in device]
    
    vehiclesData = vehicle_collection.find(
        {"IMEI": {"$in": imeiList}}, 
        {"_id": 0, "LicensePlateNumber": 1, "CompanyName": 1, "IMEI":1}
    )
    
    VehicleData = {vehicle['IMEI']: vehicle for vehicle in vehiclesData}
    
    for device in devices:
        date = device['LastEditedDate'].astimezone(timezone(timedelta(hours=5, minutes=30)))
        device['LastEditedDate'] = date.strftime('%d-%m-%Y %I:%M %p')
        vehicle = VehicleData.get(device['IMEI']) 
        if not vehicle:
            device['LicensePlateNumber'] = None
            device['CompanyName'] = None
        else:
            device['LicensePlateNumber'] = vehicle['LicensePlateNumber'] if vehicle else None
            device['CompanyName'] = vehicle['CompanyName'] if vehicle else None
    
    return render_template('device.html', devices=devices, total_devices=total_devices, current_page=page, per_page=per_page)

@device_bp.route('/get_devices_paginated')
@jwt_required()
def get_devices_paginated():
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 100))
        skip = (page - 1) * per_page

        # Get total count and paginated devices
        total = collection.count_documents({})
        devices = list(collection.find({}).skip(skip).limit(per_page))
        
        imeiList = [device['IMEI'] for device in devices if 'IMEI' in device]
        
        vehiclesData = vehicle_collection.find(
            {"IMEI": {"$in": imeiList}}, 
            {"_id": 0, "LicensePlateNumber": 1, "CompanyName": 1, "IMEI":1}
        )
        
        VehicleData = {vehicle['IMEI']: vehicle for vehicle in vehiclesData}
        
        for device in devices:
            date = device['LastEditedDate'].astimezone(timezone(timedelta(hours=5, minutes=30)))
            device['LastEditedDate'] = date.strftime('%d-%m-%Y %I:%M %p')
            vehicle = VehicleData.get(device['IMEI']) 
            if not vehicle:
                device['LicensePlateNumber'] = None
                device['CompanyName'] = None
            else:
                device['LicensePlateNumber'] = vehicle['LicensePlateNumber'] if vehicle else None
                device['CompanyName'] = vehicle['CompanyName'] if vehicle else None
            device['_id'] = str(device['_id'])

        return jsonify({
            "total": total,
            "page": page,
            "per_page": per_page,
            "devices": devices
        })
    except Exception as e:
        print(f"Error in get_devices_paginated: {str(e)}", file=sys.stderr)
        return jsonify({"error": str(e)}), 500

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
        
        devices = list(collection.find(query))
        
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
    gl_number = data.get('GLNumber', '')
    if gl_number is None or str(gl_number).strip() == '':
        data.pop('GLNumber', None)
        gl_number = None
    else:
        data['GLNumber'] = str(gl_number).strip()
    
    if not data['IMEI'].isdigit() and len(data['IMEI']) not in [15, 16, 18]:
        flash("Invalid IMEI length", "danger")
        return redirect(url_for('DeviceInvy.page'))

    if not data['DateIn']:
        flash("Purchase Date is required", "danger")
        return redirect(url_for('DeviceInvy.page'))
    
    if not data['DeviceModel']:
        flash("Device Model is required", "danger")
    
    if not data['DeviceMake']:
        flash("Device Make is required", "danger")
        return redirect(url_for('DeviceInvy.page'))
    
    if not data['Package']:
        flash("Package is required", "danger")
        return redirect(url_for('DeviceInvy.page'))
    
    if data['Package'] == 'Package':
        if data['Tenure']:
            flash("Tenure is required when Package is selected for Package Type")
            return redirect(url_for('DeviceInvy.page'))
        
    status = data.get('Status', 'New Stock')
    if status in ['New Stock', 'Available']:
        data['Package'] = 'None'
        data['Tenure'] = None 
    
    if not data['Status']:
        data['Status'] = 'New Stock'
        data['Package'] = 'None'
        data['Tenure'] = None

    # Only check for duplicate IMEI always, and duplicate GLNumber only if provided
    if collection.find_one({"IMEI": data['IMEI']}):
        flash("IMEI already exists", "danger")
        return redirect(url_for('DeviceInvy.page'))
    
    if gl_number:
        if collection.find_one({"GLNumber": gl_number}):
            flash("SL Number already exists", "danger")
            return redirect(url_for('DeviceInvy.page'))
    
    if data.get('OutwardTo'):
        data['Status'] = 'Active'

    package_type = data.get("Package", "")
    tenure = data.get("Tenure", "").strip() if package_type == "Package" else None

    data["Package"] = package_type
    data["Tenure"] = tenure
    
    data['LastEditedBy'] = get_jwt_identity()
    data['LastEditedDate'] = datetime.now(timezone.utc)

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
        imeis = []
        gl_numbers = []
        for index, row in df.iterrows():
            row = row.where(pd.notnull(row), None)
            imei = str(row['IMEI']).strip()
            
            if imei in imeis:
                flash(f"Duplicate IMEI at row {index + 2}", "danger")
                return redirect(url_for('DeviceInvy.page'))
            
            gl_number = row.get('GLNumber', None)
            gl_number = str(gl_number).strip if gl_number else None
            
            
            if not imei or not imei.isdigit() or len(imei) not in [15, 16, 18]:
                flash("Invalid IMEI length", "danger")
                return redirect(url_for('DeviceInvy.page'))
            
            if not row['DateIn']:
                flash(f"Purchase Date is required at row no.: {index + 2}", "danger")
                return redirect(url_for('DeviceInvy.page'))

            if not row['Warranty']:
                flash(f"Warranty is required at row no.: {index + 2}", "danger")
                return redirect(url_for('DeviceInvy.page'))
            
            if not row['DeviceModel']:
                flash(f"Device Model is required at row no.: {index + 2}", "danger")
                return redirect(url_for('DeviceInvy.page'))
            
            if not row['DeviceMake']:
                flash(f"Device Make is required at row no.: {index + 2}", "danger")
                return redirect(url_for('DeviceInvy.page'))

            if not row['Package']:
                flash(f"Package is required at row no.: {index + 2}", "danger")
                return redirect(url_for('DeviceInvy.page'))

            if collection.find_one({"IMEI": imei}):
                flash(f"Duplicate IMEI at row {index + 2}", "danger")
                return redirect(url_for('DeviceInvy.page'))
            
            if gl_number:
                if collection.find_one({"GLNumber": gl_number}):
                    flash(f"Duplicate SL Number at row {index + 2}", "danger")
                    return redirect(url_for('DeviceInvy.page'))
                
            if not row['Status']:
                row['Status'] = 'New Stock'

            package_type = str(row.get("Package", "")).strip()
            tenure = str(row.get("Tenure", "")).strip() if package_type == "Package" else None

            record = {
                "IMEI": imei,
                "DeviceModel": row['DeviceModel'],
                "DeviceMake": row['DeviceMake'],
                "DateIn": str(row['DateIn']).split(' ')[0],
                "Warranty": str(row['Warranty']).split(' ')[0],
                "OutwardTo": row.get('Outward To', ''),
                "Package": package_type,
                "Tenure": tenure,
                "Status": row.get('Status', 'New Stock'),
                "LastEditedBy": get_jwt_identity(), 
                "LastEditedDate": datetime.now(timezone.utc)
            }
            
            if gl_number:
                if gl_number in gl_numbers:
                    flash(f"Duplicate SL Number at row {index + 2}", "danger")
                    return redirect(url_for('DeviceInvy.page'))
                gl_numbers.append(gl_number)                    
                record["GLNumber"] =  gl_number
            
            records.append(record)
            
            imeis.append(imei)

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
    }
    
    devices = list(collection.find({}, projection))
    
    imeiList = [device['IMEI'] for device in devices if 'IMEI' in device]
    
    vehiclesData = vehicle_collection.find(
        {"IMEI": {"$in": imeiList}}, 
        {"_id": 0, "LicensePlateNumber": 1, "CompanyName": 1, "IMEI":1}
    )
    
    VehicleData = {vehicle['IMEI']: vehicle for vehicle in vehiclesData}
    
    for device in devices:
        try:
            vehicle = VehicleData[device['IMEI']]
        except:
            vehicle = None
        if vehicle:
            device['LicensePlateNumber'] = vehicle['LicensePlateNumber']
            device['CompanyName'] = vehicle['CompanyName']
        else:
            device['LicensePlateNumber'] = None
            device['CompanyName'] = None
            

    if not devices:
        return jsonify({"error": "No data available"}), 404

    df = pd.DataFrame(devices)
    
    if 'GLNumber' not in df.columns:
        df['SLNumber'] = ''
    else:
        df = df.rename(columns={
            'GLNumber': 'SLNumber',
        })
    
    df = df.rename(columns={
        'DateIn': 'Purchase Date',
        'OutwardTo': 'Outward/Inward Date',
        'Package': 'Package Type'
    })
    
    if 'LastEditedDate' in df.columns:
        df['LastEditedDate'] = df['LastEditedDate'].apply(
            lambda d: d.astimezone(timezone(timedelta(hours=5, minutes=30))).strftime('%d-%m-%Y %I:%M %p')
            if pd.notnull(d) and hasattr(d, 'astimezone') else ''
        )
        
    column_order = [
        'IMEI',
        'SLNumber',
        'LicensePlateNumber',
        'CompanyName',
        'DeviceModel',
        'DeviceMake',
        'Purchase Date',
        'Warranty',
        'Outward/Inward Date',
        'Package Type',
        'Tenure',
        'Status',
        'LastEditedBy',
        'LastEditedDate',
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

        # Fetch username from JWT
        username = get_jwt_identity() or "Unknown"

        last_edited_date = datetime.now(timezone.utc)
        
        newData = {
                "IMEI": updated_data.get("IMEI"),
                "DeviceModel": updated_data.get("DeviceModel"),
                "DeviceMake": updated_data.get("DeviceMake"),
                "DateIn": updated_data.get("DateIn"),
                "Warranty": updated_data.get("Warranty"),
                "OutwardTo": updated_data.get("OutwardTo"),
                "Package": package_type,
                "Tenure": tenure,
                "Status": updated_data.get("Status"),
                "LastEditedBy": username,
                "LastEditedDate": last_edited_date
            }
        
        if updated_data.get("GLNumber"):
            newData["GLNumber"] = updated_data.get("GLNumber")

        result = collection.update_one(
            {'_id': object_id},
            {'$set': newData}
        )

        print(f"Matched Count: {result.matched_count}, Modified Count: {result.modified_count}")  # Debug log

        if result.matched_count == 0:
            print("ERROR: Device not found in MongoDB.")
            return jsonify({'success': False, 'message': 'Device not found.'})

        if result.modified_count > 0:
            print("SUCCESS: Device updated successfully!")
            return jsonify({
                'success': True,
                'message': 'Device updated successfully!',
                'LastEditedBy': username,
                'LastEditedDate': last_edited_date
            })
        else:
            print("WARNING: No changes made to the device.")
            return jsonify({'success': False, 'message': 'No changes made to the device.'})

    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return jsonify({'success': False, 'message': 'Error updating device.'}), 500
    
@device_bp.route('/device_status_counts')
@jwt_required()
def device_status_counts():
    try:
        pipeline = [
            {"$group": {"_id": "$Status", "count": {"$sum": 1}}}
        ]
        counts = {doc['_id']: doc['count'] for doc in collection.aggregate(pipeline)}
        return jsonify(counts)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@device_bp.route('/device_package_counts')
@jwt_required()
def device_package_counts():
    try:
        pipeline = [
            {"$group": {"_id": "$Package", "count": {"$sum": 1}}}
        ]
        counts = {doc['_id']: doc['count'] for doc in collection.aggregate(pipeline)}
        return jsonify(counts)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@device_bp.route('/device_all_counts')
@jwt_required()
def device_all_counts():
    try:
        # Status counts
        status_pipeline = [{"$group": {"_id": "$Status", "count": {"$sum": 1}}}]
        status_counts = {doc['_id']: doc['count'] for doc in collection.aggregate(status_pipeline)}
        
        # Package counts
        package_pipeline = [{"$group": {"_id": "$Package", "count": {"$sum": 1}}}]
        package_counts = {doc['_id']: doc['count'] for doc in collection.aggregate(package_pipeline)}
        
        return jsonify({
            "status": status_counts,
            "package": package_counts
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500