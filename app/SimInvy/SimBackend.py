from flask import Flask, render_template, request, redirect, url_for, jsonify, flash, send_file, Response, Blueprint
from pymongo import MongoClient
from bson.objectid import ObjectId
import pandas as pd
import os
import sys
from io import BytesIO
from app.database import db
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app.models import User
from app.utils import roles_required


sim_bp = Blueprint('SimInvy', __name__, static_folder='static', template_folder='templates')

collection = db['sim_inventory']

@sim_bp.route('/page')
@jwt_required()
def page():
    sims = list(collection.find({}))
    return render_template('sim.html', sims=sims)

@sim_bp.route('/manual_entry', methods=['POST'])
@jwt_required()
def manual_entry():
    data = request.form.to_dict()

    # Strip any leading/trailing whitespace
    data['MobileNumber'] = data['MobileNumber'].strip()
    data['SimNumber'] = data['SimNumber'].strip()

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
        updated_data = request.json
        result = collection.update_one(
            {'_id': ObjectId(sim_id)},
            {'$set': {
                "MobileNumber": updated_data.get("MobileNumber"),
                "SimNumber": updated_data.get("SimNumber"),
                "DateIn": updated_data.get("DateIn"),
                "DateOut": updated_data.get("DateOut"),
                "Vendor": updated_data.get("Vendor")
            }}
        )
        if result.modified_count > 0:
            return jsonify({'success': True, 'message': 'SIM updated successfully!'})
        else:
            return jsonify({'success': False, 'message': 'No changes made.'})
    except Exception as e:
        print(f"Error editing SIM: {e}")
        return jsonify({'success': False, 'message': 'Error editing SIM.'}), 500

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