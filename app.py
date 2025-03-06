from flask import Flask, render_template, send_from_directory, request, jsonify
import subprocess
import os
import requests
import threading

from Vehicle.VehicleBackend import vehicle_bp
from Dashboard.DashboardBackend import dashboard_bp
from DeviceInvy.DeviceBackend import device_bp
from RouteHistory.RouteBackend import route_bp
from CompanyDetails.CompanyBackend import company_bp

app = Flask(__name__)
app.secret_key = os.urandom(24) 

app.register_blueprint(vehicle_bp, url_prefix='/vehicle')
app.register_blueprint(dashboard_bp, url_prefix='/dashboard')
app.register_blueprint(device_bp, url_prefix='/deviceInvy')
app.register_blueprint(route_bp, url_prefix='/routeHistory')
app.register_blueprint(company_bp, url_prefix='/companyDetails')

@app.route('/')
def index():
    return render_template('vehicleMap.html')

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

def run_distinct_vehicle_data_store():
    os.system('python distinctVehicleDataStore.py')

if __name__ == '__main__':
    map_server_path = os.path.join(os.path.dirname(__file__), 'map_server.py')
    subprocess.Popen(['python', map_server_path])
    threading.Thread(target=run_distinct_vehicle_data_store, daemon=True).start()

    app.run(host='64.227.137.175', port=8888, debug=True)