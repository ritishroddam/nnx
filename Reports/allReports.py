import datetime
from flask import render_template, Blueprint, request, jsonify, send_file, url_for # type: ignore
from pymongo import MongoClient # type: ignore
import pandas as pd # type: ignore
from io import BytesIO

from Reports.SpeedReport.speed import speed_bp

reports_bp = Blueprint('Reports', __name__, static_folder='static', template_folder='templates')

reports_bp.register_blueprint(speed_bp, url_prefix='/speed')

from database import db
vehicle_inventory_collection = db['vehicle_inventory']
atlanta_collection = db['atlanta']

@reports_bp.route('/')
def index():
    vehicles = list(vehicle_inventory_collection.find({}, {"LicensePlateNumber": 1, "_id": 0}))
    reports = list(db['custom_reports'].find({}, {"_id": 0, "report_name": 1}))
    return render_template('allReport.html', vehicles=vehicles, reports=reports)

@reports_bp.route('/get_fields', methods=['GET'])
def get_fields():
    # Combine fields from all collections
    atlanta_fields = db['atlanta'].find_one().keys()
    inventory_fields = db['vehicle_inventory'].find_one().keys()
    sim_fields = db['sim_inventory'].find_one().keys()
    device_fields = db['device_inventory'].find_one().keys()
    all_fields = set(atlanta_fields) | set(inventory_fields) | set(sim_fields) | set(device_fields)
    return jsonify(list(all_fields))

@reports_bp.route('/save_custom_report', methods=['POST'])
def save_custom_report():
    data = request.json
    report_name = data.get("reportName")
    fields = data.get("fields")

    if not report_name or not fields:
        return jsonify({"success": False, "message": "Invalid data provided."}), 400

    try:
        # Save the custom report to the database
        db['custom_reports'].insert_one({
            "report_name": report_name,
            "fields": fields
        })

        # Return a success response with a redirect URL
        return jsonify({"success": True, "message": "Custom report saved successfully!", "redirect_url": url_for('Reports.index')}), 200
    except Exception as e:
        # Log the error and return a failure response
        print(f"Error saving custom report: {e}")
        return jsonify({"success": False, "message": "An error occurred while saving the report."}), 500

@reports_bp.route('/get_custom_reports', methods=['GET'])
def get_custom_reports():
    reports = list(db['custom_reports'].find({}, {"_id": 0, "report_name": 1}))
    return jsonify(reports)

