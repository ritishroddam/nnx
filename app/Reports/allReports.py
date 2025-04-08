from datetime import datetime, timedelta
from flask import render_template, Blueprint, request, jsonify, send_file, url_for # type: ignore
from pymongo import MongoClient # type: ignore
import pandas as pd # type: ignore
from io import BytesIO
from app.database import db
from flask_jwt_extended import jwt_required, get_jwt_identity # type: ignore
from app.models import User
from app.utils import roles_required


reports_bp = Blueprint('Reports', __name__, static_folder='static', template_folder='templates')

vehicle_inventory_collection = db['vehicle_inventory']
atlanta_collection = db['atlanta']

# Define field to collection mapping at module level
FIELD_COLLECTION_MAP = {
    'atlanta': ['status', 'time', 'gps', 'latitude', 'longitude', 'speed', 
                'date', 'ignition', 'door', 'sos', 'main_power', 'odometer',
                'internal_bat', 'gsm_sig', 'cellid', 'temp', 'harsh_speed',
                'timestamp', 'course', 'checksum', 'reserve1', 'reserve2',
                'ac', 'reserve3', 'harsh_break', 'arm', 'sleep', 'reserve4',
                'status_accelerometer', 'adc_voltage', 'one_wire_temp', 'i_btn',
                'onBoard_temp', 'mobCountryCode', 'mobNetworkCode', 'localAreaCode'],
    'vehicle_inventory': ['LicensePlateNumber', 'IMEI', 'SIM', 'VehicleModel', 
                         'VehicleMake', 'YearOfManufacture', 'DateOfPurchase',
                         'InsuranceNumber', 'DriverName', 'CurrentStatus',
                         'Location', 'OdometerReading', 'ServiceDueDate']
}

def get_date_range_filter(date_range):
    """Helper function to generate date range filters for string dates"""
    now = datetime.now()
    current_date_str = now.strftime("%d%m%y")
    current_time_str = now.strftime("%H%M%S")
    yesterday_date_str = (now - timedelta(days=1)).strftime("%d%m%y")
    
    if date_range == "last24hours":
        # Handle crossing midnight case
        time_24h_ago = (now - timedelta(hours=24)).strftime("%H%M%S")
        return {
            '$or': [
                {
                    'date': current_date_str,
                    'time': {'$gte': time_24h_ago}
                },
                {
                    'date': {'$gt': yesterday_date_str}
                }
            ]
        }
    elif date_range == "today":
        return {'date': current_date_str}
    elif date_range == "yesterday":
        return {'date': yesterday_date_str}
    elif date_range == "last7days":
        date_strings = [(now - timedelta(days=i)).strftime("%d%m%y") for i in range(7)]
        return {'date': {'$in': date_strings}}
    elif date_range == "last30days":
        date_strings = [(now - timedelta(days=i)).strftime("%d%m%y") for i in range(30)]
        return {'date': {'$in': date_strings}}
    return {}

def clean_panic_data(df):
    """Clean and format panic report data"""
    # Format date/time
    if 'date' in df.columns:
        df['date'] = df['date'].apply(
            lambda x: f"{x[:2]}/{x[2:4]}/20{x[4:]}" if isinstance(x, str) and len(x) == 6 else x
        )
    
    if 'time' in df.columns:
        df['time'] = df['time'].apply(
            lambda x: f"{x[:2]}:{x[2:4]}:{x[4:]}" if isinstance(x, str) and len(x) == 6 else x
        )
    
    # Handle empty coordinates
    if 'latitude' in df.columns:
        df['latitude'] = df['latitude'].replace('', 'N/A')
    if 'longitude' in df.columns:
        df['longitude'] = df['longitude'].replace('', 'N/A')
    
    return df

@reports_bp.route('/')
@jwt_required()
def index():
    vehicles = list(vehicle_inventory_collection.find({}, {"LicensePlateNumber": 1, "_id": 0}))
    reports = list(db['custom_reports'].find({}, {"_id": 0, "report_name": 1}))
    return render_template('allReport.html', vehicles=vehicles, reports=reports)

@reports_bp.route('/get_fields', methods=['GET'])
@jwt_required()
def get_fields():
    # Combine fields from all collections
    all_fields = set()
    for collection, fields in FIELD_COLLECTION_MAP.items():
        all_fields.update(fields)
    return jsonify(list(all_fields))

