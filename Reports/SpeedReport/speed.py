from flask import Blueprint, render_template, request, jsonify, send_file
from pymongo import MongoClient
from datetime import datetime, timedelta
import pandas as pd
from io import BytesIO

speed_bp = Blueprint('SpeedReport', __name__, static_folder='static', template_folder='templates')

client = MongoClient("mongodb+srv://doadmin:4T81NSqj572g3o9f@db-mongodb-blr1-27716-c2bd0cae.mongo.ondigitalocean.com/admin?tls=true&authSource=admin")
db = client["nnx"]
vehicle_inventory_collection = db['vehicle_inventory']
atlanta_collection = db['atlanta']

@speed_bp.route('/')
def index():
    vehicles = list(vehicle_inventory_collection.find({}, {"LicensePlateNumber": 1, "_id": 0}))
    return render_template('Speed.html', vehicles=vehicles)

@speed_bp.route('/fetch_speed_report', methods=['POST'])
def fetch_speed_report():
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
            "LicensePlateNumber": license_plate_number,
            "Date": record["date"],
            "Time": record["time"],
            "Latitude": record["latitude"],
            "Longitude": record["longitude"],
            "Speed": record["speed"] # Convert mph to km/h
        })

    if not data:
        return jsonify({"error": "No data found"}),

    df = pd.DataFrame(data)
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Speed Report")

    output.seek(0)

    return send_file(
        output,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name="Speed_Report.xlsx"
    )

@speed_bp.route('/download_speed_report', methods=['POST'])
def download_speed_report():
    data = request.json
    records = data.get('records', [])

    if not records:
        return jsonify({"error": "No data to download"}), 400

    df = pd.DataFrame(records)
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Speed Report")

    output.seek(0)

    return send_file(
        output,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name="Speed_Report.xlsx"
    )