@reports_bp.route('/download_custom_report', methods=['POST'])
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
    # First get the IMEI number from vehicle inventory using license plate
    imei_number = db['vehicle_inventory'].find_one({'LicensePlateNumber': vehicle_number}, {'_id': 0,'imei': 1})
    print(f"IMEI Number: {imei_number}")
    
    if not imei_number:
        return jsonify({"success": False, "message": "Vehicle IMEI not found."}), 404

    # Determine which collections we need to query based on the fields
    collections_to_query = set()
    field_mapping = {
        'atlanta': set(db['atlanta'].find_one().keys()) if db['atlanta'].count_documents({}) > 0 else set(),
        'vehicle_inventory': set(db['vehicle_inventory'].find_one().keys()) if db['vehicle_inventory'].count_documents({}) > 0 else set(),
        'sim_inventory': set(db['sim_inventory'].find_one().keys()) if db['sim_inventory'].count_documents({}) > 0 else set(),
        'device_inventory': set(db['device_inventory'].find_one().keys()) if db['device_inventory'].count_documents({}) > 0 else set()
    }

    # Map fields to their respective collections
    fields_by_collection = {
        'atlanta': [],
        'vehicle_inventory': [],
        'sim_inventory': [],
        'device_inventory': []
    }

    for field in fields:
        for collection, collection_fields in field_mapping.items():
            if field in collection_fields:
                fields_by_collection[collection].append(field)
                collections_to_query.add(collection)
                break

    # Function to convert string date to datetime object
    def parse_date(date_str):
        day = int(date_str[:2])
        month = int(date_str[2:4])
        year = 2000 + int(date_str[4:6])  # Assuming 21st century
        return datetime(year, month, day)

    # Function to convert string time to time object
    def parse_time(time_str):
        hour = int(time_str[:2])
        minute = int(time_str[2:4])
        second = int(time_str[4:6])
        return datetime.time(hour, minute, second)

    # Calculate date ranges in string format (DDMMYY)
    now = datetime.now()
    date_str = now.strftime("%d%m%y")
    time_str = now.strftime("%H%M%S")

    if date_range == "last24hours":
        start_date = (now - datetime.timedelta(hours=24)).strftime("%d%m%y")
    elif date_range == "today":
        start_date = now.strftime("%d%m%y")
    elif date_range == "yesterday":
        start_date = (now - datetime.timedelta(days=1)).strftime("%d%m%y")
        end_date = now.strftime("%d%m%y")
    elif date_range == "last7days":
        start_date = (now - datetime.timedelta(days=7)).strftime("%d%m%y")
    elif date_range == "last30days":
        start_date = (now - datetime.timedelta(days=30)).strftime("%d%m%y")
    else:
        start_date = None

    # Query each collection using IMEI number
    all_results = []
    
    # Get vehicle data
    if 'vehicle_inventory' in collections_to_query:
        vehicle_data = db['vehicle_inventory'].find_one(
            {"imei": imei_number},
            {field: 1 for field in fields_by_collection['vehicle_inventory']}
        )
        if vehicle_data:
            all_results.append(vehicle_data)

    # Get SIM data
    if 'sim_inventory' in collections_to_query:
        sim_data = db['sim_inventory'].find_one(
            {"imei": imei_number},
            {field: 1 for field in fields_by_collection['sim_inventory']}
        )
        if sim_data:
            all_results.append(sim_data)

    # Get device data
    if 'device_inventory' in collections_to_query:
        device_data = db['device_inventory'].find_one(
            {"imei": imei_number},
            {field: 1 for field in fields_by_collection['device_inventory']}
        )
        if device_data:
            all_results.append(device_data)

    # Get time-series data from atlanta collection with date filtering
    if 'atlanta' in collections_to_query:
        query = {"imei": imei_number}
        
        if start_date:
            if date_range == "yesterday":
                # For yesterday, we need exact date match
                query["date"] = start_date  # This is yesterday's date in DDMMYY format
            else:
                # For other ranges, we need to compare date strings
                # Since they're in DDMMYY format, string comparison works for same century
                query["date"] = {"$gte": start_date}
        
        atlanta_data = list(db['atlanta'].find(
            query,
            {field: 1 for field in fields_by_collection['atlanta']}
        ))
        
        # If we need to filter by time as well (for last24hours), we need to do it in Python
        if date_range == "last24hours" and atlanta_data:
            filtered_data = []
            cutoff_time = (now - datetime.timedelta(hours=24)).strftime("%H%M%S")
            for record in atlanta_data:
                record_date = record.get("date", "")
                record_time = record.get("time", "000000")
                
                # If date is today, check time
                if record_date == date_str and record_time >= cutoff_time:
                    filtered_data.append(record)
                # If date is after start_date (yesterday), include all
                elif record_date == start_date and record_time >= cutoff_time:
                    filtered_data.append(record)
            atlanta_data = filtered_data
        
        all_results.extend(atlanta_data)

    if not all_results:
        return jsonify({"success": False, "message": "No data found for the selected criteria."}), 404

    # Convert to Excel with merged data
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        # Create a merged dataframe with all data
        merged_data = {}
        
        # Add vehicle data
        if 'vehicle_inventory' in collections_to_query and vehicle_data:
            for field, value in vehicle_data.items():
                if field != '_id':
                    merged_data[field] = [value] * len(atlanta_data) if atlanta_data else [value]
        
        # Add SIM data
        if 'sim_inventory' in collections_to_query and sim_data:
            for field, value in sim_data.items():
                if field != '_id':
                    merged_data[field] = [value] * len(atlanta_data) if atlanta_data else [value]
        
        # Add device data
        if 'device_inventory' in collections_to_query and device_data:
            for field, value in device_data.items():
                if field != '_id':
                    merged_data[field] = [value] * len(atlanta_data) if atlanta_data else [value]
        
        # Add time-series data
        if 'atlanta' in collections_to_query and atlanta_data:
            for record in atlanta_data:
                for field, value in record.items():
                    if field != '_id':
                        if field not in merged_data:
                            merged_data[field] = []
                        merged_data[field].append(value)
        
        # Create DataFrame and save to Excel
        if merged_data:
            df = pd.DataFrame(merged_data)
            
            # Convert date and time columns to more readable format if they exist
            if 'date' in df.columns:
                df['date'] = df['date'].apply(lambda x: f"{x[:2]}/{x[2:4]}/20{x[4:]}" if isinstance(x, str) and len(x) == 6 else x)
            if 'time' in df.columns:
                df['time'] = df['time'].apply(lambda x: f"{x[:2]}:{x[2:4]}:{x[4:]}" if isinstance(x, str) and len(x) == 6 else x)
            
            df.to_excel(writer, index=False, sheet_name="Combined Report")
        else:
            return jsonify({"success": False, "message": "No data to export."}), 404

    output.seek(0)

    return send_file(
        output,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=f"{report_name}.xlsx"
    )