@reports_bp.route('/save_custom_report', methods=['POST'])
@jwt_required()
def save_custom_report():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "No JSON data provided."}), 400
            
        report_name = data.get("reportName")
        fields = data.get("fields")

        if not report_name or not fields:
            return jsonify({"success": False, "message": "Invalid data provided."}), 400
        
        # Validate fields exist in our collections
        try:
            validate_fields(fields)
        except ValueError as e:
            return jsonify({"success": False, "message": str(e)}), 400

        # Check if report already exists
        if db['custom_reports'].find_one({"report_name": report_name}):
            return jsonify({"success": False, "message": "Report with this name already exists."}), 400

        # Save the custom report
        db['custom_reports'].insert_one({
            "report_name": report_name,
            "fields": fields,
            "created_at": datetime.now(),
            "created_by": get_jwt_identity()
        })

        return jsonify({
            "success": True, 
            "message": "Custom report saved successfully!",
            "redirect_url": url_for('Reports.index')
        }), 200

    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"An error occurred: {str(e)}"
        }), 500

@reports_bp.route('/get_custom_reports', methods=['GET'])
@jwt_required()
def get_custom_reports():
    reports = list(db['custom_reports'].find({}, {"_id": 0, "report_name": 1}))
    return jsonify(reports)

def validate_fields(fields):
    """Validate requested fields exist in our collections"""
    invalid_fields = []
    for field in fields:
        found = False
        for collection_fields in FIELD_COLLECTION_MAP.values():
            if field in collection_fields:
                found = True
                break
        if not found:
            invalid_fields.append(field)
    
    if invalid_fields:
        raise ValueError(f"Fields not found in any collection: {', '.join(invalid_fields)}")

def build_queries(fields, imei, date_range):
    """Build queries for all needed collections based on requested fields"""
    queries = {}
    
    # Determine which collections we need
    collections_needed = set()
    for field in fields:
        for collection, coll_fields in FIELD_COLLECTION_MAP.items():
            if field in coll_fields:
                collections_needed.add(collection)
                break
    
    # Build query for each collection
    for collection in collections_needed:
        query = {}
        
        # Common IMEI filter for all collections
        if collection == 'vehicle_inventory':
            query['IMEI'] = imei
        else:
            query['imei'] = imei
        
        # Add date range filter for time-series data
        if collection == 'atlanta' and date_range:
            date_filter = get_date_range_filter(date_range)
            if date_filter:
                query.update(date_filter)
        
        queries[collection] = {
            'query': query,
            'projection': {field: 1 for field in fields if field in FIELD_COLLECTION_MAP[collection]}
        }
    
    return queries

def merge_data(results_from_collections, fields):
    """Merge data from multiple collections into a unified format"""
    merged_data = []
    
    # Get static data (vehicle and device info)
    static_data = {}
    for collection in ['vehicle_inventory', 'device_inventory']:
        if collection in results_from_collections:
            static_data.update(results_from_collections[collection][0] if results_from_collections[collection] else {})
    
    # Handle time-series data
    if 'atlanta' in results_from_collections:
        for record in results_from_collections['atlanta']:
            merged_record = {**static_data, **record}
            # Filter to only include requested fields
            merged_data.append({k: v for k, v in merged_record.items() if k in fields})
    else:
        # Only static data was requested
        merged_data.append({k: v for k, v in static_data.items() if k in fields})
    
    return merged_data

