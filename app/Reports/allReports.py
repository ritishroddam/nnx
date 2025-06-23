from flask import render_template, Blueprint, request, jsonify, send_file, Response
import json
from datetime import datetime, timedelta
import traceback
from pymongo import MongoClient
import pandas as pd
from datetime import datetime
import pytz
from pytz import timezone
from io import BytesIO
from collections import OrderedDict
from app.database import db
from flask_jwt_extended import get_jwt, jwt_required, get_jwt_identity
from app.models import User
from app.utils import roles_required
from app.geocoding import geocodeInternal


reports_bp = Blueprint('Reports', __name__, static_folder='static', template_folder='templates')

IST = timezone('Asia/Kolkata')

# Define field to collection mapping
FIELD_COLLECTION_MAP = {
    'atlanta': ['status', 'time', 'gps', 'latitude', 'longitude', 'speed', 
                'date', 'ignition', 'door', 'sos', 'main_power', 'odometer',
                'internal_bat', 'gsm_sig', 'cellid', 'temp', 'harsh_speed',
                'timestamp', 'course', 'checksum', 'reserve1', 'reserve2',
                'ac', 'reserve3', 'harsh_break', 'arm', 'sleep', 'reserve4',
                'status_accelerometer', 'adc_voltage', 'one_wire_temp', 'i_btn',
                'onBoard_temp', 'mobCountryCode', 'mobNetworkCode', 'localAreaCode',
                'Average Speed', 'Maximum Speed'],
    'vehicle_inventory': ['LicensePlateNumber', 'IMEI', 'SIM', 'VehicleModel', 
                         'VehicleMake', 'YearOfManufacture', 'DateOfPurchase',
                         'InsuranceNumber', 'DriverName', 'CurrentStatus','VehicleType'
                         'Location', 'OdometerReading', 'ServiceDueDate'],
    'sos_logs': ['imei', 'date', 'time', 'latitude', 'longitude', 'date_time', 'timestamp']
}

def get_date_range_filter(date_range, from_date=None, to_date=None):
    tz = pytz.UTC
    now = datetime.now(tz)

    if date_range == "last24hours":
        return {'date_time': {'$gte': now - timedelta(hours=24)}}
    elif date_range == "today":
        today_start = datetime(now.year, now.month, now.day, tzinfo=tz)
        return {'date_time': {'$gte': today_start}}
    elif date_range == "yesterday":
        ist = timezone('Asia/Kolkata')
        now_ist = datetime.now(ist)
        today_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
        yesterday_start_ist = today_ist - timedelta(days=1)
        yesterday_end_ist = today_ist
        yesterday_start_utc = yesterday_start_ist.astimezone(pytz.UTC)
        yesterday_end_utc = yesterday_end_ist.astimezone(pytz.UTC)
        return {'date_time': {'$gte': yesterday_start_utc, '$lt': yesterday_end_utc}}
    elif date_range == "last7days":
        return {'date_time': {'$gte': now - timedelta(days=7)}}
    elif date_range == "last30days":
        return {'date_time': {'$gte': now - timedelta(days=30)}}
    elif date_range == "custom" and from_date and to_date:
        try:
            from_datetime = datetime.strptime(from_date, "%Y-%m-%dT%H:%M").replace(tzinfo=tz)
            to_datetime = datetime.strptime(to_date, "%Y-%m-%dT%H:%M").replace(tzinfo=tz)
            three_months_ago = now - timedelta(days=90)
            if from_datetime < three_months_ago or to_datetime < three_months_ago:
                raise ValueError("Date range cannot be older than 3 months")
            if from_datetime > to_datetime:
                raise ValueError("From date cannot be after To date")
            return {'date_time': {'$gte': from_datetime, '$lte': to_datetime}}
        except ValueError as e:
            raise ValueError(f"Invalid custom date range: {str(e)}")
    return {}

