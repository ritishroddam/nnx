from flask import Flask, Blueprint, render_template, request, jsonify, flash, redirect, url_for, send_file
from datetime import datetime, timedelta
from pytz import timezone
from bson.objectid import ObjectId 
from fpdf import FPDF
from app.database import db
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app.models import User
from app.utils import roles_required
from app.geocoding import geocodeInternal

rawLogs_bp = Blueprint('RawLogs', __name__, static_folder='static', template_folder='templates')

rawLogSubscriptions = db['raw_log_subscriptions']
rawLogsCollection = db['raw_logs']
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
    licensePlateNumber = request.args.get('licensePlateNumber')
    start_date = request.args.get('startDate')
    end_date = request.args.get('endDate')

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

    if start_date and end_date:
        start_date = datetime.strptime(start_date, '%Y-%m-%d').replace(tzinfo=timezone('UTC'))
        end_date = datetime.strptime(end_date, '%Y-%m-%d').replace(tzinfo=timezone('UTC')) + timedelta(days=1)
        query = {"imei": imei, "timestamp": {"$gte": start_date, "$lt": end_date}}
    else:
        return jsonify({"error": "Start date and end date are required"}), 400

    raw_logs = list(rawLogsCollection.find(query).sort("timestamp", -1))

    for log in raw_logs:
        log['timestamp'] = log['timestamp'].astimezone(timezone('UTC')).strftime('%Y-%m-%d %H:%M:%S')

    return jsonify(raw_logs), 200
    
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
    vehicles = list(vehicleCollection.find({}, {"LicensePlateNumber": 1}))
    return jsonify(vehicles), 200

@rawLogs_bp.route('/downloadPDF', methods=['GET'])
@jwt_required()
@roles_required('admin')
def download_pdf():
    vehicle = request.args.get('vehicle')
    query = {"LicensePlateNumber": vehicle} if vehicle else {}
    logs = list(rawLogsCollection.find(query))

    # Create a PDF
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.set_font("Arial", size=12)

    # Add title
    pdf.set_font("Arial", style="B", size=16)
    pdf.cell(200, 10, txt="Raw Logs Report", ln=True, align="C")
    pdf.ln(10)

    # Add logs
    pdf.set_font("Arial", size=12)
    for log in logs:
        pdf.cell(0, 10, txt=f"Vehicle: {log['LicensePlateNumber']}", ln=True)
        pdf.cell(0, 10, txt=f"Timestamp: {log['timestamp']}", ln=True)
        pdf.cell(0, 10, txt=f"Data: {log['data']}", ln=True)
        pdf.ln(5)

    # Save the PDF to a temporary file
    pdf_path = "raw_logs_report.pdf"
    pdf.output(pdf_path)

    # Send the file as a response
    return send_file(pdf_path, as_attachment=True)