# TravelPath
@reports_bp.route('/download_travel_path_report', methods=['POST'])
@jwt_required()
def download_travel_path_report():
    try:
        data = request.get_json()
        report_name = data.get("reportName")
        vehicle_number = data.get("vehicleNumber")
        date_range = data.get("dateRange")

        # Fetch report configuration
        report_config = db['custom_reports'].find_one({"report_name": report_name})
        if not report_config:
            return jsonify({"success": False, "message": "Report not found."}), 404
            
        fields = report_config["fields"]
        
        # Get vehicle IMEI
        vehicle_data = db['vehicle_inventory'].find_one(
            {'LicensePlateNumber': vehicle_number},
            {'_id': 0, 'IMEI': 1}
        )
        
        if not vehicle_data or 'IMEI' not in vehicle_data:
            return jsonify({"success": False, "message": "Vehicle IMEI not found."}), 404
        
        imei_number = vehicle_data['IMEI']
        
        # Validate requested fields
        try:
            validate_fields(fields)
        except ValueError as e:
            return jsonify({"success": False, "message": str(e)}), 400
        
        queries = build_queries(fields, imei_number, date_range)
        
        # Execute queries
        results = {}
        for collection, query_info in queries.items():
            cursor = db[collection].find(
                query_info['query'],
                query_info['projection']
            )
            results[collection] = list(cursor)
        
        # Merge data from different collections
        merged_data = merge_data(results, fields)
        
        if not merged_data:
            return jsonify({"success": False, "message": "No data found for the selected criteria."}), 404
        
        # Process data for Excel
        output = BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df = pd.DataFrame(merged_data)
            
            # Format date/time
            if 'date' in df.columns:
                df['date'] = df['date'].apply(lambda x: f"{x[:2]}/{x[2:4]}/20{x[4:]}" if isinstance(x, str) and len(x) == 6 else x)
            if 'time' in df.columns:
                df['time'] = df['time'].apply(lambda x: f"{x[:2]}:{x[2:4]}:{x[4:]}" if isinstance(x, str) and len(x) == 6 else x)
            
            # Add location column (this would need geocoding implementation)
            df['location'] = "To be implemented"  # Replace with actual geocoding
            
            df.to_excel(writer, index=False, sheet_name="Travel Path Report")
        
        return send_file(
            output,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            as_attachment=True,
            download_name=f"travel_path_report_{vehicle_number}.xlsx"
        )

    except Exception as e:
        print(f"Error generating travel path report: {str(e)}")
        return jsonify({
            "success": False,
            "message": f"An error occurred while generating the report: {str(e)}"
        }), 500

# Distance Report
@reports_bp.route('/download_distance_report', methods=['POST'])
@jwt_required()
def download_distance_report():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "No data provided"}), 400
            
        vehicle_number = data.get("vehicleNumber")
        date_range = data.get("dateRange")
        
        # Get vehicle IMEI
        vehicle_data = db['vehicle_inventory'].find_one(
            {'LicensePlateNumber': vehicle_number},
            {'_id': 0, 'IMEI': 1}
        )
        
        if not vehicle_data or 'IMEI' not in vehicle_data:
            return jsonify({"success": False, "message": "Vehicle IMEI not found."}), 404
        
        imei_number = vehicle_data['IMEI']
        
        # Build query with date range filter
        query = {"imei": imei_number}
        date_filter = get_date_range_filter(date_range)
        if date_filter:
            query.update(date_filter)
        
        # Get travel data with odometer readings
        travel_data = list(db['atlanta'].find(
            query,
            {'latitude': 1, 'longitude': 1, 'date': 1, 'time': 1, 'odometer': 1, 'timestamp': 1, '_id': 0}
        ).sort([("date", 1), ("time", 1)]))
        
        if not travel_data:
            return jsonify({"success": False, "message": "No travel data found."}), 404
        
        # Process data for Excel
        output = BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df = pd.DataFrame(travel_data)
            
            if df.empty:
                return jsonify({"success": False, "message": "No valid data to export"}), 404
            
            # Format date/time
            if 'date' in df.columns:
                df['date'] = df['date'].apply(lambda x: f"{x[:2]}/{x[2:4]}/20{x[4:]}" if isinstance(x, str) and len(x) == 6 else x)
            if 'time' in df.columns:
                df['time'] = df['time'].apply(lambda x: f"{x[:2]}:{x[2:4]}:{x[4:]}" if isinstance(x, str) and len(x) == 6 else x)
            
            # Calculate distance between points
            df['distance_km'] = 0.0
            if len(df) > 1 and 'odometer' in df.columns:
                # Convert odometer to numeric
                df['odometer'] = pd.to_numeric(df['odometer'], errors='coerce')
                
                for i in range(1, len(df)):
                    if pd.notna(df.at[i, 'odometer']) and pd.notna(df.at[i-1, 'odometer']):
                        df.at[i, 'distance_km'] = df.at[i, 'odometer'] - df.at[i-1, 'odometer']
            
            # Ensure we have valid data to write
            if len(df) == 0:
                return jsonify({"success": False, "message": "No valid data rows to export"}), 404
                
            df.to_excel(writer, index=False, sheet_name="Distance Report")
            
        return send_file(
            output,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            as_attachment=True,
            download_name=f"distance_report_{vehicle_number}.xlsx"
        )

    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Server error: {str(e)}"
        }), 500

