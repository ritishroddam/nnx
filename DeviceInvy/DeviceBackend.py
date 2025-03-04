from flask import Flask, render_template, request, redirect, url_for, jsonify, flash, send_file, Response
from pymongo import MongoClient
from bson.objectid import ObjectId
import pandas as pd
import os
import sys
from io import BytesIO
from flask import Blueprint, render_template

app = Flask(__name__)
app.secret_key = os.urandom(24)  # Needed to use flash

# MongoDB connection
client = MongoClient("mongodb+srv://doadmin:4T81NSqj572g3o9f@db-mongodb-blr1-27716-c2bd0cae.mongo.ondigitalocean.com/admin?tls=true&authSource=admin")
db = client['nnx']
collection = db['device_inventory']

device_bp = Blueprint('DeviceInvy', __name__, static_folder='static', template_folder='templates')

@device_bp.route('/page')
def page():
    return render_template('device.html')

# @device_bp.route('/')
# def index():
#     devices = list(collection.find({}))
#     return render_template('index.html', devices=devices)

@device_bp.route('/manual_entry', methods=['POST'])
def manual_entry():
    data = request.form.to_dict()
    data['IMEI'] = data['IMEI'].strip()
    # data['GLNumber'] = data['GLNumber'].strip()
    data['GLNumber'] = data.get('GLNumber', '').strip()  # Set empty string if missing


    # Validate IMEI length
    if len(data['IMEI']) != 15:
        flash("Invalid IMEI length", "danger")
        return redirect(url_for('index'))

    # Check for duplicate IMEI or GLNumber
    if collection.find_one({"IMEI": data['IMEI']}) or collection.find_one({"GLNumber": data['GLNumber']}):
        flash("IMEI or GL Number already exists", "danger")
        return redirect(url_for('index'))

    # If OutwardTo is filled, set Status to Active
    if data.get('OutwardTo'):
        data['Status'] = 'Active'

    # Handle "Package" and "Tenure"
    package_type = data.get("Package", "")
    tenure = data.get("Tenure", "").strip() if package_type == "Package" else None

    data["Package"] = package_type
    data["Tenure"] = tenure

    collection.insert_one(data)
    flash("Device added successfully!", "success")
    return redirect(url_for('DeviceInvy.page'))

@device_bp.route('/download_template')
def download_template():
    path = r"/root/nnx/DeviceInvy/templates/device_inventory_template.xlsx"
    return send_file(path, as_attachment=True)

@device_bp.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files or request.files['file'].filename == '':
        flash("No file selected", "danger")
        return redirect(url_for('index'))

    file = request.files['file']
    if file and file.filename.endswith(('.xls', '.xlsx')):
        df = pd.read_excel(file)
        records = []
        for index, row in df.iterrows():
            imei = str(row['IMEI']).strip()
            # gl_number = str(row['GLNumber']).strip()
            gl_number = str(row.get('GLNumber', '')).strip()  # Set empty string if missing


            # Validate IMEI length
            if len(imei) != 15:
                flash(f"Invalid data at row {index + 2}", "danger")
                return redirect(url_for('index'))

            # Check for duplicate IMEI or GLNumber
            if collection.find_one({"IMEI": imei}) or collection.find_one({"GLNumber": gl_number}):
                flash(f"Duplicate data at row {index + 2}", "danger")
                return redirect(url_for('index'))

            package_type = str(row.get("Package", "")).strip()
            tenure = str(row.get("Tenure", "")).strip() if package_type == "Package" else None

            record = {
                "IMEI": imei,
                "GLNumber": gl_number,
                "DeviceModel": row['DeviceModel'],
                "DeviceMake": row['DeviceMake'],
                "DateIn": str(row['DateIn']).split(' ')[0],
                "Warranty": str(row['Warranty']).split(' ')[0],
                "SentBy": row['SentBy'],
                "OutwardTo": row.get('OutwardTo', ''),
                "Package": package_type,
                "Tenure": tenure,
                "Status": row.get('Status', 'Inactive'),
            }
            records.append(record)

        if records:
            collection.insert_many(records)
            flash("File uploaded successfully!", "success")
        return redirect(url_for('index'))
    else:
        flash("Unsupported file format", "danger")
        return redirect(url_for('index'))

@device_bp.route('/download_excel')
def download_excel():
    devices = list(collection.find({}, {"_id": 0}))  # Fetch all devices (excluding _id)
    
    if not devices:
        return "No data available", 404

    df = pd.DataFrame(devices)
    
    # Convert DataFrame to Excel
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
def edit_device(device_id):
    try:
        print(f"\n=== DEBUG: Updating device with ID: {device_id} ===")  # Debug log

        # Convert device_id to ObjectId
        try:
            object_id = ObjectId(device_id)
        except Exception:
            print("ERROR: Invalid device ID")
            return jsonify({'success': False, 'message': 'Invalid device ID'}), 400

        updated_data = request.json
        print("Received Data:", updated_data)  # Debug log

        # Ensure "Tenure" is stored only if "Package" is "Package"
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
def delete_device(device_id):
    try:
        result = collection.delete_one({"_id": ObjectId(device_id)})

        if result.deleted_count == 1:
            return jsonify({'success': True, 'message': 'Device deleted successfully'})
        else:
            return jsonify({'success': False, 'message': 'Device not found'}), 404
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

app.register_blueprint(device_bp, url_prefix='/deviceInvy')