def getDateRanges(date_range):
    tz = pytz.timezone('Asia/Kolkata')
    now = datetime.now(tz)

    if date_range == "last24hours":
        return f"Last 24 hours from {now.strftime('%Y-%m-%d %H:%M:%S')}"
    elif date_range == "today":
        today_start = datetime(now.year, now.month, now.day, tzinfo=tz)
        return f"{today_start.strftime('%Y-%m-%d')}"
    elif date_range == "yesterday":
        yesterday_start_ist = now - timedelta(days=1)
        return f"{yesterday_start_ist.strftime('%Y-%m-%d')}"
    elif date_range == "last7days":
        return f"{(now - timedelta(days=7)).strftime('%Y-%m-%d')} to {now.strftime('%Y-%m-%d')}" 
    elif date_range == "last30days":
        return f"{(now - timedelta(days=30)).strftime('%Y-%m-%d')} to {now.strftime('%Y-%m-%d')}"
    return f"Hi"

def process_distance_report(df, vehicle_number):
    """Calculate total distance traveled"""
    try:
        # Convert odometer to numeric and calculate differences
        df['odometer'] = pd.to_numeric(df['odometer'], errors='coerce')
        df['Distance (km)'] = df['odometer'].diff().fillna(0)

        # Calculate total distance
        total_distance = df['Distance (km)'].sum()
        
        summary_df = pd.DataFrame({
            'Vehicle Number': [vehicle_number],
            'Total Distance (km)': [total_distance],
            'Start Odometer': [df['odometer'].iloc[0]],
            'End Odometer': [df['odometer'].iloc[-1]]
        })

        summary_df = summary_df[['Vehicle Number', 'Total Distance (km)', 'Start Odometer', 'End Odometer']]
        
        return summary_df
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

def add_speed_metrics(df):
    """Add average and maximum speed columns to DataFrame"""
    try:
        if 'speed' in df.columns:
            # Convert speed to numeric if it's not already
            df['speed'] = pd.to_numeric(df['speed'], errors='coerce')

            # Calculate average and max speed
            avg_speed = df['speed'].mean()
            max_speed = df['speed'].max()

            # Add columns to DataFrame
            df['Average Speed'] = avg_speed
            df['Maximum Speed'] = max_speed

            # Move these columns next to the speed column if it exists
            if 'speed' in df.columns:
                cols = df.columns.tolist()
                speed_idx = cols.index('speed')
                if 'Average Speed' in cols:
                    cols.remove('Average Speed')
                if 'Maximum Speed' in cols:
                    cols.remove('Maximum Speed')
                cols.insert(speed_idx + 1, 'Average Speed')
                cols.insert(speed_idx + 2, 'Maximum Speed')
                df = df[cols]
    except Exception as e:
        print(f"Error adding speed metrics: {str(e)}")
    return df