# Speed Report
@reports_bp.route('/download_speed_report', methods=['POST'])
@jwt_required()
def download_speed_report():
    data = request.json
    vehicle_number = data.get("vehicleNumber")
    date_range = data.get("dateRange")
    
    # Get vehicle IMEI
    vehicle_data = db['vehicle_inventory'].find_one(
        {'LicensePlateNumber': vehicle_number},
        {'_id': 0, 'IMEI': 1}
    )
    
    if not vehicle_data or 'IMEI' not in vehicle_data:
        return jsonify({"success": False, "message": "Vehicle IMEI not found."}), 404
    
    imei_number = vehicle_data['IMEI']
    
    # Build query with date range filter
    query = {"imei": imei_number}
    date_filter = get_date_range_filter(date_range)
    if date_filter:
        query.update(date_filter)
    
    # Get speed data
    speed_data = list(db['atlanta'].find(
        query,
        {'speed': 1, 'date': 1, 'time': 1, 'latitude': 1, 'longitude': 1, '_id': 0}
    ).sort([("date", 1), ("time", 1)]))
    
    if not speed_data:
        return jsonify({"success": False, "message": "No speed data found."}), 404
    
    # Process data for Excel
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df = pd.DataFrame(speed_data)
        
        # Format date/time
        if 'date' in df.columns:
            df['date'] = df['date'].apply(lambda x: f"{x[:2]}/{x[2:4]}/20{x[4:]}" if isinstance(x, str) and len(x) == 6 else x)
        if 'time' in df.columns:
            df['time'] = df['time'].apply(lambda x: f"{x[:2]}:{x[2:4]}:{x[4:]}" if isinstance(x, str) and len(x) == 6 else x)
        
        # Add speed classification
        df['speed_status'] = df['speed'].apply(
            lambda x: "Normal" if x <= 80 else ("High" if x <= 120 else "Very High")
        )
        
        df.to_excel(writer, index=False, sheet_name="Speed Report")
    
    return send_file(
        output,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=f"speed_report_{vehicle_number}.xlsx"
    )

# Stoppage Report
@reports_bp.route('/download_stoppage_report', methods=['POST'])
@jwt_required()
def download_stoppage_report():
    data = request.json
    vehicle_number = data.get("vehicleNumber")
    date_range = data.get("dateRange")
    
    # Get vehicle IMEI
    vehicle_data = db['vehicle_inventory'].find_one(
        {'LicensePlateNumber': vehicle_number},
        {'_id': 0, 'IMEI': 1}
    )
    
    if not vehicle_data or 'IMEI' not in vehicle_data:
        return jsonify({"success": False, "message": "Vehicle IMEI not found."}), 404
    
    imei_number = vehicle_data['IMEI']
    
    # Build query with date range filter
    query = {"imei": imei_number, "ignition": "off"}
    date_filter = get_date_range_filter(date_range)
    if date_filter:
        query.update(date_filter)
    
    stoppage_data = list(db['atlanta'].find(
        query,
        {'date': 1, 'time': 1, 'latitude': 1, 'longitude': 1, '_id': 0}
    ).sort([("date", 1), ("time", 1)]))
    
    if not stoppage_data:
        return jsonify({"success": False, "message": "No stoppage data found."}), 404
    
    # Process data for Excel
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df = pd.DataFrame(stoppage_data)
        
        # Format date/time
        if 'date' in df.columns:
            df['date'] = df['date'].apply(lambda x: f"{x[:2]}/{x[2:4]}/20{x[4:]}" if isinstance(x, str) and len(x) == 6 else x)
        if 'time' in df.columns:
            df['time'] = df['time'].apply(lambda x: f"{x[:2]}:{x[2:4]}:{x[4:]}" if isinstance(x, str) and len(x) == 6 else x)
        
        # Calculate duration of each stoppage (simplified)
        df['duration_minutes'] = 10  # Default value, would need actual calculation
        
        df.to_excel(writer, index=False, sheet_name="Stoppage Report")
    
    return send_file(
        output,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=f"stoppage_report_{vehicle_number}.xlsx"
    )
    
