# from datetime import datetime, timedelta
# import traceback
# from flask import render_template, Blueprint, request, jsonify, send_file, url_for # type: ignore
# from pymongo import MongoClient # type: ignore
# import pandas as pd # type: ignore
# from datetime import datetime
# from pytz import timezone # type: ignore
# from io import BytesIO
# from app.database import db
# from flask_jwt_extended import jwt_required, get_jwt_identity # type: ignore
# from app.models import User
# from app.utils import roles_required


# reports_bp = Blueprint('Reports', __name__, static_folder='static', template_folder='templates')

# vehicle_inventory_collection = db['vehicle_inventory']
# atlanta_collection = db['atlanta']

# # Define field to collection mapping at module level
# FIELD_COLLECTION_MAP = {
#     'atlanta': ['status', 'time', 'gps', 'latitude', 'longitude', 'speed', 
#                 'date', 'ignition', 'door', 'sos', 'main_power', 'odometer',
#                 'internal_bat', 'gsm_sig', 'cellid', 'temp', 'harsh_speed',
#                 'timestamp', 'course', 'checksum', 'reserve1', 'reserve2',
#                 'ac', 'reserve3', 'harsh_break', 'arm', 'sleep', 'reserve4',
#                 'status_accelerometer', 'adc_voltage', 'one_wire_temp', 'i_btn',
#                 'onBoard_temp', 'mobCountryCode', 'mobNetworkCode', 'localAreaCode'],
#     'vehicle_inventory': ['LicensePlateNumber', 'IMEI', 'SIM', 'VehicleModel', 
#                          'VehicleMake', 'YearOfManufacture', 'DateOfPurchase',
#                          'InsuranceNumber', 'DriverName', 'CurrentStatus',
#                          'Location', 'OdometerReading', 'ServiceDueDate']
# }

# def get_date_range_filter(date_range):
#     """Improved date range filter using datetime objects"""
#     now = datetime.now()
    
#     if date_range == "last24hours":
#         return {'date_time': {'$gte': now - timedelta(hours=24)}}
#     elif date_range == "today":
#         today_start = datetime(now.year, now.month, now.day)
#         return {'date_time': {'$gte': today_start}}
#     elif date_range == "yesterday":
#         yesterday_start = datetime(now.year, now.month, now.day) - timedelta(days=1)
#         yesterday_end = datetime(now.year, now.month, now.day)
#         return {'date_time': {'$gte': yesterday_start, '$lt': yesterday_end}}
#     elif date_range == "last7days":
#         return {'date_time': {'$gte': now - timedelta(days=7)}}
#     elif date_range == "last30days":
#         return {'date_time': {'$gte': now - timedelta(days=30)}}
#     return {}

# def clean_panic_data(df):
#     """Clean and format panic report data"""
#     # Format date/time
#     if 'date' in df.columns:
#         df['date'] = df['date'].apply(
#             lambda x: f"{x[:2]}/{x[2:4]}/20{x[4:]}" if isinstance(x, str) and len(x) == 6 else x
#         )
    
#     if 'time' in df.columns:
#         df['time'] = df['time'].apply(
#             lambda x: f"{x[:2]}:{x[2:4]}:{x[4:]}" if isinstance(x, str) and len(x) == 6 else x
#         )
    
#     # Handle empty coordinates
#     if 'latitude' in df.columns:
#         df['latitude'] = df['latitude'].replace('', 'N/A')
#     if 'longitude' in df.columns:
#         df['longitude'] = df['longitude'].replace('', 'N/A')
    
#     return df

# @reports_bp.route('/')
# @jwt_required()
# def index():
#     vehicles = list(vehicle_inventory_collection.find({}, {"LicensePlateNumber": 1, "_id": 0}))
#     reports = list(db['custom_reports'].find({}, {"_id": 0, "report_name": 1}))
#     return render_template('allReport.html', vehicles=vehicles, reports=reports)

# @reports_bp.route('/get_fields', methods=['GET'])
# @jwt_required()
# def get_fields():
#     # Combine fields from all collections
#     all_fields = set()
#     for collection, fields in FIELD_COLLECTION_MAP.items():
#         all_fields.update(fields)
#     return jsonify(list(all_fields))

# @reports_bp.route('/save_custom_report', methods=['POST'])
# @jwt_required()
# def save_custom_report():
#     try:
#         data = request.get_json()
#         if not data:
#             return jsonify({"success": False, "message": "No JSON data provided."}), 400
            