@reports_bp.route('/')
@jwt_required()
def index():
    claims = get_jwt()
    user_roles = claims.get('roles', [])

    if 'admin' in user_roles:
        vehicles = list(db['vehicle_inventory'].find({}, {"LicensePlateNumber": 1, "_id": 0}))
        reports = list(db['custom_reports'].find({}, {"_id": 0, "report_name": 1, "fields": 1}))
        return render_template('allReport.html', vehicles=vehicles, reports=reports)
    if 'clientAdmin' in user_roles:
        userCompany = claims.get('company')
        userCompanyID = claims.get('company_id')
        vehicles = list(db['vehicle_inventory'].find({"CompanyName": userCompany}, {"LicensePlateNumber": 1, "_id": 0}))
        reports = list(db['custom_reports'].find({"company_id": userCompanyID}, {"_id": 0, "report_name": 1, "fields": 1}))
        return render_template('allReport.html', vehicles=vehicles, reports=reports)
    else:
        userCompany = claims.get('company')
        userName = claims.get('username')
        vehicles = list(db['vehicle_inventory'].find({"CompanyName": userCompany}, {"LicensePlateNumber": 1, "_id": 0}))
        reports = list(db['custom_reports'].find({"created_by": userName}, {"_id": 0, "report_name": 1, "fields": 1}))
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
            "created_by": get_jwt_identity(),
            "company_id": get_jwt()['company_id']
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
        from_date = data.get("fromDate")
        to_date = data.get("toDate")

        def process_df(df, license_plate, fields, post_process=None):
            if df.empty:
                return None
            if 'date_time' in df.columns:
                df['date_time'] = pd.to_datetime(df['date_time']).dt.tz_convert(IST).dt.tz_localize(None)
            if 'latitude' in df.columns and 'longitude' in df.columns:
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
            if 'Vehicle Number' not in df.columns:
                df.insert(0, 'Vehicle Number', license_plate)
            if '_id' in df.columns:
                df.drop('_id', axis=1, inplace=True)
            if "ignition" in fields:
                df['ignition'] = df['ignition'].replace({"0": "OFF", "1": "ON"})
            if 'speed' in df.columns:
                df = add_speed_metrics(df)
            if post_process:
                df = post_process(df)
            return df

        # Report configs (for single vehicle, but fields used for all)
        report_configs = {
            'daily-distance': {
                'collection': 'atlanta',
                'fields': ["date_time", "latitude", "longitude", "speed"],
                'query': {"gps": "A"},
                'sheet_name': "Travel Path Report"
            },
            'odometer-daily-distance': {
                'collection': 'atlanta',
                'fields': ["date_time", "odometer", "latitude", "longitude"],
                'query': {"gps": "A"},
                'sheet_name': "Distance Report",
                'post_process': lambda df, license_plate: process_distance_report(df, license_plate)
            },
            'distance-speed-range': {
                'collection': 'atlanta',
                'fields': ["date_time", "speed", "latitude", "longitude"],
                'query': {"gps": "A"},
                'sheet_name': "Speed Report"
            },
            'stoppage': {
                'collection': 'atlanta',
                'fields': ["date_time", "latitude", "longitude", "ignition"],
                'query': {"ignition": "0", "gps": "A"},
                'sheet_name': "Stoppage Report",
                'post_process': lambda df, _: process_duration_report(df, "Stoppage Duration (min)")
            },
            'idle': {
                'collection': 'atlanta',
                'fields': ["date_time", "latitude", "longitude", "ignition", "speed"],
                'query': {"ignition": "1", "speed": "0.0", "gps": "A"},
                'sheet_name': "Idle Report",
                'post_process': lambda df, _: process_duration_report(df, "Idle Duration (min)")
            },
            'ignition': {
                'collection': 'atlanta',
                'fields': ["date_time", "latitude", "longitude", "ignition"],
                'query': {"gps": "A"},
                'sheet_name': "Ignition Report",
                'post_process': lambda df, _: process_duration_report(df, "Ignition Duration (min)")
            },
            'daily': {
                'collection': 'atlanta',
                'fields': ["date_time", "odometer", "speed", "latitude", "longitude"],
                'query': {"gps": "A"},
                'sheet_name': "Daily Report"
            }
        }

        # Handle "all" vehicles
        if vehicle_number == "all":
            claims = get_jwt()
            user_roles = claims.get('roles', [])
            userCompany = claims.get('company')
            if 'admin' in user_roles:
                vehicles = get_all_vehicles()
            else:
                vehicles = get_all_vehicles({"CompanyName": userCompany})

            imei_to_plate = {v["IMEI"]: v["LicensePlateNumber"] for v in vehicles if v.get("IMEI") and v.get("LicensePlateNumber")}
            imeis = list(imei_to_plate.keys())
            all_dfs = []

            if report_type == "custom":
                custom_report_name = data.get("reportName")
                if not custom_report_name:
                    return jsonify({"success": False, "message": "Custom report name missing", "category": "danger"}), 400
                report = db['custom_reports'].find_one(
                    {"report_name": custom_report_name},
                    {"fields": 1, "_id": 0}
                )
                if not report:
                    return jsonify({"success": False, "message": "Custom report not found", "category": "danger"}), 404
                fields = report["fields"]
                atlanta_fields = [f for f in fields if f in FIELD_COLLECTION_MAP['atlanta']]
                vehicle_inventory_fields = [f for f in fields if f in FIELD_COLLECTION_MAP['vehicle_inventory']]
                date_filter = get_date_range_filter(date_range, from_date, to_date)
                atlanta_query = {"imei": {"$in": imeis}}
                if date_filter:
                    atlanta_query.update(date_filter)
                atlanta_data = list(db['atlanta'].find(
                    atlanta_query,
                    {field: 1 for field in atlanta_fields + ["imei"]}
                ).sort("date_time", 1)) if atlanta_fields else []

                # Get all vehicle_inventory data at once
                vehicle_inventory_data_map = {}
                if vehicle_inventory_fields:
                    for v in db['vehicle_inventory'].find(
                        {"IMEI": {"$in": imeis}},
                        {field: 1 for field in vehicle_inventory_fields + ["IMEI"]}
                    ):
                        vehicle_inventory_data_map[v["IMEI"]] = v

                # Group atlanta_data by IMEI
                from collections import defaultdict
                grouped = defaultdict(list)
                for rec in atlanta_data:
                    grouped[rec["imei"]].append(rec)

                for imei in imeis:
                    license_plate = imei_to_plate[imei]
                    atlanta_records = grouped.get(imei, [])
                    vehicle_inventory_data = vehicle_inventory_data_map.get(imei)
                    if atlanta_records and vehicle_inventory_data:
                        combined_data = [{**vehicle_inventory_data, **rec} for rec in atlanta_records]
                    elif atlanta_records:
                        combined_data = atlanta_records
                    elif vehicle_inventory_data:
                        combined_data = [vehicle_inventory_data]
                    else:
                        continue
                    df = pd.DataFrame(combined_data)
                    df = process_df(df, license_plate, fields)
                    if df is not None:
                        all_dfs.append(df)
            else:
                if report_type not in report_configs:
                    return jsonify({"success": False, "message": "Invalid report type", "category": "danger"}), 400
                config = report_configs[report_type]
                fields = config['fields']
                collection = config['collection']
                base_query = config['query']
                post_process = config.get('post_process')
                date_filter = get_date_range_filter(date_range, from_date, to_date)
                query = {"imei": {"$in": imeis}}
                if date_filter:
                    query.update(date_filter)
                query.update(base_query)
                cursor = db[collection].find(
                    query,
                    {field: 1 for field in fields + ["imei"]}
                ).sort("date_time", 1)
                df = pd.DataFrame(list(cursor))
                if not df.empty:
                    for imei, group in df.groupby("imei"):
                        license_plate = imei_to_plate.get(imei, "")
                        group = group.drop(columns=["imei"])
                        processed = process_df(group, license_plate, fields, (lambda d: post_process(d, license_plate)) if post_process else None)
                        if processed is not None:
                            all_dfs.append(processed)

            if not all_dfs:
                return jsonify({"success": False, "message": "No data found", "category": "warning"}), 404
            final_df = pd.concat(all_dfs, ignore_index=True)
            output = BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                final_df.to_excel(writer, index=False, sheet_name="All Vehicles Report")
            output.seek(0)
            return send_file(
                output,
                mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                as_attachment=True,
                download_name=f"{report_type}_report_ALL_VEHICLES.xlsx"
            )

        # Single vehicle
        vehicle = db['vehicle_inventory'].find_one(
            {"LicensePlateNumber": vehicle_number},
            {"IMEI": 1, "LicensePlateNumber": 1, "_id": 0}
        )
        if not vehicle:
            return jsonify({"success": False, "message": "Vehicle not found", "category": "danger"}), 404

        imei = vehicle["IMEI"]

        if report_type == "custom":
            custom_report_name = data.get("reportName")
            if not custom_report_name:
                return jsonify({"success": False, "message": "Custom report name missing", "category": "danger"}), 400
            report = db['custom_reports'].find_one(
                {"report_name": custom_report_name},
                {"fields": 1, "_id": 0}
            )
            if not report:
                return jsonify({"success": False, "message": "Custom report not found", "category": "danger"}), 404
            fields = report["fields"]
            atlanta_fields = [f for f in fields if f in FIELD_COLLECTION_MAP['atlanta']]
            vehicle_inventory_fields = [f for f in fields if f in FIELD_COLLECTION_MAP['vehicle_inventory']]
            vehicle_inventory_data = db['vehicle_inventory'].find_one(
                {"IMEI": imei},
                {field: 1 for field in vehicle_inventory_fields}
            ) if vehicle_inventory_fields else None
            date_filter = get_date_range_filter(date_range, from_date, to_date)
            atlanta_query = {"imei": imei}
            if date_filter:
                atlanta_query.update(date_filter)
            atlanta_data = list(db['atlanta'].find(
                atlanta_query,
                {field: 1 for field in atlanta_fields}
            ).sort("date_time", 1)) if atlanta_fields else []
            if atlanta_data and vehicle_inventory_data:
                combined_data = [{**vehicle_inventory_data, **rec} for rec in atlanta_data]
            elif atlanta_data:
                combined_data = atlanta_data
            elif vehicle_inventory_data:
                combined_data = [vehicle_inventory_data]
            else:
                return jsonify({"success": False, "message": "No data found", "category": "warning"}), 404
            df = pd.DataFrame(combined_data)
            df = process_df(df, vehicle["LicensePlateNumber"], fields)
            if df is None:
                return jsonify({"success": False, "message": "No data found", "category": "warning"}), 404
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

        # Standard reports for single vehicle
        if report_type not in report_configs:
            return jsonify({"success": False, "message": "Invalid report type", "category": "danger"}), 400
        config = report_configs[report_type]
        fields = config['fields']
        collection = config['collection']
        base_query = config['query']
        post_process = config.get('post_process')
        date_filter = get_date_range_filter(date_range)
        query = {"imei": imei}
        if date_filter:
            query.update(date_filter)
        query.update(base_query)
        cursor = db[collection].find(
            query,
            {field: 1 for field in fields}
        ).sort("date_time", 1)
        df = pd.DataFrame(list(cursor))
        df = process_df(df, vehicle["LicensePlateNumber"], fields, (lambda d: post_process(d, vehicle["LicensePlateNumber"])) if post_process else None)
        if df is None:
            return jsonify({"success": False, "message": "No data found", "category": "warning"}), 404
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

