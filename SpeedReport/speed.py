from flask import Flask, render_template, request, jsonify, Blueprint
from pymongo import MongoClient
import pandas as pd
from flask import send_file
import sys

speed_report_bp = Blueprint('SpeedReport', __name__, static_folder='static', template_folder='templates')

# MongoDB connection
client = MongoClient("mongodb+srv://doadmin:4T81NSqj572g3o9f@db-mongodb-blr1-27716-c2bd0cae.mongo.ondigitalocean.com/admin?tls=true&authSource=admin")
db = client["CordonEV"]
collection = db['data']  

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

@speed_report_bp.route('/page')
def page():
    return render_template("Speed.html")

@speed_report_bp.route('/search', methods=['GET'])
def search_data():
    search_query = request.args.get('search_query', '').strip()
    query = {}

    if search_query:
        query = {
            "$or": [
                {"Vehicle Data.License Plate Number": {"$regex": f".*{search_query}.*", "$options": "i"}},
                {"Vehicle Data.License Plate Number": {"$regex": f".*{search_query[-4:]}.*", "$options": "i"}}
            ]
        }

    results = collection.find(query, {
        "Atlanta Data": 1,
        "Vehicle Data.License Plate Number": 1
    })

    data_to_display = []
    for record in results:
        vehicle_number = record.get("Vehicle Data", {}).get("License Plate Number", "N/A")
        atlanta_data = record.get("Atlanta Data", [])

        for entry in atlanta_data:
            date = format_date(entry.get("date", ""))
            time = format_time(entry.get("time", ""))
            latitude = convert_to_decimal(entry.get("latitude", ""), entry.get("dir1", "N"))
            longitude = convert_to_decimal(entry.get("longitude", ""), entry.get("dir2", "E"))
            speed = entry.get("speed", "0.0")  # Fetch speed instead of ignition

            data_to_display.append({
                "vehicle_number": vehicle_number,
                "date": date,
                "time": time,
                "latitude": latitude,
                "longitude": longitude,
                "speed": speed
            })

    return jsonify({"data": data_to_display})

@speed_report_bp.route('/download', methods=['GET'])
def download_data():
    search_query = request.args.get('search_query', '').strip()
    query = {}

    if search_query:
        query = {
            "$or": [
                {"Vehicle Data.License Plate Number": {"$regex": f".*{search_query}.*", "$options": "i"}},
                {"Vehicle Data.License Plate Number": {"$regex": f".*{search_query[-4:]}.*", "$options": "i"}}
            ]
        }

    results = collection.find(query, {
        "Atlanta Data": 1,
        "Vehicle Data.License Plate Number": 1
    })

    data_to_export = []
    for record in results:
        vehicle_number = record.get("Vehicle Data", {}).get("License Plate Number", "N/A")
        atlanta_data = record.get("Atlanta Data", [])

        for entry in atlanta_data:
            date = format_date(entry.get("date", ""))
            time = format_time(entry.get("time", ""))
            latitude = convert_to_decimal(entry.get("latitude", ""), entry.get("dir1", "N"))
            longitude = convert_to_decimal(entry.get("longitude", ""), entry.get("dir2", "E"))
            speed = entry.get("speed", "0.0")  # Fetch speed instead of ignition

            data_to_export.append({
                "Vehicle Number": vehicle_number,
                "Date": date,
                "Time": time,
                "Latitude": latitude,
                "Longitude": longitude,
                "Speed": speed
            })

    # Convert the data to a pandas DataFrame
    df = pd.DataFrame(data_to_export)

    # Save the data to an Excel file
    file_path = 'vehicle_speed_data.xlsx'
    df.to_excel(file_path, index=False)

    # Send the file to the client
    return send_file(file_path, as_attachment=True)