#         report_name = data.get("reportName")
#         fields = data.get("fields")

#         if not report_name or not fields:
#             return jsonify({"success": False, "message": "Invalid data provided."}), 400
        
#         # Validate fields exist in our collections
#         try:
#             validate_fields(fields)
#         except ValueError as e:
#             return jsonify({"success": False, "message": str(e)}), 400

#         # Check if report already exists
#         if db['custom_reports'].find_one({"report_name": report_name}):
#             return jsonify({"success": False, "message": "Report with this name already exists."}), 400

#         # Save the custom report
#         db['custom_reports'].insert_one({
#             "report_name": report_name,
#             "fields": fields,
#             "created_at": datetime.now(),
#             "created_by": get_jwt_identity()
#         })

#         return jsonify({
#             "success": True, 
#             "message": "Custom report saved successfully!",
#             "redirect_url": url_for('Reports.index')
#         }), 200

#     except Exception as e:
#         return jsonify({
#             "success": False,
#             "message": f"An error occurred: {str(e)}"
#         }), 500

# @reports_bp.route('/get_custom_reports', methods=['GET'])
# @jwt_required()
# def get_custom_reports():
#     reports = list(db['custom_reports'].find({}, {"_id": 0, "report_name": 1}))
#     return jsonify(reports)

# def validate_fields(fields):
#     """Validate requested fields exist in our collections"""
#     invalid_fields = []
#     for field in fields:
#         found = False
#         for collection_fields in FIELD_COLLECTION_MAP.values():
#             if field in collection_fields:
#                 found = True
#                 break
#         if not found:
#             invalid_fields.append(field)
    
#     if invalid_fields:
#         raise ValueError(f"Fields not found in any collection: {', '.join(invalid_fields)}")

# def build_queries(fields, imei, date_range):
#     """Build queries for all needed collections based on requested fields"""
#     queries = {}
    
#     # Determine which collections we need
#     collections_needed = set()
#     for field in fields:
#         for collection, coll_fields in FIELD_COLLECTION_MAP.items():
#             if field in coll_fields:
#                 collections_needed.add(collection)
#                 break
    
#     # Build query for each collection
#     for collection in collections_needed:
#         query = {}
        
#         # Common IMEI filter for all collections
#         if collection == 'vehicle_inventory':
#             query['IMEI'] = imei
#         else:
#             query['imei'] = imei
        
#         # Add date range filter for time-series data
#         if collection == 'atlanta' and date_range:
#             date_filter = get_date_range_filter(date_range)
#             if date_filter:
#                 query.update(date_filter)
        
#         queries[collection] = {
#             'query': query,
#             'projection': {field: 1 for field in fields if field in FIELD_COLLECTION_MAP[collection]}
#         }
    
#     return queries

# def merge_data(results_from_collections, fields):
#     """Merge data from multiple collections into a unified format"""
#     merged_data = []
    
#     # Get static data (vehicle and device info)
#     static_data = {}
#     for collection in ['vehicle_inventory', 'device_inventory']:
#         if collection in results_from_collections:
#             static_data.update(results_from_collections[collection][0] if results_from_collections[collection] else {})
    
#     # Handle time-series data
#     if 'atlanta' in results_from_collections:
#         for record in results_from_collections['atlanta']:
#             merged_record = {**static_data, **record}
#             # Filter to only include requested fields
#             merged_data.append({k: v for k, v in merged_record.items() if k in fields})
#     else:
#         # Only static data was requested
#         merged_data.append({k: v for k, v in static_data.items() if k in fields})
    
#     return merged_data

# @reports_bp.route('/download_custom_report', methods=['POST'])
# @jwt_required()
# def download_custom_report():
#     try:
#         print("Received request data:", request.get_json())
#         data = request.get_json()
#         if not data:
#             return jsonify({"success": False, "message": "No data provided"}), 400
        
#         report_name = data.get("reportName", "custom")
#         vehicle_number = data.get("vehicleNumber")
#         date_range = data.get("dateRange", "all")
        
#         print(f"Processing report: {report_name} for vehicle: {vehicle_number}")

#         # Get vehicle IMEI
#         vehicle_data = db['vehicle_inventory'].find_one(
#             {'LicensePlateNumber': vehicle_number},
#             {'_id': 0, 'IMEI': 1}
#         )
        
#         if not vehicle_data or 'IMEI' not in vehicle_data:
#             return jsonify({"success": False, "message": "Vehicle IMEI not found."}), 404

