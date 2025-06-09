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
from datetime import datetime, timedelta


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
    vehicle_collection = db['vehicle_inventory']
    vehicles = list(vehicle_collection.find({}, {'sim_number': 1, 'imei': 1}))
    
    sim_to_imei = {v['sim_number']: v.get('imei', 'N/A') 
                  for v in vehicles if 'sim_number' in v}
    
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
    try:
        # Get all vehicles and their SIM numbers
        vehicle_sims = list(db['vehicle_inventory'].find({}, {'sim_number': 1, 'imei': 1}))
        allocated_sim_numbers = {v['sim_number'] for v in vehicle_sims if 'sim_number' in v}
        sim_to_imei = {v['sim_number']: v.get('imei', 'N/A') for v in vehicle_sims if 'sim_number' in v}

        # Get all SIMs from inventory
        all_sims = list(collection.find({}))
        
        results = []
        for sim in all_sims:
            sim_number = sim.get('SimNumber', '')
            
            # Determine actual status (Allocated takes priority over stored status)
            actual_status = 'Allocated' if sim_number in allocated_sim_numbers else sim.get('status', 'Available')
            
            # Skip if not matching the requested status (unless 'All')
            if status != 'All' and actual_status != status:
                continue
                
            # Prepare SIM data
            sim_data = {
                '_id': str(sim.get('_id', '')),
                'MobileNumber': sim.get('MobileNumber', ''),
                'SimNumber': sim_number,
                'IMEI': sim_to_imei.get(sim_number, 'N/A'),
                'status': actual_status,
                'isActive': sim.get('isActive', True),
                'statusDate': sim.get('statusDate', ''),
                'reactivationDate': sim.get('reactivationDate', ''),
                'DateIn': sim.get('DateIn', ''),
                'DateOut': sim.get('DateOut', ''),
                'Vendor': sim.get('Vendor', ''),
                'lastEditedBy': sim.get('lastEditedBy', 'N/A')
            }
            
            # Add status-specific dates if needed
            if actual_status in ['SafeCustody', 'Suspended']:
                if 'statusDate' not in sim_data or not sim_data['statusDate']:
                    sim_data['statusDate'] = datetime.utcnow().strftime('%Y-%m-%d')
                if actual_status == 'SafeCustody' and ('reactivationDate' not in sim_data or not sim_data['reactivationDate']):
                    reactivation_date = datetime.utcnow() + timedelta(days=90)
                    sim_data['reactivationDate'] = reactivation_date.strftime('%Y-%m-%d')
            
            results.append(sim_data)
        
        return jsonify(results)
        
    except Exception as e:
        print(f"Error in get_sims_by_status: {str(e)}")
        return jsonify({'error': str(e)}), 500

@sim_bp.route('/search_sims')
@jwt_required()
def search_sims():
    search_query = request.args.get('query', '').strip()
    
    if not search_query:
        return jsonify([])
    
    # Get all vehicles and their SIM numbers
    vehicle_sims = list(db['vehicle_inventory'].find({}, {'sim_number': 1, 'imei': 1}))
    allocated_sim_numbers = {v['sim_number'] for v in vehicle_sims if 'sim_number' in v}
    sim_to_imei = {v['sim_number']: v.get('imei', 'N/A') for v in vehicle_sims if 'sim_number' in v}

    # Build the search query
    query = {
        "$or": [
            {"MobileNumber": {"$regex": f"{search_query}$"}},  # Ends with search term
            {"SimNumber": {"$regex": f"{search_query}$"}},     # Ends with search term
            {"MobileNumber": search_query},                    # Exact match
            {"SimNumber": search_query}                        # Exact match
        ]
    }
    
    # Get matching SIMs from inventory
    matching_sims = list(collection.find(query))
    
    results = []
    for sim in matching_sims:
        sim_number = sim.get('SimNumber', '')
        
        # Determine actual status (Allocated takes priority over stored status)
        actual_status = 'Allocated' if sim_number in allocated_sim_numbers else sim.get('status', 'Available')
        
        # Prepare SIM data
        sim_data = {
            '_id': str(sim.get('_id', '')),
            'MobileNumber': sim.get('MobileNumber', ''),
            'SimNumber': sim_number,
            'IMEI': sim_to_imei.get(sim_number, 'N/A'),
            'status': actual_status,
            'isActive': sim.get('isActive', True),
            'statusDate': sim.get('statusDate', ''),
            'reactivationDate': sim.get('reactivationDate', ''),
            'DateIn': sim.get('DateIn', ''),
            'DateOut': sim.get('DateOut', ''),
            'Vendor': sim.get('Vendor', ''),
            'lastEditedBy': sim.get('lastEditedBy', 'N/A')
        }
        results.append(sim_data)
    
    return jsonify(results)