# Idle Report
@reports_bp.route('/download_idle_report', methods=['POST'])
@jwt_required()
def download_idle_report():
    data = request.json
    vehicle_number = data.get("vehicleNumber")
    date_range = data.get("dateRange")
    
    # Get vehicle IMEI
    vehicle_data = db['vehicle_inventory'].find_one(
        {'LicensePlateNumber': vehicle_number},
        {'_id': 0, 'IMEI': 1}
    )
    
    if not vehicle_data or 'IMEI' not in vehicle_data:
        return jsonify({"success": False, "message": "Vehicle IMEI not found."}), 404
    
    imei_number = vehicle_data['IMEI']
    
    # Build query with date range filter
    query = {"imei": imei_number, "speed": "0.0", "ignition": "on"}
    date_filter = get_date_range_filter(date_range)
    if date_filter:
        query.update(date_filter)
    
    idle_data = list(db['atlanta'].find(
        query,
        {'date': 1, 'time': 1, 'latitude': 1, 'longitude': 1, '_id': 0}
    ).sort([("date", 1), ("time", 1)]))
    
    if not idle_data:
        return jsonify({"success": False, "message": "No idle data found."}), 404
    
    # Process data for Excel
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df = pd.DataFrame(idle_data)
        
        # Format date/time
        if 'date' in df.columns:
            df['date'] = df['date'].apply(lambda x: f"{x[:2]}/{x[2:4]}/20{x[4:]}" if isinstance(x, str) and len(x) == 6 else x)
        if 'time' in df.columns:
            df['time'] = df['time'].apply(lambda x: f"{x[:2]}:{x[2:4]}:{x[4:]}" if isinstance(x, str) and len(x) == 6 else x)
        
        # Calculate idle duration (would need more complex logic)
        df['duration_minutes'] = 5  # Placeholder
        
        df.to_excel(writer, index=False, sheet_name="Idle Report")
    
    return send_file(
        output,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=f"idle_report_{vehicle_number}.xlsx"
    )

# Ignition Report
@reports_bp.route('/download_ignition_report', methods=['POST'])
@jwt_required()
def download_ignition_report():
    data = request.json
    vehicle_number = data.get("vehicleNumber")
    date_range = data.get("dateRange")
    
    # Get vehicle IMEI
    vehicle_data = db['vehicle_inventory'].find_one(
        {'LicensePlateNumber': vehicle_number},
        {'_id': 0, 'IMEI': 1}
    )
    
    if not vehicle_data or 'IMEI' not in vehicle_data:
        return jsonify({"success": False, "message": "Vehicle IMEI not found."}), 404
    
    imei_number = vehicle_data['IMEI']
    
    # Build query with date range filter
    query = {"imei": imei_number, "ignition": "on"}
    date_filter = get_date_range_filter(date_range)
    if date_filter:
        query.update(date_filter)
    
    ignition_data = list(db['atlanta'].find(
        query,
        {'date': 1, 'time': 1, 'latitude': 1, 'longitude': 1, '_id': 0}
    ).sort([("date", 1), ("time", 1)]))
    
    if not ignition_data:
        return jsonify({"success": False, "message": "No ignition data found."}), 404
    
    # Process data for Excel
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df = pd.DataFrame(ignition_data)
        
        # Format date/time
        if 'date' in df.columns:
            df['date'] = df['date'].apply(lambda x: f"{x[:2]}/{x[2:4]}/20{x[4:]}" if isinstance(x, str) and len(x) == 6 else x)
        if 'time' in df.columns:
            df['time'] = df['time'].apply(lambda x: f"{x[:2]}:{x[2:4]}:{x[4:]}" if isinstance(x, str) and len(x) == 6 else x)
        
        df.to_excel(writer, index=False, sheet_name="Ignition Report")
    
    return send_file(
        output,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=f"ignition_report_{vehicle_number}.xlsx"
    )
    