#         imei_number = vehicle_data['IMEI']

#         # Define report configurations
#         report_configs = {
#             'travel-path': {
#                 'query': {"imei": imei_number, "gps": "A"},
#                 'fields': ["date_time", "latitude", "longitude", "speed"],
#                 'sheet_name': "Travel Path Report"
#             },
#             'distance': {
#                 'query': {"imei": imei_number, "gps": "A"},
#                 'fields': ["date_time", "odometer", "latitude", "longitude"],
#                 'sheet_name': "Distance Report",
#                 'post_process': lambda df: df.assign(
#                     odometer=pd.to_numeric(df['odometer'], errors='coerce'),
#                     distance_km=df['odometer'].diff().fillna(0)
#                 )
#             },
#             'speed': {
#                 'query': {"imei": imei_number, "gps": "A"},
#                 'fields': ["date_time", "speed", "latitude", "longitude"],
#                 'sheet_name': "Speed Report",
#                 'post_process': lambda df: df.assign(
#                     speed_status=df['speed'].apply(
#                         lambda x: "Normal" if x <= 80 else ("High" if x <= 120 else "Very High")
#                     )
#                 )
#             },
#             'stoppage': {
#                 'query': {"imei": imei_number, "ignition": "off"},
#                 'fields': ["date_time", "latitude", "longitude"],
#                 'sheet_name': "Stoppage Report",
#                 'post_process': lambda df: df.assign(duration_minutes=10)
#             },
#             'idle': {
#                 'query': {"imei": imei_number, "speed": "0.0", "ignition": "on"},
#                 'fields': ["date_time", "latitude", "longitude"],
#                 'sheet_name': "Idle Report",
#                 'post_process': lambda df: df.assign(duration_minutes=5)
#             },
#             'ignition': {
#                 'query': {"imei": imei_number, "ignition": "on"},
#                 'fields': ["date_time", "latitude", "longitude"],
#                 'sheet_name': "Ignition Report"
#             },
#             'daily': {
#                 'query': {"imei": imei_number},
#                 'fields': ["date_time", "odometer", "speed", "latitude", "longitude"],
#                 'sheet_name': "Daily Report",
#                 'post_process': lambda df: df.assign(
#                     daily_distance=df.groupby('date')['odometer'].transform(lambda x: x.max() - x.min())
#                 )
#             }
#         }

#         # Get the report config (default to custom if not found)
#         config = report_configs.get(report_name, {
#             'query': {"imei": imei_number},
#             'fields': ["date_time", "latitude", "longitude"],
#             'sheet_name': "Custom Report"
#         })

#         # Add date range filter
#         date_filter = get_date_range_filter(date_range)
#         if date_filter:
#             config['query'].update(date_filter)

#         # Fetch data
#         data = list(db['atlanta'].find(
#             config['query'],
#             {field: 1 for field in config['fields']}
#         ).sort("date_time", 1))

#         if not data:
#             return jsonify({
#                 "success": False,
#                 "message": "No data found for the selected criteria.",
#                 "debug_info": {
#                     "query": config['query'],
#                     "fields": config['fields']
#                 }
#             }), 404
        
#         cursor = db[config['collection']].find(
#             config['query'],
#             config.get('projection', {})
#         )
            
#         df = pd.DataFrame(list(cursor))

#         if df.empty:
#             return jsonify({"success": False, "message": "No data found for the given criteria"}), 404

#         # Process data
#         output = BytesIO()
#         with pd.ExcelWriter(output, engine='openpyxl') as writer:
#             df.to_excel(writer, index=False, sheet_name=config['sheet_name'])
        
#         # Prepare response
#         output.seek(0)
#         response = send_file(
#             output,
#             mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
#             as_attachment=True,
#             download_name=f"{report_name}_report_{vehicle_number}.xlsx"
#         )
        
#         return response

#     except Exception as e:
#         return jsonify({
#             "success": False,
#             "message": str(e),
#             "error_type": type(e).__name__
#         }), 500

# # Keep the panic report function as is
# @reports_bp.route('/download_panic_report', methods=['POST'])
# @jwt_required()
# def download_panic_report():
#     try:
#         data = request.get_json()
#         if not data:
#             return jsonify({"success": False, "message": "No data provided"}), 400
            
#         vehicle_number = data.get("vehicleNumber")
#         date_range = data.get("dateRange", "all")

