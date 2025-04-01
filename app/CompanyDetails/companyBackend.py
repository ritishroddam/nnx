from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, send_file, Blueprint
from pymongo import MongoClient
from bson.objectid import ObjectId
import pandas as pd
import os
import sys
import re
from app.database import db
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app.models import User
from app.utils import roles_required


company_bp = Blueprint('CompanyDetails', __name__, static_folder='static', template_folder='templates')

customers_collection = db['customers_list']

@company_bp.route('/page')
@jwt_required()
def page():
    customers = list(customers_collection.find())
    return render_template('company.html', customers=customers)

# Route to add a new customer manually
@company_bp.route('/manual_entry', methods=['POST'])
@jwt_required()
def manual_entry():
    customer = {
        'Company Name': request.form.get('CompanyName'),
        'Contact Person': request.form.get('ContactPerson'),
        'Email Address': request.form.get('EmailAddress'),
        'Phone Number': request.form.get('PhoneNumber'),
        'Company Address': request.form.get('CompanyAddress'),
        'Number of GPS Devices': request.form.get('NumberOfGPSDevices'),
        'Number of Vehicles': request.form.get('NumberOfVehicles'),
        'Number of Drivers': request.form.get('NumberOfDrivers'),
        'Payment Status': request.form.get('PaymentStatus'),
        'Support Contact': request.form.get('SupportContact'),
        'Remarks': request.form.get('Remarks'),
    }

    customers_collection.insert_one(customer)
    flash('Customer added successfully!', 'success')
    return redirect(url_for('CompanyDetails.page'))

# Route to upload multiple customers from an Excel file
@company_bp.route('/upload_customers', methods=['POST'])
@jwt_required()
def upload_customers():
    if 'file' not in request.files:
        flash('No file part', 'danger')
        return redirect(url_for('CompanyDetails.page'))

    file = request.files['file']
    if file.filename == '':
        flash('No selected file', 'danger')
        return redirect(url_for('CompanyDetails.page'))

    try:
        df = pd.read_excel(file)

        # Assign unique Company IDs for each record
        records = df.to_dict(orient="records")

        customers_collection.insert_many(records)
        flash('Customers uploaded successfully!', 'success')
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')

    return redirect(url_for('CompanyDetails.page'))

# Route to download the customer template
@company_bp.route('/download_template')
@jwt_required()
def download_template():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(base_dir, 'templates', 'Customer_upload_template.xlsx')
    return send_file(path, as_attachment=True)

# Route to edit customer details
@company_bp.route('/edit_customer/<customer_id>', methods=['POST'])
@jwt_required()
def edit_customer(customer_id):
    try:

        try:
            object_id = ObjectId(customer_id)
        except Exception:
            print("ERROR: Invalid device ID")
            return jsonify({'success': False, 'message': 'Invalid device ID'}), 400

        updated_data = request.json

        # Validation: Ensure required fields are not empty
        required_fields = [
            'Company Name', 'Contact Person', 'Email Address', 
            'Phone Number', 'Company Address'
        ]
        for field in required_fields:
            if not updated_data.get(field):
                return jsonify({'success': False, 'message': f'{field} is required.'}), 400

        # Validation: Email format
        email = updated_data.get('Email Address')
        if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email):
            return jsonify({'success': False, 'message': 'Invalid Email Address format.'}), 400

        # Validation: Phone number length and numeric
        phone = updated_data.get('Phone Number')
        if not phone.isdigit() or len(phone) != 10:
            return jsonify({'success': False, 'message': 'Phone Number must be 10 digits.'}), 400

        # Update the customer in the database
        result = customers_collection.update_one(
            {'_id': ObjectId(object_id)},
            {'$set': updated_data}
        )
        if result.modified_count > 0:
            return jsonify({'success': True, 'message': 'Customer updated successfully!'})
        else:
            return jsonify({'success': False, 'message': 'No changes made.'})
    except Exception as e:
        print(f"Error editing customer: {e}")
        return jsonify({'success': False, 'message': 'Error editing customer.'}), 500

# Route to delete a customer
@company_bp.route('/delete_customer/<customer_id>', methods=['DELETE'])
@jwt_required()
def delete_customer(customer_id):
    try:
        result = customers_collection.delete_one({'_id': ObjectId(customer_id)})
        if result.deleted_count > 0:
            return jsonify({'success': True, 'message': 'Customer deleted successfully!'})
        else:
            return jsonify({'success': False, 'message': 'Customer not found.'})
    except Exception as e:
        print(f"Error deleting customer: {e}")
        return jsonify({'success': False, 'message': 'Error deleting customer.'}), 500
