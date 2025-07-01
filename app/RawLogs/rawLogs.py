from flask import Flask, Blueprint, render_template, request, jsonify, flash, redirect, url_for, send_file
from datetime import datetime, timedelta
from pytz import timezone
import os

from bson.objectid import ObjectId 
from fpdf import FPDF
from app.database import db
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app.models import User
from app.utils import roles_required
from app.geocoding import geocodeInternal

rawLogs_bp = Blueprint('RawLogs', __name__, static_folder='static', template_folder='templates')

rawLogSubscriptions = db['raw_log_subscriptions']
rawLogsCollection = db['raw_log_data']
vehicleCollection = db['vehicle_inventory']

@rawLogs_bp.route('/', methods=['GET'])
@jwt_required()
@roles_required('admin')
def home():
    return render_template('rawLogs.html')

@rawLogs_bp.route('/getRawLogs', methods=['POST'])
@jwt_required()
@roles_required('admin')
def get_raw_logs():
    data = request.get_json()
    licensePlateNumber = data.get('licensePlateNumber')
    start_date = data.get('startDate')
    end_date = data.get('endDate')

    if not licensePlateNumber:
        return jsonify({"error": "License plate number is required"}), 400
    
    imei = vehicleCollection.find_one(
        {"LicensePlateNumber": licensePlateNumber},
        {"IMEI": 1}
    )['IMEI'] if licensePlateNumber else None
    
    if imei:
        query = {"imei": imei}
    else:
        return jsonify({"error": "License plate number not found"}), 404

    if not start_date and not end_date:
        now = datetime.now(timezone('UTC'))
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = now.replace(hour=23, minute=59, second=59, microsecond=999999)
    else:
        start_date = datetime.strptime(start_date, '%Y-%m-%dT%H:%M')
        end_date = datetime.strptime(end_date, '%Y-%m-%dT%H:%M')
        ist = timezone('Asia/Kolkata')
        start_date = ist.localize(start_date).astimezone(timezone('UTC'))
        end_date = ist.localize(end_date).astimezone(timezone('UTC'))

    query = {"imei": imei, "timestamp": {"$gte": start_date, "$lt": end_date}}
    raw_logs = list(rawLogsCollection.find(query, {"_id": 0}).sort("timestamp", -1))
    
    logs = []
    if raw_logs:
        data = {}
        data['LicensePlateNumber'] = raw_logs[0]['LicensePlateNumber'] if raw_logs else licensePlateNumber
        data['IMEI'] = imei
        data['raw_data'] = []
        
        ist = timezone('Asia/Kolkata')
        
        for log in raw_logs:
            log['timestamp'] = log['timestamp'].astimezone(ist).strftime('%Y-%m-%d %H:%M:%S')
            data['raw_data'].append(
                f"Data String:\n{log['raw_data']}\nTime:{log['timestamp']}"
            )
        logs.append(data)
    else:
        return jsonify({"error": "No raw logs found for the given criteria"}), 404

    return jsonify(logs), 200
    
@rawLogs_bp.route('/subscribeToRawLog', methods=['POST'])
@jwt_required()
@roles_required('admin')
def subscribe_to_raw_log():
    data = request.get_json()
    vehicles = data.get('vehicles')

    if not vehicles:
        return jsonify({"error": "No vehicles provided"}), 400

    if not isinstance(vehicles, list):
        vehicles = [vehicles]

    user_id = get_jwt_identity()

    imeis = vehicleCollection.find({"LicensePlateNumber": {"$in": vehicles}}, {"IMEI": 1, "LicensePlateNumber": 1})
    imeisMap = {vehicle['LicensePlateNumber']: vehicle['IMEI'] for vehicle in imeis}
    
    subscriptions = []
    for vehicle in vehicles:
        if not vehicle:
            continue
        existing = rawLogSubscriptions.find_one({
            "LicensePlateNumber": vehicle,
        })
        if not existing:
            sub = {
                "user_id": user_id,
                "LicensePlateNumber": vehicle,
                "IMEI": imeisMap.get(vehicle),
                "subscribed_at": datetime.now()
            }
            rawLogSubscriptions.insert_one(sub)
            subscriptions.append(vehicle)

    if not subscriptions:
        return jsonify({"message": "Already subscribed to all provided vehicles"}), 200

    return jsonify({"message": "Subscribed successfully", "vehicles": subscriptions}), 201

@rawLogs_bp.route('/getVehicles', methods=['GET'])
@jwt_required()
@roles_required('admin')
def get_vehicles():
    vehicles = list(vehicleCollection.find({}, {"LicensePlateNumber": 1, "_id": 0}))
    return jsonify(vehicles), 200

@rawLogs_bp.route('/downloadPDF', methods=['POST'])
@jwt_required()
@roles_required('admin')
def download_pdf():
    data = request.get_json()
    licensePlateNumber = data.get('licensePlateNumber')
    start_date = data.get('startDate')
    end_date = data.get('endDate')

    if not licensePlateNumber:
        return jsonify({"error": "License plate number is required"}), 400

    if not start_date or not end_date:
        now = datetime.now(timezone('UTC'))
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = now.replace(hour=23, minute=59, second=59, microsecond=999999)
    else:
        start_date = datetime.strptime(start_date, '%Y-%m-%dT%H:%M')
        end_date = datetime.strptime(end_date, '%Y-%m-%dT%H:%M')
        ist = timezone('Asia/Kolkata')
        start_date = ist.localize(start_date).astimezone(timezone('UTC'))
        end_date = ist.localize(end_date).astimezone(timezone('UTC'))

    query = {"LicensePlateNumber": licensePlateNumber, "timestamp": {"$gte": start_date, "$lt": end_date}}
    logs = list(rawLogsCollection.find(query, {"_id": 0}))

    if not logs:
        return jsonify({"error": "No logs found for the given criteria"}), 404

    # Create a PDF
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.set_font("Arial", size=12)

    # Add title
    pdf.set_font("Arial", style="B", size=16)
    pdf.cell(200, 10, txt="Raw Logs Report", ln=True, align="C")
    pdf.ln(10)

    pdf.set_font("Arial", style="B", size=14)
    pdf.cell(200, 10, txt=f"{licensePlateNumber}", ln=True, align="C")
    pdf.ln(10)

    # Add logs
    pdf.set_font("Arial", size=12)
    for log in logs:
        pdf.cell(0, 10, txt=f"Timestamp: {log.get('timestamp', 'N/A')}", ln=True)
        pdf.cell(0, 10, txt=f"Data: {log.get('data', 'N/A')}", ln=True)
        pdf.ln(5)

    # Save the PDF to a temporary file
    pdf_path = os.path.join(os.getcwd(), "raw_logs_report.pdf")
    pdf.output(pdf_path)

    # Send the file as a response
    return send_file(pdf_path, as_attachment=True)