from flask import Flask, render_template, send_from_directory
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
    app.run(debug=True)