@reports_bp.route('/delete_custom_report', methods=['DELETE'])
@jwt_required()
def delete_custom_report():
    try:
        report_name = request.args.get('name')
        if not report_name:
            return jsonify({"success": False, "message": "Report name missing"}), 400
        result = db['custom_reports'].delete_one({"report_name": report_name})
        if result.deleted_count == 1:
            return jsonify({"success": True, "message": "Report deleted"})
        else:
            return jsonify({"success": False, "message": "Report not found"}), 404
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@reports_bp.route('/download_panic_report', methods=['POST'])
@jwt_required()
def download_panic_report():
    try:
        data = request.get_json()
        vehicle_number = data.get("vehicleNumber")
        date_range = data.get("dateRange", "all")

        if not vehicle_number:
            return jsonify({"success": False, "message": "Please select a vehicle", "category": "danger"}), 400

        # Get vehicle IMEI
        # Handle "all" vehicles
        if vehicle_number == "all":
            claims = get_jwt()
            user_roles = claims.get('roles', [])
            if 'admin' in user_roles:
                vehicles = get_all_vehicles()
            elif 'clientAdmin' in user_roles:
                userCompany = claims.get('company')
                vehicles = get_all_vehicles({"CompanyName": userCompany})
            else:
                userCompany = claims.get('company')
                vehicles = get_all_vehicles({"CompanyName": userCompany})

            all_dfs = []
            for vehicle in vehicles:
                imei = vehicle.get("IMEI")
                license_plate = vehicle.get("LicensePlateNumber")
                if not imei or not license_plate:
                    continue
                query = {
                    "imei": imei,
                    "$or": [
                        {"sos": {"$in": ["1", 1, True]}},
                        {"status": "SOS"},
                        {"alarm": "SOS"}
                    ]
                }
                date_filter = get_date_range_filter(date_range)
                if date_filter:
                    query.update(date_filter)
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
                        continue
                df = pd.DataFrame(records)
                if 'date_time' in df.columns:
                    df['date_time'] = pd.to_datetime(df['date_time']).dt.tz_convert(IST).dt.tz_localize(None)
                df.insert(0, 'Vehicle Number', license_plate)
                if 'date_time' in df.columns:
                    cols = ['Vehicle Number', 'date_time'] + [col for col in df.columns if col not in ['Vehicle Number', 'date_time']]
                    df = df[cols]
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
                if 'speed' in df.columns:
                    df = add_speed_metrics(df)
                all_dfs.append(df)
            if not all_dfs:
                return jsonify({"success": True, "message": "No panic events found", "category":"warning"}), 404
            final_df = pd.concat(all_dfs, ignore_index=True)
            output = BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                final_df.to_excel(writer, index=False, sheet_name="Panic Report")
            output.seek(0)
            return send_file(
                output,
                mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                as_attachment=True,
                download_name=f"panic_report_ALL_VEHICLES.xlsx"
            )
        # ...existing single-vehicle logic below...
        # Get vehicle details including IMEI and LicensePlateNumber
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

        if 'date_time' in df.columns:
            df['date_time'] = pd.to_datetime(df['date_time']).dt.tz_convert(IST).dt.tz_localize(None)

        # Reorder columns - Vehicle Number first, then date_time
        df.insert(0, 'Vehicle Number', vehicle["LicensePlateNumber"])
        if 'date_time' in df.columns:
            cols = ['Vehicle Number', 'date_time'] + [col for col in df.columns if col not in ['Vehicle Number', 'date_time']]
            df = df[cols]

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

        if 'speed' in df.columns:
            df = add_speed_metrics(df)

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

