from flask import render_template, Blueprint, request, jsonify, send_file
from datetime import datetime, timedelta
import traceback
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
from app.geocoding import geocodeInternal, nmea_to_decimal

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
                         'InsuranceNumber', 'DriverName', 'CurrentStatus','VehicleType'
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
        
    print(all_fields)  # Debugging line to check the fields being returned
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

        # Validate fields against FIELD_COLLECTION_MAP
        valid_fields = set(FIELD_COLLECTION_MAP['atlanta'] + FIELD_COLLECTION_MAP['vehicle_inventory'])
        invalid_fields = [field for field in fields if field not in valid_fields]
        if invalid_fields:
            return jsonify({"success": False, "message": f"Invalid fields: {', '.join(invalid_fields)}"}), 400

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
        report_type = data.get("reportType")
        vehicle_number = data.get("vehicleNumber")
        date_range = data.get("dateRange", "all")

        # Get vehicle details including IMEI and LicensePlateNumber
        vehicle = db['vehicle_inventory'].find_one(
            {"LicensePlateNumber": vehicle_number},
            {"IMEI": 1, "LicensePlateNumber": 1, "_id": 0}
        )
        if not vehicle:
            return jsonify({"success": False, "message": "Vehicle not found", "category":"danger"}), 404

        imei = vehicle["IMEI"]

        # For custom reports, get the fields from the saved report
        if report_type == "custom":
            custom_report_name = data.get("reportName")
            if not custom_report_name:
                return jsonify({"success": False, "message": "Custom report name missing", "category":"danger"}), 400

            report = db['custom_reports'].find_one(
                {"report_name": custom_report_name},
                {"fields": 1, "_id": 0}
            )
            if not report:
                return jsonify({"success": False, "message": "Custom report not found", "category":"danger"}), 404

            fields = report["fields"]

            # Separate fields by collection
            atlanta_fields = [field for field in fields if field in FIELD_COLLECTION_MAP['atlanta']]
            vehicle_inventory_fields = [field for field in fields if field in FIELD_COLLECTION_MAP['vehicle_inventory']]
            print(f"ATLANTA FIELDS: {atlanta_fields}, VEHICLE INVENTORY FIELDS: {vehicle_inventory_fields}")  # Debugging line
            
            # Fetch data from vehicle_inventory
            vehicle_inventory_data = None
            if vehicle_inventory_fields:
                vehicle_inventory_data = db['vehicle_inventory'].find_one(
                    {"IMEI": imei},
                    {field: 1 for field in vehicle_inventory_fields}
                )

            # Fetch data from atlanta
            date_filter = get_date_range_filter(date_range)
            atlanta_query = {"imei": imei}
            if date_filter:
                atlanta_query.update(date_filter)

            if atlanta_fields:
                atlanta_data = list(db['atlanta'].find(
                    atlanta_query,
                    {field: 1 for field in atlanta_fields}
                ).sort("date_time", 1))

            # Combine data
            if atlanta_data and vehicle_inventory_data:
                combined_data = []
                for record in atlanta_data:
                    combined_record = {**vehicle_inventory_data, **record}
                    combined_data.append(combined_record)
            elif atlanta_data and not vehicle_inventory_data:
                combined_data = atlanta_data
            elif not atlanta_data and vehicle_inventory_data:
                combined_data = [vehicle_inventory_data]
            else:
                return jsonify({"success": False, "message": "No data found", "category": "warning"}), 404

            # Convert to DataFrame
            df = pd.DataFrame(combined_data)

            if df.empty:
                return jsonify({"success": False, "message": "No data found", "category": "warning"}), 404

            # Process latitude and longitude if present
            print(f"DataFrame columns: {df.columns}")
            if 'latitude' in df.columns and 'longitude' in df.columns:
                df['latitude'] = df['latitude'].apply(
                    lambda x: nmea_to_decimal(x) if pd.notnull(x) and x != "" else x
                )
                df['longitude'] = df['longitude'].apply(
                    lambda x: nmea_to_decimal(x) if pd.notnull(x) and x != "" else x
                )

                df['Location'] = df.apply(
                    lambda row: geocodeInternal(row['latitude'], row['longitude'])
                    if pd.notnull(row['latitude']) and row['latitude'] != "" and
                       pd.notnull(row['longitude']) and row['longitude'] != ""
                    else 'Missing coordinates',
                    axis=1
                )

                cols = df.columns.tolist()
                if 'Location' in cols:
                    cols.remove('Location')
                lng_idx = cols.index('longitude')
                cols.insert(lng_idx + 1, 'Location')
                df = df[cols]

            df.insert(0, 'Vehicle Number', vehicle["LicensePlateNumber"])

            # Remove MongoDB _id if present
            if '_id' in df.columns:
                df.drop('_id', axis=1, inplace=True)
            print(f"DataFrame columns: {df.columns}")

            if "ignition" in fields:
                df['ignition'] = df['ignition'].replace({"0": "OFF", "1": "ON"})

            # Generate Excel
            output = BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                df.to_excel(writer, index=False, sheet_name=custom_report_name)

            output.seek(0)
            return send_file(
                output,
                mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                as_attachment=True,
                download_name=f"{custom_report_name}_{vehicle_number}.xlsx"
            )

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
                    'query': {"imei": imei, "ignition": "0", "gps": "A"},
                    'sheet_name': "Stoppage Report",
                    'post_process': lambda df: process_duration_report(df, "Stoppage Duration (min)")
                },
                'idle': {
                    'collection': 'atlanta',
                    'fields': ["date_time", "latitude", "longitude", "ignition", "speed"],
                    'query': {"imei": imei, "ignition": "1", "speed": "0.0", "gps": "A"},
                    'sheet_name': "Idle Report",
                    'post_process': lambda df: process_duration_report(df, "Idle Duration (min)")
                },
                'ignition': {
                    'collection': 'atlanta',
                    'fields': ["date_time", "latitude", "longitude", "ignition"],
                    'query': {"imei": imei, "gps": "A"},
                    'sheet_name': "Ignition Report",
                    'post_process': lambda df: process_duration_report(df, "Ignition Duration (min)")
                },
                'daily': {
                    'collection': 'atlanta',
                    'fields': ["date_time", "odometer", "speed", "latitude", "longitude"],
                    'query': {"imei": imei, "gps": "A"},
                    'sheet_name': "Daily Report"
                }
            }

            if report_type not in report_configs:
                return jsonify({"success": False, "message": "Invalid report type", "category": "danger"}), 400

            config = report_configs[report_type]
            fields = config['fields']
            collection = config['collection']
            base_query = config['query']
            post_process = config.get('post_process')

            # Add date range filter
            date_filter = get_date_range_filter(date_range)
            query = {"imei": imei}
            if date_filter:
                query.update(date_filter)

            # Merge with specific query for standard reports
            query.update(base_query)

            # Fetch data
            cursor = db[collection].find(
                query,
                {field: 1 for field in fields}
            ).sort("date_time", 1)

            df = pd.DataFrame(list(cursor))

            if df.empty:
                return jsonify({"success": False, "message": "No data found", "category": "warning"}), 404

            # Process latitude and longitude if present
            if 'latitude' in df.columns and 'longitude' in df.columns:
                df['latitude'] = df['latitude'].apply(
                    lambda x: nmea_to_decimal(x) if pd.notnull(x) and x != "" else x
                )
                df['longitude'] = df['longitude'].apply(
                    lambda x: nmea_to_decimal(x) if pd.notnull(x) and x != "" else x
                )

                df['Location'] = df.apply(
                    lambda row: geocodeInternal(row['latitude'], row['longitude'])
                    if pd.notnull(row['latitude']) and row['latitude'] != "" and
                       pd.notnull(row['longitude']) and row['longitude'] != ""
                    else 'Missing coordinates',
                    axis=1
                )

                cols = df.columns.tolist()
                if 'Location' in cols:
                    cols.remove('Location')
                lng_idx = cols.index('longitude')
                cols.insert(lng_idx + 1, 'Location')
                df = df[cols]

            # Add vehicle number column
            df.insert(0, 'Vehicle Number', vehicle["LicensePlateNumber"])

            # Apply post-processing if defined
            if post_process:
                df = post_process(df)

            # Remove MongoDB _id if present
            if '_id' in df.columns:
                df.drop('_id', axis=1, inplace=True)

            if "ignition" in fields:
                df['ignition'] = df['ignition'].replace({"0": "OFF", "1": "ON"})

            # Generate Excel
            output = BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                df.to_excel(writer, index=False, sheet_name=config['sheet_name'])

            output.seek(0)
            return send_file(
                output,
                mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                as_attachment=True,
                download_name=f"{report_type}_report_{vehicle_number}.xlsx"
            )

    except Exception as e:
        return jsonify({"success": False, "message": str(e), "category": "danger"}), 500

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
        print(f"Received vehicle_number: {vehicle_number}, date_range: {date_range}")  # Debugging line

        if not vehicle_number:
            return jsonify({"success": False, "message": "Please select a vehicle", "category": "danger"}), 400

        # Get vehicle IMEI
        vehicle = db['vehicle_inventory'].find_one(
            {"LicensePlateNumber": vehicle_number},
            {"IMEI": 1, "LicensePlateNumber": 1, "_id": 0}
        )
        if not vehicle:
            return jsonify({"success": False, "message": "Vehicle not found", "category": "danger"}), 404

        imei = vehicle["IMEI"]

        # Simplified query without $where
        query = {
            "imei": imei,
            "$or": [
                {"sos": {"$in": ["1", 1, True]}},
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
            # Also check atlanta collection if no records found in sos_logs
            records = list(db['atlanta'].find(
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
                return jsonify({"success": True, "message": "No panic events found", "category":"warning"}), 404

        # Create DataFrame
        df = pd.DataFrame(records)
        
        # Reorder columns - Vehicle Number first, then date_time
        df.insert(0, 'Vehicle Number', vehicle["LicensePlateNumber"])
        if 'date_time' in df.columns:
            cols = ['Vehicle Number', 'date_time'] + [col for col in df.columns if col not in ['Vehicle Number', 'date_time']]
            df = df[cols]
        
        df['latitude'] = df['latitude'].apply(
            lambda x: nmea_to_decimal(x) if pd.notnull(x) and x != "" else x
        )
        df['longitude'] = df['longitude'].apply(
            lambda x: nmea_to_decimal(x) if pd.notnull(x) and x != "" else x
        )

        # Add Location column
        df['Location'] = df.apply(
            lambda row: geocodeInternal(row['latitude'], row['longitude'])
            if pd.notnull(row['latitude']) and row['latitude'] != "" and
               pd.notnull(row['longitude']) and row['longitude'] != ""
            else 'Missing coordinates',
            axis=1
        )

        cols = df.columns.tolist()
        if 'Location' in cols:
            cols.remove('Location')
        lng_idx = cols.index('longitude')
        cols.insert(lng_idx + 1, 'Location')
        df = df[cols]

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
        print(f"Error generating panic report: {str(e)}")  # Add this for debugging
        traceback.print_exc()  # Add this to print full traceback
        return jsonify({"success": False, "message": str(e), "category": "danger"}), 500