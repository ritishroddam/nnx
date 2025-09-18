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
    vehicles = list(vehicle_collection.find({}, {'SIM': 1, 'imei': 1}))
    
    sim_to_imei = {v['SIM']: v.get('imei', 'N/A') 
                  for v in vehicles if 'SIM' in v}
    
    sims = list(collection.find({}))
    for sim in sims:
        if sim['MobileNumber'] in sim_to_imei:
            sim['IMEI'] = sim_to_imei[sim['MobileNumber']]
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
        vehicle_sims = list(db['vehicle_inventory'].find({}, {'sim_number': 1, 'imei': 1}))
        allocated_sim_numbers = {v['sim_number'] for v in vehicle_sims if 'sim_number' in v}
        sim_to_imei = {v['sim_number']: v.get('imei', 'N/A') for v in vehicle_sims if 'sim_number' in v}

        all_sims = list(collection.find({}))
        
        results = []
        for sim in all_sims:
            sim_number = sim.get('SimNumber', '')
            
            actual_status = 'Allocated' if sim_number in allocated_sim_numbers else sim.get('status', 'Available')
            
            is_active = sim.get('isActive', True)
            
            if status != 'All':
                if status in ['Active', 'Inactive']:
                    if (status == 'Active' and not is_active) or (status == 'Inactive' and is_active):
                        continue
                else:
                    if actual_status != status:
                        continue
                
            sim_data = {
                '_id': str(sim.get('_id', '')),
                'MobileNumber': sim.get('MobileNumber', ''),
                'SimNumber': sim_number,
                'IMEI': sim_to_imei.get(sim_number, 'N/A'),
                'status': actual_status,
                'isActive': is_active,
                'statusDate': sim.get('statusDate', ''),
                'reactivationDate': sim.get('reactivationDate', ''),
                'DateIn': sim.get('DateIn', ''),
                'DateOut': sim.get('DateOut', ''),
                'Vendor': sim.get('Vendor', ''),
                'lastEditedBy': sim.get('lastEditedBy', 'N/A')
            }
            
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
    
    vehicle_sims = list(db['vehicle_inventory'].find({}, {'sim_number': 1, 'imei': 1}))
    allocated_sim_numbers = {v['sim_number'] for v in vehicle_sims if 'sim_number' in v}
    sim_to_imei = {v['sim_number']: v.get('imei', 'N/A') for v in vehicle_sims if 'sim_number' in v}

    query = {
        "$or": [
            {"MobileNumber": {"$regex": f"{search_query}$"}}, 
            {"SimNumber": {"$regex": f"{search_query}$"}},   
            {"MobileNumber": search_query},                    
            {"SimNumber": search_query}                        
        ]
    }
    
    matching_sims = list(collection.find(query))
    
    results = []
    for sim in matching_sims:
        sim_number = sim.get('SimNumber', '')
        
        actual_status = 'Allocated' if sim_number in allocated_sim_numbers else sim.get('status', 'Available')
        
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

    if len(data['MobileNumber']) not in [10, 13]:
        flash("The lenght of Mobile Number must be 13 or 10", "danger")

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
    
    if 'DateIn' not in data or not data['DateIn']:
        flash("Date In is required", "danger")
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

            if len(mobile_number) not in [10,13]:
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
            "lastEditedBy": get_jwt_identity(),
            "lastEditedAt": datetime.now()
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

        vehicle_collection = db['vehicle_inventory']
        vehicles = list(vehicle_collection.find({}, {'sim_number': 1, 'imei': 1}))
        sim_to_imei = {v.get('sim_number'): v.get('imei', 'N/A') for v in vehicles if 'sim_number' in v}


        export_columns = [
            'MobileNumber', 'SimNumber', 'IMEI', 'status', 'isActive',
            'statusDate', 'reactivationDate', 'DateIn', 'DateOut',
            'Vendor', 'lastEditedBy', 'lastEditedAt'
        ]

        processed_data = []
        for sim in sims:
            sim_number = sim.get('SimNumber', '')
            last_edited_at = sim.get('lastEditedAt', '')
            if last_edited_at:
                if hasattr(last_edited_at, 'strftime'):
                    last_edited_at = last_edited_at.strftime('%d-%m-%Y %I:%M %p')
                else:
                    try:
                        dt = datetime.fromisoformat(str(last_edited_at))
                        last_edited_at = dt.strftime('%d-%m-%Y %I:%M %p')
                    except:
                        pass
            row = {
                'MobileNumber': sim.get('MobileNumber', ''),
                'SimNumber': sim_number,
                'IMEI': sim_to_imei.get(sim_number, 'N/A'),
                'status': sim.get('status', 'Available'),
                'isActive': 'Active' if sim.get('isActive', True) else 'Inactive',
                'statusDate': str(sim.get('statusDate', '')).split('T')[0] if sim.get('statusDate') else '',
                'reactivationDate': str(sim.get('reactivationDate', '')).split('T')[0] if sim.get('reactivationDate') else '',
                'DateIn': str(sim.get('DateIn', '')).split('T')[0] if sim.get('DateIn') else '',
                'DateOut': str(sim.get('DateOut', '')).split('T')[0] if sim.get('DateOut') else '',
                'Vendor': sim.get('Vendor', ''),
                'lastEditedBy': sim.get('lastEditedBy', 'N/A'),
                'lastEditedAt': last_edited_at or ''
            }
            processed_data.append(row)

        df = pd.DataFrame(processed_data, columns=export_columns)

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

@sim_bp.route('/download_excel_filtered', methods=['POST'])
@jwt_required()
def download_excel_filtered():
    try:
        data = request.get_json()
        sims = data.get("sims", [])

        if not sims:
            return jsonify({"error": "No SIM data received"}), 400


        columns = [
            'MobileNumber', 'SimNumber', 'IMEI', 'status', 'isActive',
            'statusDate', 'reactivationDate', 'DateIn', 'DateOut',
            'Vendor', 'lastEditedBy', 'lastEditedAt'
        ]

        cleaned = []
        for sim in sims:
            last_edited_at = sim.get('lastEditedAt', '')
            if last_edited_at:
                if hasattr(last_edited_at, 'strftime'):
                    last_edited_at = last_edited_at.strftime('%d-%m-%Y %I:%M %p')
                else:
                    try:
                        dt = datetime.fromisoformat(str(last_edited_at))
                        last_edited_at = dt.strftime('%d-%m-%Y %I:%M %p')
                    except:
                        pass
            cleaned.append({col: str(sim.get(col, '')).strip() if col != 'lastEditedAt' else last_edited_at for col in columns})

        df = pd.DataFrame(cleaned, columns=columns)

        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl', datetime_format='YYYY-MM-DD') as writer:
            df.to_excel(writer, index=False, sheet_name="Filtered SIMs")

        output.seek(0)
        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name='Filtered_SIMs.xlsx'
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Export failed", "details": str(e)}), 500