from flask import Flask, render_template, send_from_directory, request, jsonify
import subprocess
import os
import requests
import sys
import threading

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from Vehicle.VehicleBackend import vehicle_bp
from Dashboard.DashboardBackend import dashboard_bp
from DeviceInvy.DeviceBackend import device_bp
from DeviceInvyEntry.DeviceBackend import deviceEntry_bp
from RouteHistory.routeBackend import route_bp
from CompanyDetails.companyBackend import company_bp
from CompanyDetailsEntry.companyBackend import companyEntry_bp
from SimInvy.SimBackend import sim_bp
from SimInvyEntry.SimBackend import simEntry_bp
from VehicleDetails.vehicleDetails import vehicleDetails_bp
from VehicleDetailsEntry.vehicleDetailsEntry import vehicleDetailsEntry_bp
from IgnitionReport.ignitionBackend import ignition_report_bp
from SOSreport.sos_report import sos_report_bp

app = Flask(__name__)
app.secret_key = os.urandom(24) 

app.register_blueprint(vehicle_bp, url_prefix='/vehicle')
app.register_blueprint(dashboard_bp, url_prefix='/dashboard')
app.register_blueprint(device_bp, url_prefix='/deviceInvy')
app.register_blueprint(deviceEntry_bp, url_prefix='/deviceInvyEntry')
app.register_blueprint(route_bp, url_prefix='/routeHistory')
app.register_blueprint(company_bp, url_prefix='/companyDetails')
app.register_blueprint(companyEntry_bp, url_prefix='/companyDetailsEntry')
app.register_blueprint(sim_bp, url_prefix='/simInvy')
app.register_blueprint(simEntry_bp, url_prefix='/simInvyEntry')
app.register_blueprint(vehicleDetails_bp, url_prefix='/vehicleDetails')
app.register_blueprint(vehicleDetailsEntry_bp, url_prefix='/vehicleDetailsEntry')
app.register_blueprint(ignition_report_bp, url_prefix='/ignitionReport')
app.register_blueprint(sos_report_bp, url_prefix='/sosReport')

@app.route('/')
def index():
    return render_template('vehicleMap.html')

@app.route('/VehicleDetailsEntry')
def vehicleDetailsEntry():
    return render_template('vehicleDetailsEntry.html')

@app.route('/SimInvyEntry')
def simInvyEntry():
    return render_template('simEntry.html')

@app.route('/DeviceInvyEntry')
def deviceInvyEntry():
    return render_template('deviceEntry.html')

@app.route('/CompanyDetailsEntry')
def companyDetailsEntry():
    return render_template('companyEntry.html')

@app.route("/default") 
def default(): 
    return render_template("base.html") 

@app.route('/api/data', methods=['GET', 'POST'])
def proxy_api_data():
    if request.method == 'POST':
        response = requests.post('http://64.227.137.175:8555/api/data', json=request.get_json())
    else:
        response = requests.get('http://64.227.137.175:8555/api/data', params=request.args)
    return jsonify(response.json())

if __name__ == '__main__':
    map_server_path = os.path.join(os.path.dirname(__file__), 'map_server.py')
    subprocess.Popen(['python', map_server_path])
    run_distinct_vehicle_data_store_path = os.path.join(os.path.dirname(__file__), 'distinctVehicleDataStore.py')
    subprocess.Popen(['python', run_distinct_vehicle_data_store_path])
    run_calculate_past_distances_path = os.path.join(os.path.dirname(__file__), 'calculate_past_distances.py')
    subprocess.Popen(['python', run_calculate_past_distances_path])
    
    app.run(host='64.227.137.175', port=8888, debug=True)