from flask import Flask, render_template, request, redirect, url_for, jsonify, flash, send_file, Response, Blueprint
from pymongo import MongoClient
from bson.objectid import ObjectId
import pandas as pd
import os
from io import BytesIO
from app.database import db # type: ignore
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt # type: ignore
from app.models import User # type: ignore
from app.utils import roles_required # type: ignore
from datetime import datetime


sim_bp = Blueprint('SimInvy', __name__, static_folder='static', template_folder='templates')

collection = db['sim_inventory']

def format_date(date_str):
    if not date_str:
        return ""
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").strftime("%d-%m-%Y")
    except:
        return date_str

@sim_bp.route('/page')
@jwt_required()
def page():
    # Get all vehicles with SIM and IMEI info
    vehicle_collection = db['vehicle_inventory']
    vehicles = list(vehicle_collection.find({}, {'sim_number': 1, 'imei': 1}))
    
    # Create mapping of SIM numbers to IMEIs
    sim_to_imei = {v['sim_number']: v.get('imei', 'N/A') 
                  for v in vehicles if 'sim_number' in v}
    
    # Get all SIMs and add status/IMEI info
    sims = list(collection.find({}))
    for sim in sims:
        if sim['SimNumber'] in sim_to_imei:
            sim['IMEI'] = sim_to_imei[sim['SimNumber']]
            sim['status'] = 'Allocated'
            sim['isActive'] = True
        else:
            sim.setdefault('status', 'Available')
            sim.setdefault('isActive', True)
            sim.setdefault('lastEditedBy', 'N/A')
    
    return render_template('sim.html', sims=sims)

@sim_bp.route('/get_sims_by_status/<status>')
@jwt_required()
def get_sims_by_status(status):
    # Get all vehicles with their SIM and IMEI info
    vehicle_collection = db['vehicle_inventory']
    vehicles = list(vehicle_collection.find({}, {'sim_number': 1, 'imei': 1}))
    
    # Create mapping of SIM numbers to IMEIs
    sim_to_imei = {v['sim_number']: v.get('imei', 'N/A') 
                  for v in vehicles if 'sim_number' in v}
    
    # Build query based on status
    query = {}
    if status == 'Available':
        query = {'status': 'Available'}
    elif status == 'Allocated':
        query = {'status': 'Allocated'}  # Changed to filter by status directly
    elif status == 'SafeCustody':
        query = {'status': 'SafeCustody'}
    elif status == 'Suspended':
        query = {'status': 'Suspended'}
    elif status == 'All':
        query = {}  # Return all SIMs
    
    # Get SIMs and add IMEI info
    sims = list(collection.find(query))
    for sim in sims:
        sim["_id"] = str(sim["_id"])
        # Add IMEI if SIM is allocated to a vehicle
        if sim['SimNumber'] in sim_to_imei:
            sim['IMEI'] = sim_to_imei[sim['SimNumber']]
    
    return jsonify(sims)

@sim_bp.route('/manual_entry', methods=['POST'])
@jwt_required()
def manual_entry():
    data = request.form.to_dict()

    # Strip any leading/trailing whitespace
    data['MobileNumber'] = data['MobileNumber'].strip()
    data['SimNumber'] = data['SimNumber'].strip()
    data['status'] = 'Available'  # Default status
    data['isActive'] = True  # Default active status

    # Validate alphanumeric and length
    if len(data['MobileNumber']) != 10 :
        flash("The lenght of Mobile Number must be 10", "danger")

        if len(data['SimNumber']) != 20:
            flash("The lenght of SIM Number must be 20", "danger")

        return redirect(url_for('SimInvy.page'))

    if  len(data['SimNumber']) != 20:
        flash("The lenght of SIM Number must be 20", "danger")
        return redirect(url_for('SimInvy.page'))

    # Check if Mobile Number or SIM Number is unique
    if collection.find_one({"MobileNumber": data['MobileNumber']}):
        flash("Mobile Number already exists", "danger")

        if collection.find_one({"SimNumber": data['SimNumber']}):
            flash("SIM Number already exists", "danger")

        return redirect(url_for('SimInvy.page'))

    if collection.find_one({"SimNumber": data['SimNumber']}):
        flash("SIM Number already exists", "danger")
        return redirect(url_for('SimInvy.page'))

    # Insert into MongoDB
    collection.insert_one(data)
    flash("SIM added successfully!", "success")
    return redirect(url_for('SimInvy.page'))

@sim_bp.route('/update_sim_status/<sim_id>', methods=['POST'])
@jwt_required()
def update_sim_status(sim_id):
    try:
        current_user = get_jwt_identity()
        updated_data = request.json
        update_fields = {
            "status": updated_data.get("status"),
            "isActive": updated_data.get("isActive"),
            "lastEditedBy": current_user,
            "lastEditedAt": datetime.datetime.utcnow()
        }
        
        if updated_data.get("status") in ['SafeCustody', 'Suspended']:
            update_fields["statusDate"] = updated_data.get("statusDate")
            if updated_data.get("status") == 'SafeCustody':
                update_fields["reactivationDate"] = updated_data.get("reactivationDate")
        
        result = collection.update_one(
            {'_id': ObjectId(sim_id)},
            {'$set': update_fields}
        )
        
        if result.modified_count > 0:
            return jsonify({'success': True, 'message': 'SIM status updated successfully!'})
        else:
            return jsonify({'success': False, 'message': 'No changes made.'})
    except Exception as e:
        print(f"Error updating SIM status: {e}")
        return jsonify({'success': False, 'message': 'Error updating SIM status.'}), 500

