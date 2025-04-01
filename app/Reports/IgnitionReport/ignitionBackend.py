from flask import Blueprint, render_template, request, jsonify, send_file
from pymongo import MongoClient
import pandas as pd
from datetime import datetime, timedelta
from io import BytesIO
import re

ignition_report_bp = Blueprint('IgnitionReport', __name__, static_folder='static', template_folder='templates')

# MongoDB connection
client = MongoClient("mongodb+srv://doadmin:4T81NSqj572g3o9f@db-mongodb-blr1-27716-c2bd0cae.mongo.ondigitalocean.com/admin?tls=true&authSource=admin")
db = client["nnx"]
vehicle_inventory_collection = db['vehicle_inventory']
atlanta_collection = db['atlanta']

def format_date(date_str):
    return f"{date_str[0:2]}-{date_str[2:4]}-20{date_str[4:6]}" if date_str else "N/A"

def format_time(time_str):
    return f"{time_str[0:2]}:{time_str[2:4]}:{time_str[4:6]}" if time_str else "N/A"

def convert_to_decimal(coord, direction):
    if not coord:
        return "N/A"
    degrees = int(float(coord) / 100)
    minutes = float(coord) % 100
    decimal_degrees = degrees + (minutes / 60)
    if direction in ["S", "W"]:
        decimal_degrees = -decimal_degrees
    return round(decimal_degrees, 6)

@ignition_report_bp.route('/ignition_report_page')
def ignition_report_page():
    vehicles = list(vehicle_inventory_collection.find({}, {"LicensePlateNumber": 1, "_id": 0}))
    return render_template('ignition.html', vehicles=vehicles)

@ignition_report_bp.route('/fetch_ignition_report', methods=['POST'])
def fetch_ignition_report():
    data = request.json
    license_plate_number = data.get('license_plate_number')
    from_date = data.get('from_date')
    to_date = data.get('to_date')

    vehicle = vehicle_inventory_collection.find_one({"LicensePlateNumber": license_plate_number}, {"IMEI": 1, "_id": 0})
    if not vehicle:
        return jsonify({"error": "Vehicle not found"}), 404

    imei = vehicle["IMEI"]
    from_datetime = datetime.strptime(from_date, '%Y-%m-%dT%H:%M')
    to_datetime = datetime.strptime(to_date, '%Y-%m-%dT%H:%M')

    if (to_datetime - from_datetime).days > 30:
        return jsonify({"error": "Date range cannot exceed 30 days"}), 400

    query = {
        "imei": imei,
        "date": {"$gte": from_datetime.strftime('%d%m%y'), "$lte": to_datetime.strftime('%d%m%y')},
        "time": {"$gte": from_datetime.strftime('%H%M%S'), "$lte": to_datetime.strftime('%H%M%S')}
    }

    records = list(atlanta_collection.find(query, {"_id": 0, "imei": 0}))
    
    data = []

    for record in records:
        data.append({
            "Date": format_date(record["date"]),
            "Time": format_time(record["time"]),
            "Latitude": convert_to_decimal(record["latitude"], record["dir1"]),
            "Longitude": convert_to_decimal(record["longitude"], record["dir2"]),
            "Ignition": "On" if record["ignition"] == "1" else "Off"
        })

    return jsonify(data)

def sanitize_for_excel(value):
    if isinstance(value, str):
        # Remove non-printable characters
        return re.sub(r'[\x00-\x1F\x7F-\x9F]', '', value)
    return value

@ignition_report_bp.route('/download_ignition_report', methods=['POST'])
def download_ignition_report():
    data = request.json
    license_plate_number = data.get('license_plate_number')
    from_date = data.get('from_date')
    to_date = data.get('to_date')

    vehicle = vehicle_inventory_collection.find_one({"LicensePlateNumber": license_plate_number}, {"IMEI": 1, "_id": 0})
    if not vehicle:
        return jsonify({"error": "Vehicle not found"}), 404

    imei = vehicle["IMEI"]
    from_datetime = datetime.strptime(from_date, '%Y-%m-%dT%H:%M')
    to_datetime = datetime.strptime(to_date, '%Y-%m-%dT%H:%M')

    if (to_datetime - from_datetime).days > 30:
        return jsonify({"error": "Date range cannot exceed 30 days"}), 400

    query = {
        "imei": imei,
        "date": {"$gte": from_datetime.strftime('%d%m%y'), "$lte": to_datetime.strftime('%d%m%y')},
        "time": {"$gte": from_datetime.strftime('%H%M%S'), "$lte": to_datetime.strftime('%H%M%S')}
    }

    records = list(atlanta_collection.find(query, {"_id": 0, "imei": 0}))
    for record in records:
        record["date"] = format_date(record["date"])
        record["time"] = format_time(record["time"])
        record["latitude"] = convert_to_decimal(record["latitude"], record["dir1"])
        record["longitude"] = convert_to_decimal(record["longitude"], record["dir2"])
        record["ignition"] = "On" if record["ignition"] == "1" else "Off"

    # Sanitize records for Excel
    sanitized_records = [{k: sanitize_for_excel(v) for k, v in record.items()} for record in records]

    # Add the vehicle license plate number to each record
    for record in sanitized_records:
        record["Vehicle License Plate Number"] = license_plate_number

    # Create DataFrame with specified columns
    df = pd.DataFrame(sanitized_records, columns=[
        "Vehicle License Plate Number", "date", "time", "latitude", "longitude", "ignition"
    ])
    df.columns = ["Vehicle License Plate Number", "Date", "Time", "Latitude", "Longitude", "Ignition"]

    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Ignition Report")

    output.seek(0)
    return send_file(output, mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", as_attachment=True, download_name="Ignition_Report.xlsx")