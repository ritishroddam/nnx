from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, send_file, Blueprint
from bson.objectid import ObjectId
import pandas as pd
import os
import gridfs
import re
from app.database import db
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app.models import User
from app.utils import roles_required

company_bp = Blueprint('CompanyDetails', __name__, static_folder='static', template_folder='templates')

customers_collection = db['customers_list']

fs = gridfs.GridFS(db)

@company_bp.route('/page')
@jwt_required()
def page():
    customers = list(customers_collection.find())
    unique_companies = customers_collection.distinct('Company Name')
    for company in customers:
        company.pop('companyLogo', None)
    return render_template('company.html', customers=customers, unique_companies=unique_companies)

@company_bp.route('/manual_entry', methods=['POST'])
@jwt_required()
def manual_entry():

    companyLogo = request.files.get('CompanyLogo')
    companyName = request.form.get('CompanyName')
    
    if companyName:
        isCompany = customers_collection.find_one({
            'Company Name':  {'$regex': f'^{re.escape(str(companyName))}$', '$options': 'i'}
        })
        if isCompany:
            flash(f"Company {companyName} already exists!")
            return redirect(url_for('CompanyDetails.page'))
    
    if companyLogo:
        logo_id = fs.put(
            companyLogo.stream,
            filename=f"{companyName}Logo",
            content_type=companyLogo.content_type
        )
    else:
        logo_id = ObjectId("683970cc1ae3f41668357362")
    
    required_fields = [
        'CompanyName', 'ContactPerson', 'EmailAddress',
        'PhoneNumber', 'CompanyAddress'
    ]
    
    for field in required_fields:
        if not request.form.get(field):
            flash(f'{field} is required.', 'danger')
            return redirect(url_for('CompanyDetails.page'))

    email = request.form.get('EmailAddress')
    if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email):
        flash('Invalid Email Address format.', 'danger')
        return redirect(url_for('CompanyDetails.page'))

    phone = request.form.get('PhoneNumber')
    if not phone.isdigit() or len(phone) != 10:
        flash('Phone Number must be 10 digits.', 'danger')
        return redirect(url_for('CompanyDetails.page'))

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
        'lat': request.form.get('lat'),
        'lng': request.form.get('lng'),
        "companyLogo": logo_id,
    }

    customers_collection.insert_one(customer)
    flash('Customer added successfully!', 'success')
    return redirect(url_for('CompanyDetails.page'))

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
        
        df.columns = [str(c).strip() for c in df.columns]
        required_headers = [
            'Company Name', 'Contact Person', 'Email Address', 'Phone Number', 'Company Address',
            'Number of GPS Devices', 'Number of Vehicles', 'Number of Drivers',
            'Payment Status', 'Support Contact', 'Remarks', 'lat', 'lng'
        ]
        missing_headers = [h for h in required_headers if h not in df.columns]
        if missing_headers:
            flash(f"Missing required columns: {', '.join(missing_headers)}", 'danger')
            return redirect(url_for('CompanyDetails.page'))

        # Replace NaN/None with empty string
        df = df.fillna("")

        logo_id = ObjectId("683970cc1ae3f41668357362")

        if 'lat' in df.columns:
            df['lat'] = df['lat'].astype(str)
        if 'lng' in df.columns:
            df['lng'] = df['lng'].astype(str)

        records = df.to_dict(orient="records")

        required_fields = [
            'Company Name', 'Contact Person', 'Email Address',
            'Phone Number', 'Company Address'
        ]

        errors = []
        valid_records = []
        for record in records:
            companyName = record['Company Name']
            if companyName:
                isCompany = customers_collection.find_one({
                    'Company Name':  {'$regex': f'^{re.escape(str(companyName))}$', '$options': 'i'}
                })
                if isCompany:
                    errors.append(f"Row {row_num}: Company {companyName} already exists!")
                    continue
            
            record['companyLogo'] = logo_id
            # Ensure required fields are present and not empty
            row_num = records.index(record) + 2  # +2 for header and 0-indexing
            missing_fields = [field for field in required_fields if not record.get(field, "")]
            if missing_fields:
                errors.append(f"Row {row_num}: Missing required fields: {', '.join(missing_fields)}")
                continue
            
            email = record.get('Email Address', "")
            if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email):
                errors.append(f"Row {row_num}: Invalid Email Address format.")
                continue
            
            phone = str(record.get('Phone Number', ""))
            if not phone.isdigit() or len(phone) != 10:
                errors.append(f"Row {row_num}: Phone Number must be 10 digits.")
                continue  
            
            if all(record.get(field, "") != "" for field in required_fields):
                customer = {
                    'Company Name': record.get('Company Name', ""),
                    'Contact Person': record.get('Contact Person', ""),
                    'Email Address': record.get('Email Address', ""),
                    'Phone Number': str(record.get('Phone Number', "")),
                    'Company Address': record.get('Company Address', ""),
                    'Number of GPS Devices': record.get('Number of GPS Devices', ""),
                    'Number of Vehicles': record.get('Number of Vehicles', ""),
                    'Number of Drivers': record.get('Number of Drivers', ""),
                    'Payment Status': record.get('Payment Status', ""),
                    'Support Contact': record.get('Support Contact', ""),
                    'Remarks': record.get('Remarks', ""),
                    'lat': record.get('lat', ""),
                    'lng': record.get('lng', ""),
                    "companyLogo": logo_id,
                }
                valid_records.append(customer)
                
            

        if not valid_records:
            flash('No valid records to upload. Required fields missing.', 'danger')
        else:
            customers_collection.insert_many(valid_records)
            flash('Customers uploaded successfully!', 'success')
        
        for msg in errors[:10]:
            flash(msg, 'danger')
        if len(errors) > 10:
                flash(f"And {len(errors) - 10} more errors. Please fix and re-upload.", 'danger')
        
    except Exception as e:
        print(e)
        flash(f'Error: {str(e)}', 'danger')

    return redirect(url_for('CompanyDetails.page'))