@sim_bp.route('/upload_file', methods=['POST'])
@jwt_required()
def upload_file():
    if 'file' not in request.files:
        flash("No file part", "danger")
        return redirect(url_for('SimInvy.page'))

    file = request.files['file']
    if file.filename == '':
        flash("No selected file", "danger")
        return redirect(url_for('SimInvy.page'))

    if file and (file.filename.endswith('.xls') or file.filename.endswith('.xlsx')):
        df = pd.read_excel(file)

        # Validate data and prepare for MongoDB insertion
        records = []
        for index, row in df.iterrows():
            mobile_number = str(row['MobileNumber']).strip()
            sim_number = str(row['SimNumber']).strip()
            date_in = str(row['DateIn']).split(' ')[0].strip()
            date_out = str(row['DateOut']).split(' ')[0].strip() if not pd.isnull(row['DateOut']) else ""
            vendor = str(row['Vendor']).strip()

            # Perform necessary validations
            if len(mobile_number) != 10:
                flash(f"Invalid Mobile Number length at row {index + 2}, column 'MobileNumber' (Length: {len(mobile_number)})", "danger")
                return redirect(url_for('SimInvy.page'))
            if len(sim_number) != 20:
                flash(f"Invalid SIM Number length at row {index + 2}, column 'SimNumber' (Length: {len(sim_number)})", "danger")
                return redirect(url_for('SimInvy.page'))
            if collection.find_one({"MobileNumber": mobile_number}) or collection.find_one({"SimNumber": sim_number}):
                flash(f"Duplicate Mobile Number or SIM Number at row {index + 2}", "danger")
                return redirect(url_for('SimInvy.page'))

            # Create record to insert
            record = {
                "MobileNumber": mobile_number,
                "SimNumber": sim_number,
                "DateIn": date_in,
                "DateOut": date_out,
                "Vendor": vendor,
            }
            records.append(record)

        # Insert records into MongoDB
        if records:
            collection.insert_many(records)
            flash("File uploaded and SIMs added successfully!", "success")

        return redirect(url_for('SimInvy.page'))
    else:
        flash("Unsupported file format", "danger")
        return redirect(url_for('SimInvy.page'))

@sim_bp.route('/edit_sim/<sim_id>', methods=['POST'])
@jwt_required()
def edit_sim(sim_id):
    try:
        current_user = get_jwt_identity()
        updated_data = request.json
        
        # Convert string boolean to actual boolean
        is_active = updated_data.get('isActive')
        if isinstance(is_active, str):
            is_active = is_active.lower() == 'true'
        
        update_fields = {
            "MobileNumber": updated_data.get("MobileNumber"),
            "SimNumber": updated_data.get("SimNumber"),
            "DateIn": updated_data.get("DateIn"),
            "DateOut": updated_data.get("DateOut"),
            "Vendor": updated_data.get("Vendor"),
            "status": updated_data.get("status"),
            "isActive": is_active,
            "lastEditedBy": updated_data.get("lastEditedBy"),
            "lastEditedAt": datetime.utcnow()
        }
        
        if updated_data.get("status") in ['SafeCustody', 'Suspended']:
            update_fields["statusDate"] = updated_data.get("statusDate")
            if updated_data.get("status") == 'SafeCustody':
                update_fields["reactivationDate"] = updated_data.get("reactivationDate")
        
        result = collection.update_one(
            {'_id': ObjectId(sim_id)},
            {'$set': update_fields}
        )
        
        if result.modified_count > 0:
            return jsonify({'success': True, 'message': 'SIM updated successfully!'})
        else:
            return jsonify({'success': False, 'message': 'No changes made.'})
    except Exception as e:
        print(f"Error editing SIM: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@sim_bp.route('/delete_sim/<sim_id>', methods=['DELETE'])
@jwt_required()
def delete_sim(sim_id):
    try:
        result = collection.delete_one({'_id': ObjectId(sim_id)})
        if result.deleted_count > 0:
            return jsonify({'success': True, 'message': 'SIM deleted successfully!'})
        else:
            return jsonify({'success': False, 'message': 'SIM not found.'})
    except Exception as e:
        print(f"Error deleting SIM: {e}")
        return jsonify({'success': False, 'message': 'Error deleting SIM.'}), 500

@sim_bp.route('/download_template')
@jwt_required()
def download_template():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(base_dir, 'templates', 'sim_inventory_template.xlsx')
    return send_file(path, as_attachment=True)

@sim_bp.route('/download_excel')
@jwt_required()
def download_excel():
    sims = list(collection.find({}, {"_id": 0}))  # Fetch all SIMs (excluding _id)
    
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