def get_all_vehicles(query=None):
    """Return a list of all vehicles' LicensePlateNumber and IMEI."""
    if query is None:
        query = {}
    return list(db['vehicle_inventory'].find(query, {"LicensePlateNumber": 1, "IMEI": 1, "_id": 0}))

@reports_bp.route('/view_report_preview', methods=['POST'])
@jwt_required()
def view_report_preview():
    try:
        data = request.get_json()
        report_type = data.get("reportType")
        vehicle_number = data.get("vehicleNumber")
        date_range = data.get("dateRange", "all")
        from_date = data.get("fromDate")
        to_date = data.get("toDate")
        report_name = data.get("reportName")

        vehicle = db['vehicle_inventory'].find_one(
            {"LicensePlateNumber": vehicle_number},
            {"IMEI": 1, "LicensePlateNumber": 1, "_id": 0}
        )
        if not vehicle:
            return jsonify({"success": False, "message": "Vehicle not found"}), 404

        imei = vehicle["IMEI"]
        license_plate = vehicle["LicensePlateNumber"]

        query = {"imei": imei}
        if date_range:
            date_filter = get_date_range_filter(date_range, from_date, to_date)
            query.update(date_filter)

        # Define report configurations with exact columns for each report type
        report_configs = {
            'daily-distance': {  # Travel Path Report
                'collection': 'atlanta',
                'base_fields': ["date_time", "latitude", "longitude", "speed"],
                'query': {"gps": "A"},
                'post_process': lambda df: add_speed_metrics(df)
            },
            'odometer-daily-distance': {  # Distance Report
                'collection': 'atlanta',
                'base_fields': ["date_time", "odometer", "latitude", "longitude"],
                'query': {"gps": "A"},
                'post_process': lambda df : process_distance_report(df, license_plate)
            },
            'distance-speed-range': {  # Speed Report
                'collection': 'atlanta',
                'base_fields': ["date_time", "speed", "latitude", "longitude"],
                'query': {"gps": "A"},
                'post_process': lambda df: add_speed_metrics(df)
            },
            'stoppage': {  # Stoppage Report
                'collection': 'atlanta',
                'base_fields': ["date_time", "latitude", "longitude", "ignition"],
                'query': {"ignition": "0", "gps": "A"},
                'post_process': lambda df: process_duration_report(df, "Stoppage Duration (min)")
            },
            'idle': {  # Idle Report
                'collection': 'atlanta',
                'base_fields': ["date_time", "latitude", "longitude", "ignition", "speed"],
                'query': {"ignition": "1", "speed": "0.0", "gps": "A"},
                'post_process': lambda df: process_duration_report(df, "Idle Duration (min)")
            },
            'ignition': {  # Ignition Report
                'collection': 'atlanta',
                'base_fields': ["date_time", "latitude", "longitude", "ignition"],
                'query': {"gps": "A"},
                'post_process': lambda df: process_duration_report(df, "Ignition Duration (min)")
            },
            'daily': {  # Daily Report
                'collection': 'atlanta',
                'base_fields': ["date_time", "odometer", "speed", "latitude", "longitude"],
                'query': {"gps": "A"},
                'post_process': lambda df: add_speed_metrics(df)
            },
            'panic': {  # Panic Report
                'collection': 'atlanta',
                'base_fields': ["date_time", "latitude", "longitude", "speed", "odometer"],
                'query': {
                    "$or": [
                        {"sos": {"$in": ["1", 1, True]}},
                        {"status": "SOS"},
                        {"alarm": "SOS"}
                    ]
                },
                'post_process': lambda df: add_speed_metrics(df)
            },
            'custom': {
                'collection': 'atlanta',
                'base_fields': [],  # Will be populated from custom report config
                'query': {},
                'post_process': lambda df: df
            }
        }

        if report_type == "custom":
            # Get fields from custom report configuration
            if not report_name:
                return jsonify({"success": False, "message": "Custom report name missing"}), 400

            report = db['custom_reports'].find_one(
                {"report_name": report_name},
                {"fields": 1, "_id": 0}
            )
            if not report:
                return jsonify({"success": False, "message": "Custom report not found"}), 404

            fields = report["fields"]
            # Separate fields by collection
            atlanta_fields = [field for field in fields if field in FIELD_COLLECTION_MAP['atlanta']]
            vehicle_inventory_fields = [field for field in fields if field in FIELD_COLLECTION_MAP['vehicle_inventory']]
            
            # Fetch data from vehicle_inventory
            vehicle_inventory_data = None
            if vehicle_inventory_fields:
                vehicle_inventory_data = db['vehicle_inventory'].find_one(
                    {"IMEI": imei},
                    {field: 1 for field in vehicle_inventory_fields}
                )

            # Fetch data from atlanta
            if atlanta_fields:
                atlanta_data = list(db['atlanta'].find(
                    query,
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
                return jsonify({"success": True, "data": []})

            df = pd.DataFrame(combined_data)
        else:
            if report_type not in report_configs:
                return jsonify({"success": False, "message": "Invalid report type"}), 400

            config = report_configs[report_type]
            fields = config['base_fields']
            query.update(config['query'])

            projection = {field: 1 for field in fields}
            projection["_id"] = 0
            
            cursor = db[config['collection']].find(query, projection).sort("date_time", 1)
            
            if report_type != "odometer-daily-distance":
                df = pd.DataFrame(list(cursor))

            if report_type == "odometer-daily-distance" and config['post_process']:   
                df = config['post_process'](pd.DataFrame(list(cursor)))
            else:   
                if not df.empty and config['post_process']:
                    df = config['post_process'](df)

        if df.empty:
            return jsonify({"success": True, "data": []})

        # Common processing for all reports
        if 'date_time' in df.columns:
            df['date_time'] = pd.to_datetime(df['date_time']).dt.tz_convert(IST).dt.tz_localize(None).astype(str)

        if 'latitude' in df.columns and 'longitude' in df.columns:
            df['Location'] = df.apply(
                lambda row: geocodeInternal(row['latitude'], row['longitude'])
                if pd.notnull(row['latitude']) and row['latitude'] != "" and
                   pd.notnull(row['longitude']) and row['longitude'] != ""
                else 'Missing coordinates',
                axis=1
            )
            # Reorder columns to place Location after longitude
            cols = df.columns.tolist()
            if 'Location' in cols:
                cols.remove('Location')
            lng_idx = cols.index('longitude') if 'longitude' in cols else len(cols)
            cols.insert(lng_idx + 1, 'Location')
            df = df[cols]

        if "ignition" in df.columns:
            df['ignition'] = df['ignition'].replace({"0": "OFF", "1": "ON"})

        # Add Vehicle Number as first column
        if 'Vehicle Number' not in df.columns:
            df.insert(0, 'Vehicle Number', license_plate)

        # Ensure consistent column order for each report type
        if report_type in report_configs:
            # Get all possible columns for this report type
            all_possible_columns = ['Vehicle Number']
            if report_type == 'odometer-daily-distance':  # Distance Report
                all_possible_columns.extend([
                    'Total Distance (km)', 'Start Odometer', 'End Odometer'
                ])
            elif report_type == 'stoppage':  # Stoppage Report
                all_possible_columns.extend([
                    'date_time', 'latitude', 'longitude', 'Location', 'ignition',
                    'Stoppage Duration (min)'
                ])
            elif report_type == 'idle':  # Idle Report
                all_possible_columns.extend([
                    'date_time', 'latitude', 'longitude', 'Location', 'speed',
                    'Average Speed', 'Maximum Speed', 'ignition', 'Idle Duration (min)'
                ])
            elif report_type == 'ignition':  # Ignition Report
                all_possible_columns.extend([
                    'date_time', 'latitude', 'longitude', 'Location', 'ignition',
                    'Ignition Duration (min)'
                ])
            elif report_type == 'panic':  # Panic Report
                all_possible_columns.extend([
                    'date_time', 'latitude', 'longitude', 'Location', 'speed',
                    'Average Speed', 'Maximum Speed', 'odometer'
                ])
            else:  # Other reports (Travel Path, Speed, Daily)
                all_possible_columns.extend([
                    'date_time', 'latitude', 'longitude', 'Location', 'speed',
                    'Average Speed', 'Maximum Speed'
                ])
                if report_type == 'daily':  # Daily Report
                    all_possible_columns.append('odometer')

            existing_columns = [col for col in all_possible_columns if col in df.columns]
            df = df[existing_columns]

            data_records = df.fillna("").to_dict(orient="records")
            # Build OrderedDict for each row in the desired order
            ordered_data = [OrderedDict((col, row.get(col, "")) for col in existing_columns) for row in data_records]

            print("Final columns:", df.columns.tolist())
            print("existing_columns:", existing_columns)
            print("ordered_data:", ordered_data)

            # Serialize manually to preserve order
            json_str = json.dumps({
                "success": True,
                "data": ordered_data
            }, ensure_ascii=False)

            return Response(json_str, mimetype='application/json')

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500