#         # Get vehicle IMEI
#         vehicle = db.vehicle_inventory.find_one(
#             {"LicensePlateNumber": vehicle_number},
#             {"IMEI": 1, "_id": 0}
#         )
        
#         if not vehicle or not vehicle.get("IMEI"):
#             return jsonify({"success": False, "message": "Vehicle not found"}), 404
            
#         imei = str(vehicle["IMEI"])

#         # More flexible query for SOS events
#         query = {
#             "imei": imei,
#             "$or": [
#                 {"sos": "1"},
#                 {"sos": 1},
#                 {"sos": True},
#                 {"status": "SOS"},
#                 {"alarm": "SOS"}
#             ]
#         }

#         # Add date range filter
#         date_filter = get_date_range_filter(date_range)
#         if date_filter:
#             query.update(date_filter)

#         records = list(db.atlanta.find(
#             query,
#             {
#                 "date_time": 1,
#                 "latitude": 1,
#                 "longitude": 1,
#                 "speed": 1,
#                 "odometer": 1,
#                 "_id": 0
#             }
#         ).sort("date_time", 1))

#         if not records:
#             return jsonify({
#                 "success": False,
#                 "message": "No panic events found"
#             }), 404

#         # Generate Excel file
#         output = BytesIO()
#         df = pd.DataFrame(records)
        
#         # Format date/time
#         if 'date_time' in df.columns:
#             df['date_time'] = pd.to_datetime(df['date_time']).dt.strftime('%Y-%m-%d %H:%M:%S')
        
#         with pd.ExcelWriter(output, engine='openpyxl') as writer:
#             df.to_excel(writer, index=False, sheet_name="Panic Report")
        
#         return send_file(
#             output,
#             mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
#             as_attachment=True,
#             download_name=f"panic_report_{vehicle_number}.xlsx"
#         )

#     except Exception as e:
#         return jsonify({
#             "success": False,
#             "message": f"Error generating report: {str(e)}"
#         }), 500




from datetime import datetime, timedelta
import traceback
from flask import render_template, Blueprint, request, jsonify, send_file, url_for
from pymongo import MongoClient
import pandas as pd
from datetime import datetime
from pytz import timezone
from io import BytesIO
from app.database import db
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import User
from app.utils import roles_required
import pytz

reports_bp = Blueprint('Reports', __name__, static_folder='static', template_folder='templates')

# Define field to collection mapping
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
                         'Location', 'OdometerReading', 'ServiceDueDate'],
    'sos_logs': ['imei', 'date', 'time', 'latitude', 'longitude', 'date_time', 'timestamp']
}

def get_date_range_filter(date_range):
    """Improved date range filter using datetime objects"""
    tz = pytz.timezone('UTC')
    now = datetime.now(tz)
    
    if date_range == "last24hours":
        return {'date_time': {'$gte': now - timedelta(hours=24)}}
    elif date_range == "today":
        today_start = datetime(now.year, now.month, now.day, tzinfo=tz)
        return {'date_time': {'$gte': today_start}}
    elif date_range == "yesterday":
        yesterday_start = datetime(now.year, now.month, now.day, tzinfo=tz) - timedelta(days=1)
        yesterday_end = datetime(now.year, now.month, now.day, tzinfo=tz)
        return {'date_time': {'$gte': yesterday_start, '$lt': yesterday_end}}
    elif date_range == "last7days":
        return {'date_time': {'$gte': now - timedelta(days=7)}}
    elif date_range == "last30days":
        return {'date_time': {'$gte': now - timedelta(days=30)}}
    elif date_range == "custom":
        # You'll need to implement custom date range handling
        return {}
    return {}

@reports_bp.route('/')
@jwt_required()
def index():
    vehicles = list(db['vehicle_inventory'].find({}, {"LicensePlateNumber": 1, "_id": 0}))
    reports = list(db['custom_reports'].find({}, {"_id": 0, "report_name": 1, "fields": 1}))
    return render_template('allReport.html', vehicles=vehicles, reports=reports)

@reports_bp.route('/get_fields', methods=['GET'])
@jwt_required()
def get_fields():
    all_fields = set()
    for collection, fields in FIELD_COLLECTION_MAP.items():
        all_fields.update(fields)
    return jsonify(sorted(list(all_fields)))

