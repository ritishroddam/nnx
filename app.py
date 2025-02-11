from flask import Flask, render_template, send_from_directory
import subprocess
import os
from Vehicle.VehicleBackend import vehicle_bp

app = Flask(__name__)

app.register_blueprint(vehicle_bp, url_prefix='/vehicle')

@app.route('/')
def index():
    return render_template('vehicleMap.html')

@app.route("/default") 
def default(): 
    return render_template("base.html") 

if __name__ == '__main__':
    map_server_path = os.path.join(os.path.dirname(__file__), 'Vehicle/map_server.py')
    subprocess.Popen(['python', map_server_path])

    app.run(host = "64.227.137.175", port = 8888, debug=True)