@company_bp.route('/download_template')
@jwt_required()
def download_template():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(base_dir, 'templates', 'Customer_upload_template.xlsx')
    return send_file(path, as_attachment=True)

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

        required_fields = [
            'Company Name', 'Contact Person', 'Email Address', 
            'Phone Number', 'Company Address'
        ]
        for field in required_fields:
            if not updated_data.get(field):
                return jsonify({'success': False, 'message': f'{field} is required.'}), 400

        email = updated_data.get('Email Address')
        if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email):
            return jsonify({'success': False, 'message': 'Invalid Email Address format.'}), 400

        phone = updated_data.get('Phone Number')
        if not phone.isdigit() or len(phone) != 10:
            return jsonify({'success': False, 'message': 'Phone Number must be 10 digits.'}), 400

        result = customers_collection.update_one(
            {'_id': object_id},   # fixed: do not wrap ObjectId again
            {'$set': updated_data}
        )
        if result.modified_count > 0:
            return jsonify({'success': True, 'message': 'Customer updated successfully!'})
        else:
            return jsonify({'success': False, 'message': 'No changes made.'})
    except Exception as e:
        print(f"Error editing customer: {e}")
        return jsonify({'success': False, 'message': 'Error editing customer.'}), 500

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

@company_bp.route('/get_customers_paginated')
@jwt_required()
def get_customers_paginated():
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 100))
        skip = (page - 1) * per_page

        # Server-side filter: optional `company` query param (case-insensitive, partial match)
        company = (request.args.get('company') or '').strip()
        query = {}
        if company:
            # partial, case-insensitive match on "Company Name"
            query = {'Company Name': {'$regex': re.escape(company), '$options': 'i'}}

        total = customers_collection.count_documents(query)
        customers = list(customers_collection.find(query).skip(skip).limit(per_page))

        for customer in customers:
            customer['_id'] = str(customer['_id'])
            customer.pop('companyLogo', None)

        return jsonify({
            "total": total,
            "page": page,
            "per_page": per_page,
            "customers": customers
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