@reports_bp.route('/save_custom_report', methods=['POST'])
@jwt_required()
def save_custom_report():
    try:
        data = request.get_json()
        report_name = data.get("reportName")
        fields = data.get("fields")

        if not report_name or not fields:
            return jsonify({"success": False, "message": "Invalid data provided."}), 400

        # Check for duplicate report name
        if db['custom_reports'].find_one({"report_name": report_name}):
            return jsonify({"success": False, "message": "Report name already exists."}), 400

        # Save the report
        db['custom_reports'].insert_one({
            "report_name": report_name,
            "fields": fields,
            "created_at": datetime.now(),
            "created_by": get_jwt_identity()
        })

        return jsonify({"success": True, "message": "Report saved successfully!"}), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@reports_bp.route('/get_custom_report', methods=['GET'])
@jwt_required()
def get_custom_report():
    try:
        report_name = request.args.get('name')
        if not report_name:
            return jsonify({"success": False, "message": "Report name missing"}), 400
            
        report = db['custom_reports'].find_one(
            {"report_name": report_name},
            {"_id": 0, "fields": 1}
        )
        
        if not report:
            return jsonify({"success": False, "message": "Report not found"}), 404
            
        return jsonify({
            "success": True,
            "fields": report["fields"]
        })
        
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@reports_bp.route('/download_custom_report', methods=['POST'])
@jwt_required()
def download_custom_report():
    try:
        data = request.get_json()
        report_name = data.get("reportName")
        vehicle_number = data.get("vehicleNumber")
        date_range = data.get("dateRange", "all")

        # Get vehicle details including IMEI and LicensePlateNumber
        vehicle = db['vehicle_inventory'].find_one(
            {"LicensePlateNumber": vehicle_number},
            {"IMEI": 1, "LicensePlateNumber": 1, "_id": 0}
        )
        if not vehicle:
            return jsonify({"success": False, "message": "Vehicle not found"}), 404

        imei = vehicle["IMEI"]

        # For custom reports, get the fields from the saved report
        if report_name == "custom":
            custom_report_name = data.get("customReportName")
            if not custom_report_name:
                return jsonify({"success": False, "message": "Custom report name missing"}), 400
                
            report = db['custom_reports'].find_one(
                {"report_name": custom_report_name},
                {"fields": 1, "_id": 0}
            )
            if not report:
                return jsonify({"success": False, "message": "Custom report not found"}), 404
                
            fields = report["fields"]
            collection = "atlanta"
        else:
            # Standard reports configuration
            report_configs = {
                'daily-distance': {
                    'collection': 'atlanta',
                    'fields': ["date_time", "latitude", "longitude", "speed"],
                    'query': {"imei": imei, "gps": "A"},
                    'sheet_name': "Travel Path Report"
                },
                'odometer-daily-distance': {
                    'collection': 'atlanta',
                    'fields': ["date_time", "odometer", "latitude", "longitude"],
                    'query': {"imei": imei, "gps": "A"},
                    'sheet_name': "Distance Report",
                    'post_process': lambda df: process_distance_report(df, vehicle["LicensePlateNumber"])
                },
                'distance-speed-range': {
                    'collection': 'atlanta',
                    'fields': ["date_time", "speed", "latitude", "longitude"],
                    'query': {"imei": imei, "gps": "A"},
                    'sheet_name': "Speed Report"
                },
                'stoppage': {
                    'collection': 'atlanta',
                    'fields': ["date_time", "latitude", "longitude", "ignition"],
                    'query': {"imei": imei, "ignition": "0"},
                    'sheet_name': "Stoppage Report",
                    'post_process': lambda df: process_duration_report(df, "Stoppage Duration (min)")
                },
                'idle': {
                    'collection': 'atlanta',
                    'fields': ["date_time", "latitude", "longitude", "ignition", "speed"],
                    'query': {"imei": imei, "ignition": "1", "speed": "0.0"},
                    'sheet_name': "Idle Report",
                    'post_process': lambda df: process_duration_report(df, "Idle Duration (min)")
                },
                'ignition': {
                    'collection': 'atlanta',
                    'fields': ["date_time", "latitude", "longitude", "ignition"],
                    'query': {"imei": imei},
                    'sheet_name': "Ignition Report",
                    'post_process': lambda df: process_duration_report(df, "Ignition Duration (min)")
                },
                'daily': {
                    'collection': 'atlanta',
                    'fields': ["date_time", "odometer", "speed", "latitude", "longitude"],
                    'query': {"imei": imei},
                    'sheet_name': "Daily Report"
                }
            }

            if report_name not in report_configs:
                return jsonify({"success": False, "message": "Invalid report type"}), 400

            config = report_configs[report_name]
            fields = config['fields']
            collection = config['collection']
            base_query = config['query']
            post_process = config.get('post_process')

        # Add date range filter
        date_filter = get_date_range_filter(date_range)
        query = {"imei": imei}
        if date_filter:
            query.update(date_filter)
        
        # For standard reports, merge with their specific query
        if report_name != "custom":
            query.update(base_query)

        # Fetch data
        cursor = db[collection].find(
            query,
            {field: 1 for field in fields}
        ).sort("date_time", 1)

        df = pd.DataFrame(list(cursor))

        if df.empty:
            return jsonify({"success": False, "message": "No data found"}), 404

        # Add vehicle number column
        df['Vehicle Number'] = vehicle["LicensePlateNumber"]

        # Apply post-processing if defined
        if report_name != "custom" and post_process:
            df = post_process(df)

        # Remove MongoDB _id if present
        if '_id' in df.columns:
            df.drop('_id', axis=1, inplace=True)

        # Generate Excel
        output = BytesIO()
        sheet_name = config['sheet_name'] if report_name != "custom" else custom_report_name
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name=sheet_name)

        output.seek(0)
        filename = f"{report_name}_report_{vehicle_number}.xlsx" if report_name != "custom" else f"{custom_report_name}_{vehicle_number}.xlsx"
        
        return send_file(
            output,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            as_attachment=True,
            download_name=filename
        )

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

