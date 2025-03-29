from flask import Flask, redirect, render_template, Blueprint, request, jsonify, send_file, url_for
from pymongo import MongoClient
import pandas as pd
from io import BytesIO

from app import db
from Reports.SpeedReport.speed import speed_bp

reports_bp = Blueprint('Reports', __name__, static_folder='static', template_folder='templates')

reports_bp.register_blueprint(speed_bp, url_prefix='/speed')


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

# Place the get_custom_reports function here
@reports_bp.route('/get_custom_reports', methods=['GET'])
def get_custom_reports():
    reports = list(db['custom_reports'].find({}, {"_id": 0, "report_name": 1}))
    return jsonify(reports)


@reports_bp.route('/download_custom_report', methods=['POST'])
def download_custom_report():
    data = request.json
    report_name = data.get("reportName")
    vehicle_number = data.get("vehicleNumber")

    # Fetch report configuration
    report_config = db['custom_reports'].find_one({"report_name": report_name})
    fields = report_config["fields"]

    # Fetch data from MongoDB
    query = {"LicensePlateNumber": vehicle_number}
    results = list(db['atlanta'].find(query, {field: 1 for field in fields}))

    # Convert to Excel
    df = pd.DataFrame(results)
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name=report_name)
    output.seek(0)

    return send_file(
        output,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=f"{report_name}.xlsx"
    )