# Daily Report
@reports_bp.route('/download_daily_report', methods=['POST'])
@jwt_required()
def download_daily_report():
    data = request.json
    vehicle_number = data.get("vehicleNumber")
    date_range = data.get("dateRange")
    
    # Get vehicle IMEI
    vehicle_data = db['vehicle_inventory'].find_one(
        {'LicensePlateNumber': vehicle_number},
        {'_id': 0, 'IMEI': 1}
    )
    
    if not vehicle_data or 'IMEI' not in vehicle_data:
        return jsonify({"success": False, "message": "Vehicle IMEI not found."}), 404
    
    imei_number = vehicle_data['IMEI']
    
    # Build query with date range filter
    query = {"imei": imei_number}
    date_filter = get_date_range_filter(date_range)
    if date_filter:
        query.update(date_filter)
    
    daily_data = list(db['atlanta'].find(
        query,
        {'date': 1, 'time': 1, 'odometer': 1, 'speed': 1, 'latitude': 1, 'longitude': 1, '_id': 0}
    ).sort([("date", 1), ("time", 1)]))
    
    if not daily_data:
        return jsonify({"success": False, "message": "No daily data found."}), 404
    
    # Process data for Excel
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df = pd.DataFrame(daily_data)
        
        # Format date/time
        if 'date' in df.columns:
            df['date'] = df['date'].apply(lambda x: f"{x[:2]}/{x[2:4]}/20{x[4:]}" if isinstance(x, str) and len(x) == 6 else x)
        if 'time' in df.columns:
            df['time'] = df['time'].apply(lambda x: f"{x[:2]}:{x[2:4]}:{x[4:]}" if isinstance(x, str) and len(x) == 6 else x)
        
        # Calculate daily distance
        if 'odometer' in df.columns:
            df['daily_distance'] = df.groupby('date')['odometer'].transform(lambda x: x.max() - x.min())
        
        df.to_excel(writer, index=False, sheet_name="Daily Report")
    
    return send_file(
        output,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=f"daily_report_{vehicle_number}.xlsx"
    )

# Panic Report
@reports_bp.route('/download_panic_report', methods=['POST'])
@jwt_required()
def download_panic_report():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "No JSON data provided"}), 400
            
        vehicle_number = data.get("vehicleNumber")
        date_range = data.get("dateRange")
        
        if not vehicle_number:
            return jsonify({"success": False, "message": "Vehicle number is required"}), 400

        # Get vehicle IMEI
        vehicle_data = db.vehicle_inventory.find_one(
            {"LicensePlateNumber": vehicle_number},
            {"IMEI": 1, "_id": 0}
        )
        
        if not vehicle_data or not vehicle_data.get("IMEI"):
            return jsonify({"success": False, "message": "Vehicle IMEI not found"}), 404
            
        imei = str(vehicle_data["IMEI"]).strip()

        # Build query - check for SOS in multiple possible formats
        query = {
            "imei": imei,
            "$or": [
                {"sos": "1"},
                {"sos": 1},
                {"sos": True}
            ]
        }

        # Debug logging
        print(f"Searching for IMEI: {imei}")
        print(f"Initial query matches: {db.atlanta.count_documents(query)} records")

        # Add date range filter if specified
        if date_range and date_range != "all":
            now = datetime.now()
            if date_range == "last24hours":
                start_date = now - timedelta(hours=24)
                query["date_time"] = {"$gte": start_date}
            elif date_range == "today":
                start_date = datetime(now.year, now.month, now.day)
                query["date_time"] = {"$gte": start_date}
            elif date_range == "yesterday":
                yesterday = now - timedelta(days=1)
                start_date = datetime(yesterday.year, yesterday.month, yesterday.day)
                end_date = datetime(now.year, now.month, now.day)
                query["date_time"] = {"$gte": start_date, "$lt": end_date}
            elif date_range == "last7days":
                start_date = now - timedelta(days=7)
                query["date_time"] = {"$gte": start_date}
            elif date_range == "last30days":
                start_date = now - timedelta(days=30)
                query["date_time"] = {"$gte": start_date}

        records = list(db.atlanta.find(
            query,
            {
                "date_time": 1,
                "latitude": 1,
                "longitude": 1,
                "speed": 1,
                "odometer": 1,
                "sos": 1,
                "_id": 0
            }
        ).sort("date_time", 1))

        if not records:
            # Get sample document to check field names and values
            sample = db.atlanta.find_one({"imei": imei})
            return jsonify({
                "success": False,
                "message": "No panic events found for the selected criteria",
                "debug_info": {
                    "your_imei": imei,
                    "sample_document": sample,
                    "total_matching": db.atlanta.count_documents(query),
                    "total_for_imei": db.atlanta.count_documents({"imei": imei})
                }
            }), 404

        # Generate Excel file
        output = BytesIO()
        df = pd.DataFrame(records)
        
        # Format date_time column
        if 'date_time' in df.columns:
            df['date_time'] = pd.to_datetime(df['date_time']).dt.strftime('%Y-%m-%d %H:%M:%S')
        
        # Add location column if coordinates exist
        if 'latitude' in df.columns and 'longitude' in df.columns:
            df['location'] = df.apply(
                lambda row: f"{row['latitude']}, {row['longitude']}" 
                if pd.notna(row['latitude']) and pd.notna(row['longitude']) 
                else "N/A", 
                axis=1
            )
        
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name="Panic Report")
        
        output.seek(0)
        return send_file(
            output,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            as_attachment=True,
            download_name=f"panic_report_{vehicle_number}.xlsx"
        )

    except Exception as e:
        print(f"Error generating report: {str(e)}")
        return jsonify({
            "success": False,
            "message": f"Server error: {str(e)}",
            "error_type": type(e).__name__
        }), 500