def process_distance_report(df, vehicle_number):
    """Calculate total distance traveled"""
    try:
        # Convert odometer to numeric and calculate differences
        df['odometer'] = pd.to_numeric(df['odometer'], errors='coerce')
        df['Distance (km)'] = df['odometer'].diff().fillna(0)
        
        # Calculate total distance
        total_distance = df['Distance (km)'].sum()
        
        # Add summary row
        summary_df = pd.DataFrame({
            'Vehicle Number': [vehicle_number],
            'Total Distance (km)': [total_distance],
            'Start Odometer': [df['odometer'].iloc[0]],
            'End Odometer': [df['odometer'].iloc[-1]]
        })
        
        # Combine with original data
        return pd.concat([df, summary_df], ignore_index=True)
    except Exception:
        return df

def process_duration_report(df, duration_col_name):
    """Calculate duration between records in minutes"""
    try:
        # Convert to datetime if not already
        df['date_time'] = pd.to_datetime(df['date_time'])
        
        # Calculate time differences in minutes
        df['time_diff'] = df['date_time'].diff().dt.total_seconds().div(60).fillna(0)
        df[duration_col_name] = df['time_diff'].cumsum()
        
        # Drop intermediate column
        df.drop('time_diff', axis=1, inplace=True)
        return df
    except Exception:
        return df    

@reports_bp.route('/download_panic_report', methods=['POST'])
@jwt_required()
def download_panic_report():
    try:
        data = request.get_json()
        vehicle_number = data.get("vehicleNumber")
        date_range = data.get("dateRange", "all")

        if not vehicle_number:
            return jsonify({"success": False, "message": "Please select a vehicle"}), 400

        # Get vehicle IMEI
        vehicle = db['vehicle_inventory'].find_one(
            {"LicensePlateNumber": vehicle_number},
            {"IMEI": 1, "LicensePlateNumber": 1, "_id": 0}
        )
        if not vehicle:
            return jsonify({"success": False, "message": "Vehicle not found"}), 404

        imei = vehicle["IMEI"]

        # Build query
        query = {
            "imei": imei,
            "$or": [
                {"sos": "1"},
                {"sos": 1},
                {"sos": True},
                {"status": "SOS"},
                {"alarm": "SOS"}
            ]
        }

        # Add date range filter
        date_filter = get_date_range_filter(date_range)
        if date_filter:
            query.update(date_filter)

        # Fetch data from sos_logs collection
        records = list(db['sos_logs'].find(
            query,
            {
                "date_time": 1,
                "latitude": 1,
                "longitude": 1,
                "speed": 1,
                "odometer": 1,
                "_id": 0
            }
        ).sort("date_time", 1))

        if not records:
            return jsonify({"success": False, "message": "No panic events found"}), 404

        # Create DataFrame
        df = pd.DataFrame(records)
        
        # Add vehicle number
        df['Vehicle Number'] = vehicle["LicensePlateNumber"]
        

        # Generate Excel
        output = BytesIO()
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
        return jsonify({"success": False, "message": str(e)}), 500