@sim_bp.route('/manual_entry', methods=['POST'])
@jwt_required()
def manual_entry():
    data = request.form.to_dict()

    data['MobileNumber'] = data['MobileNumber'].strip()
    data['SimNumber'] = data['SimNumber'].strip()
    data['status'] = 'Available' 
    data['isActive'] = True  

    if len(data['MobileNumber']) != 10 :
        flash("The lenght of Mobile Number must be 10", "danger")

        if len(data['SimNumber']) != 20:
            flash("The lenght of SIM Number must be 20", "danger")

        return redirect(url_for('SimInvy.page'))

    if  len(data['SimNumber']) != 20:
        flash("The lenght of SIM Number must be 20", "danger")
        return redirect(url_for('SimInvy.page'))

    if collection.find_one({"MobileNumber": data['MobileNumber']}):
        flash("Mobile Number already exists", "danger")

        if collection.find_one({"SimNumber": data['SimNumber']}):
            flash("SIM Number already exists", "danger")

        return redirect(url_for('SimInvy.page'))

    if collection.find_one({"SimNumber": data['SimNumber']}):
        flash("SIM Number already exists", "danger")
        return redirect(url_for('SimInvy.page'))

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

        records = []
        for index, row in df.iterrows():
            mobile_number = str(row['MobileNumber']).strip()
            sim_number = str(row['SimNumber']).strip()
            date_in = str(row['DateIn']).split(' ')[0].strip()
            date_out = str(row['DateOut']).split(' ')[0].strip() if not pd.isnull(row['DateOut']) else ""
            vendor = str(row['Vendor']).strip()

            if len(mobile_number) != 10:
                flash(f"Invalid Mobile Number length at row {index + 2}, column 'MobileNumber' (Length: {len(mobile_number)})", "danger")
                return redirect(url_for('SimInvy.page'))
            if len(sim_number) != 20:
                flash(f"Invalid SIM Number length at row {index + 2}, column 'SimNumber' (Length: {len(sim_number)})", "danger")
                return redirect(url_for('SimInvy.page'))
            if collection.find_one({"MobileNumber": mobile_number}) or collection.find_one({"SimNumber": sim_number}):
                flash(f"Duplicate Mobile Number or SIM Number at row {index + 2}", "danger")
                return redirect(url_for('SimInvy.page'))

            record = {
                "MobileNumber": mobile_number,
                "SimNumber": sim_number,
                "DateIn": date_in,
                "DateOut": date_out,
                "Vendor": vendor,
            }
            records.append(record)

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
    try:
        sims = list(collection.find({}))
        
        if not sims:
            return jsonify({"error": "No data available"}), 404

        date_fields = ['DateIn', 'DateOut', 'statusDate', 'reactivationDate', 'lastEditedAt', 'createdAt', 'updatedAt']

        processed_data = []
        for sim in sims:
            clean_sim = {}
            for key, value in sim.items():
                if key == '_id':
                    clean_sim[key] = str(value)
                elif key in date_fields:
                    if value is None:
                        clean_sim[key] = ''
                    elif isinstance(value, datetime):
                        clean_sim[key] = value.replace(tzinfo=None).strftime('%Y-%m-%d')
                    elif isinstance(value, str):
                        clean_sim[key] = value.split('T')[0]
                    else:
                        clean_sim[key] = str(value)
                else:
                    clean_sim[key] = value
            processed_data.append(clean_sim)

        df = pd.DataFrame(processed_data)
        df = df.drop('_id', axis=1, errors='ignore')

        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl', datetime_format='YYYY-MM-DD') as writer:
            df.to_excel(writer, index=False, sheet_name="SIM Inventory")
        
        output.seek(0)

        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name='SIM_Inventory.xlsx'
        )
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": "Failed to generate Excel file",
            "details": str(e)
        }), 500
