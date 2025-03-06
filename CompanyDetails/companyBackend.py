# from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, send_file
# from pymongo import MongoClient
# from bson.objectid import ObjectId
# import pandas as pd
# import sys

# app = Flask(__name__)
# app.secret_key = 'your_secret_key'

# # MongoDB connection
# client = MongoClient('mongodb+srv://doadmin:4T81NSqj572g3o9f@db-mongodb-blr1-27716-c2bd0cae.mongo.ondigitalocean.com/admin?tls=true&authSource=admin')
# db = client['CordonEV']
# customers_collection = db['customers_list']

# # Route to render the main page
# @company_bp.route('/')
# def index():
#     customers = list(customers_collection.find())
#     return render_template('index.html', customers=customers)

# # Route to add a new customer manually
# @company_bp.route('/manual_entry', methods=['POST'])
# def manual_entry():
#     customer = {
#         'Company ID': request.form.get('CompanyID'),
#         'Company Name': request.form.get('CompanyName'),
#         'Contact Person': request.form.get('ContactPerson'),
#         'Email Address': request.form.get('EmailAddress'),
#         'Phone Number': request.form.get('PhoneNumber'),
#         'Company Address': request.form.get('CompanyAddress'),
#         'Number of GPS Devices': request.form.get('NumberOfGPSDevices'),
#         'Number of Vehicles': request.form.get('NumberOfVehicles'),
#         'Number of Drivers': request.form.get('NumberOfDrivers'),
#         'Payment Status': request.form.get('PaymentStatus'),
#         'Support Contact': request.form.get('SupportContact'),
#         'Remarks': request.form.get('Remarks'),
#     }

#     customers_collection.insert_one(customer)
#     flash('Customer added successfully!', 'success')
#     return redirect(url_for('index'))

# # Route to upload multiple customers from an Excel file
# @company_bp.route('/upload_customers', methods=['POST'])
# def upload_customers():
#     if 'file' not in request.files:
#         flash('No file part', 'danger')
#         return redirect(url_for('index'))

#     file = request.files['file']
#     if file.filename == '':
#         flash('No selected file', 'danger')
#         return redirect(url_for('index'))

#     try:
#         df = pd.read_excel(file)
#         customers_collection.insert_many(df.to_dict('records'))
#         flash('Customers uploaded successfully!', 'success')
#     except Exception as e:
#         flash(f'Error: {str(e)}', 'danger')

#     return redirect(url_for('index'))

# # Route to download the customer template
# @company_bp.route('/download_customer_template')
# def download_template():
#     path = r"/root/CordonNX/CordonNX/nayacomp/templates/Customer_upload_template.xlsx"
#     return send_file(path, as_attachment=True)

# @company_bp.route('/edit_customer/<customer_id>', methods=['POST'])
# def edit_customer(customer_id):
#     try:
#         updated_data = request.json

#         # Validation: Ensure required fields are not empty
#         required_fields = [
#             'Company Name', 'Contact Person', 'Email Address', 
#             'Phone Number', 'Company Address'
#         ]
#         for field in required_fields:
#             if not updated_data.get(field):
#                 return jsonify({'success': False, 'message': f'{field} is required.'}), 400

#         # Validation: Email format
#         import re
#         email = updated_data.get('Email Address')
#         if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email):
#             return jsonify({'success': False, 'message': 'Invalid Email Address format.'}), 400

#         # Validation: Phone number length and numeric
#         phone = updated_data.get('Phone Number')
#         if not phone.isdigit() or len(phone) != 10:
#             return jsonify({'success': False, 'message': 'Phone Number must be 10 digits.'}), 400

#         # Update the customer in the database
#         result = customers_collection.update_one(
#             {'_id': ObjectId(customer_id)},
#             {'$set': updated_data}
#         )
#         if result.modified_count > 0:
#             return jsonify({'success': True, 'message': 'Customer updated successfully!'})
#         else:
#             return jsonify({'success': False, 'message': 'No changes made.'})
#     except Exception as e:
#         print(f"Error editing customer: {e}")
#         return jsonify({'success': False, 'message': 'Error editing customer.'}), 500


# # Route to delete a customer
# @company_bp.route('/delete_customer/<customer_id>', methods=['DELETE'])
# def delete_customer(customer_id):
#     try:
#         result = customers_collection.delete_one({'_id': ObjectId(customer_id)})
#         if result.deleted_count > 0:
#             return jsonify({'success': True, 'message': 'Customer deleted successfully!'})
#         else:
#             return jsonify({'success': False, 'message': 'Customer not found.'})
#     except Exception as e:
#         print(f"Error deleting customer: {e}")
#         return jsonify({'success': False, 'message': 'Error deleting customer.'}), 500

# if __name__ == '__main__':
#     port = int(sys.argv[1]) if len(sys.argv) > 1 else 8007
#     app.run(host='64.227.137.175', port=8007, debug=True)




from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, send_file, Blueprint
from pymongo import MongoClient
from bson.objectid import ObjectId
import pandas as pd
import sys
import re

company_bp = Blueprint('CompanyDetails', __name__, static_folder='static', template_folder='templates')

# MongoDB connection
client = MongoClient('mongodb+srv://doadmin:4T81NSqj572g3o9f@db-mongodb-blr1-27716-c2bd0cae.mongo.ondigitalocean.com/admin?tls=true&authSource=admin')
db = client['nnx']
customers_collection = db['customers_list']

@company_bp.route('/page')
def page():
    customers = list(customers_collection.find())
    return render_template('company.html', customers=customers)

def get_next_company_id():
    """
    Fetch the last Company ID stored in customers_list and increment it.
    """
    last_customer = customers_collection.find_one({}, sort=[("Company ID", -1)])
    
    if last_customer and "Company ID" in last_customer:
        last_id = int(last_customer["Company ID"].replace("CMP", ""))  # Extract numeric part
        return f"CMP{last_id + 1}"
    
    return "CMP1001"  # Start from CMP1001 if no companies exist

# API: Fetch next Company ID
@company_bp.route('/next_company_id', methods=['GET'])
def next_company_id():
    try:
        new_company_id = get_next_company_id()
        return jsonify({"success": True, "company_id": new_company_id})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# Route to add a new customer manually
@company_bp.route('/manual_entry', methods=['POST'])
def manual_entry():
    customer = {
        'Company ID': get_next_company_id(),  # Auto-generate Company ID
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
    return redirect(url_for('index'))

# Route to upload multiple customers from an Excel file
@company_bp.route('/upload_customers', methods=['POST'])
def upload_customers():
    if 'file' not in request.files:
        flash('No file part', 'danger')
        return redirect(url_for('index'))

    file = request.files['file']
    if file.filename == '':
        flash('No selected file', 'danger')
        return redirect(url_for('index'))

    try:
        df = pd.read_excel(file)

        # Assign unique Company IDs for each record
        records = df.to_dict(orient="records")
        for record in records:
            record["Company ID"] = get_next_company_id()  # Assign unique ID

        customers_collection.insert_many(records)
        flash('Customers uploaded successfully!', 'success')
    except Exception as e:
        flash(f'Error: {str(e)}', 'danger')

    return redirect(url_for('index'))

# Route to download the customer template
@company_bp.route('/download_template')
def download_template():
    path = r"/root/CordonNX/CordonNX/nayacomp/templates/Customer_upload_template.xlsx"
    return send_file(path, as_attachment=True)

# Route to edit customer details
@company_bp.route('/edit_customer/<customer_id>', methods=['POST'])
def edit_customer(customer_id):
    try:
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
            {'_id': ObjectId(customer_id)},
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