@reports_bp.route('/download_custom_report', methods=['POST'])
@jwt_required()
def download_custom_report():
    print("Report generation started") 
    data = request.json
    report_name = data.get("reportName")
    vehicle_number = data.get("vehicleNumber")
    date_range = data.get("dateRange")

    print(f"Report Name: {report_name}, Vehicle Number: {vehicle_number}, Date Range: {date_range}")

    # Fetch report configuration
    report_config = db['custom_reports'].find_one({"report_name": report_name})
    print(f"Report Config: {report_config}")
    
    if not report_config:
        return jsonify({"success": False, "message": "Report not found."}), 404
        
    fields = report_config["fields"]
    print(f"Fields: {fields}")
    
    # Get vehicle data including SIM number
    vehicle_data = db['vehicle_inventory'].find_one(
        {'LicensePlateNumber': vehicle_number},
        {'_id': 0, 'IMEI': 1, 'SIM': 1} 
    )
    print(f"Vehicle Data: {vehicle_data}")
    
    if not vehicle_data or 'IMEI' not in vehicle_data:
        return jsonify({"success": False, "message": "Vehicle IMEI not found."}), 404

    imei_number = vehicle_data['IMEI']
    sim_number = vehicle_data.get('SIM', 'N/A')  # Get SIM from vehicle data

    # Determine which collections we need to query based on the fields
    collections_to_query = set()
    field_mapping = {
        'atlanta': set(db['atlanta'].find_one().keys()) if db['atlanta'].count_documents({}) > 0 else set(),
        'vehicle_inventory': set(db['vehicle_inventory'].find_one().keys()) if db['vehicle_inventory'].count_documents({}) > 0 else set(),
        'device_inventory': set(db['device_inventory'].find_one().keys()) if db['device_inventory'].count_documents({}) > 0 else set()
    }

    # Remove SIM-related fields from querying other collections
    fields = [field for field in fields if field != 'SIM']

    # Map fields to their respective collections
    fields_by_collection = {
        'atlanta': [],
        'vehicle_inventory': [],
        'device_inventory': []
    }

    for field in fields:
        for collection, collection_fields in field_mapping.items():
            if field in collection_fields:
                fields_by_collection[collection].append(field)
                collections_to_query.add(collection)
                break

    # Calculate date ranges
    date_filter = get_date_range_filter(date_range)

    # Query each collection
    all_results = []
    
    # Get vehicle data (already have it)
    if 'vehicle_inventory' in collections_to_query:
        vehicle_data = db['vehicle_inventory'].find_one(
            {"IMEI": imei_number},
            {field: 1 for field in fields_by_collection['vehicle_inventory']}
        )
        if vehicle_data:
            # Add SIM number to vehicle data if requested
            if 'SIM' in report_config["fields"]:
                vehicle_data['SIM'] = sim_number
            all_results.append(vehicle_data)

    # Get device data
    if 'device_inventory' in collections_to_query:
        device_data = db['device_inventory'].find_one(
            {"imei": imei_number},
            {field: 1 for field in fields_by_collection['device_inventory']}
        )
        if device_data:
            all_results.append(device_data)

    # Get time-series data from atlanta collection
    if 'atlanta' in collections_to_query:
        query = {"imei": imei_number}
        if date_filter:
            query.update(date_filter)
        
        atlanta_data = list(db['atlanta'].find(
            query,
            {field: 1 for field in fields_by_collection['atlanta']}
        ))
        
        all_results.extend(atlanta_data)

    if not all_results:
        return jsonify({"success": False, "message": "No data found for the selected criteria."}), 404

    # Convert to Excel
    output = BytesIO()
    try:
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            try:
                # Create a list to hold all records
                all_records = []
                
                # Handle time-series data first
                if 'atlanta' in collections_to_query and atlanta_data:
                    for record in atlanta_data:
                        new_record = {}
                        
                        # Add vehicle data if available
                        if 'vehicle_inventory' in collections_to_query and vehicle_data:
                            for field, value in vehicle_data.items():
                                if field != '_id' and field in fields:
                                    new_record[field] = value
                        
                        # Add device data if available
                        if 'device_inventory' in collections_to_query and device_data:
                            for field, value in device_data.items():
                                if field != '_id' and field in fields:
                                    new_record[field] = value
                        
                        # Add time-series data
                        for field, value in record.items():
                            if field != '_id' and field in fields:
                                new_record[field] = value
                        
                        all_records.append(new_record)
                else:
                    # Handle case when there's no time-series data
                    new_record = {}
                    if 'vehicle_inventory' in collections_to_query and vehicle_data:
                        for field, value in vehicle_data.items():
                            if field != '_id' and field in fields:
                                new_record[field] = value
                    if 'device_inventory' in collections_to_query and device_data:
                        for field, value in device_data.items():
                            if field != '_id' and field in fields:
                                new_record[field] = value
                    if new_record:
                        all_records.append(new_record)
                
                if not all_records:
                    return jsonify({"success": False, "message": "No data to export."}), 404
                
                # Create DataFrame
                df = pd.DataFrame(all_records)
                
                # Verify DataFrame is not empty
                if df.empty:
                    return jsonify({"success": False, "message": "No valid data found for the selected criteria."}), 404
                
                # Format date/time columns
                if 'date' in df.columns:
                    try:
                        df['date'] = df['date'].apply(lambda x: f"{x[:2]}/{x[2:4]}/20{x[4:]}" if isinstance(x, str) and len(x) == 6 else x)
                    except Exception as date_format_error:
                        print(f"Date formatting error: {date_format_error}")
                        # Continue without formatting if there's an error
                
                if 'time' in df.columns:
                    try:
                        df['time'] = df['time'].apply(lambda x: f"{x[:2]}:{x[2:4]}:{x[4:]}" if isinstance(x, str) and len(x) == 6 else x)
                    except Exception as time_format_error:
                        print(f"Time formatting error: {time_format_error}")
                        # Continue without formatting if there's an error
                
                # Write to Excel
                df.to_excel(writer, index=False, sheet_name="Combined Report")
                
                # Verify the Excel file was written successfully
                if writer.book.worksheets[0].max_row == 1:  # Only headers
                    return jsonify({"success": False, "message": "No data rows to export."}), 404
                    
            except Exception as excel_gen_error:
                print(f"Error during Excel generation: {excel_gen_error}")
                return jsonify({
                    "success": False,
                    "message": "Failed to generate Excel file. Please try again."
                }), 500
                
        # Verify the output buffer has content
        output.seek(0)
        if output.getbuffer().nbytes == 0:
            return jsonify({
                "success": False,
                "message": "Failed to generate report file (empty output)."
            }), 500
            
    except Exception as excel_write_error:
        print(f"Error creating Excel writer: {excel_write_error}")
        return jsonify({
            "success": False,
            "message": "Failed to initialize Excel writer. Please try again."
        }), 500

    # If we get here, everything succeeded
    return send_file(
        output,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=f"{report_name}.xlsx"
    )