from flask import Flask, render_template, send_from_directory, request, jsonify
import subprocess
import os
import requests
from Vehicle.VehicleBackend import vehicle_bp
from Dashboard.dashboard_backend import dashboard_bp

app = Flask(__name__)

app.register_blueprint(vehicle_bp, url_prefix='/vehicle')
app.register_blueprint(dashboard_bp, url_prefix='/dashboard')

@app.route('/')
def index():
    return render_template('vehicleMap.html')

@app.route("/default") 
def default(): 
    return render_template("base.html") 

@app.route('/api/data', methods=['GET', 'POST'])
def proxy_api_data():
    if request.method == 'POST':
        response = requests.post('http://127.0.0.1:8002/api/data', json=request.get_json())
    else:
        response = requests.get('http://127.0.0.1:8002/api/data', params=request.args)
    return jsonify(response.json())

if __name__ == '__main__':
    map_server_path = os.path.join(os.path.dirname(__file__), 'map_server.py')
    subprocess.Popen(['python', map_server_path])

    app.run(host='64.227.137.175', port=8888, debug=True)