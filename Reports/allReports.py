from flask import Flask, render_template, Blueprint
from pymongo import MongoClient
from Reports.SpeedReport.speed import speed_bp

reports_bp = Blueprint('Reports', __name__, static_folder='static', template_folder='templates')

reports_bp.register_blueprint(speed_bp, url_prefix='/speed')

client = MongoClient("mongodb+srv://doadmin:4T81NSqj572g3o9f@db-mongodb-blr1-27716-c2bd0cae.mongo.ondigitalocean.com/admin?tls=true&authSource=admin")
db = client["nnx"]
vehicle_inventory_collection = db['vehicle_inventory']
atlanta_collection = db['atlanta']

@reports_bp.route('/')
def index():
    vehicles = list(vehicle_inventory_collection.find({}, {"LicensePlateNumber": 1, "_id": 0}))
    return render_template('allReport.html', vehicles=vehicles)
