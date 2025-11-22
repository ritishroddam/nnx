from flask import Blueprint, render_template, request, jsonify
from datetime import datetime, timedelta
from pytz import timezone
from app.database import db
from flask_jwt_extended import jwt_required
from app.models import User
from app.utils import roles_required

subscribeForMoveInSync_bp = Blueprint('SubscribeForMoveInSync', __name__, static_folder='static', template_folder='templates')

vehicleCollection = db['vehicle_inventory']
moveInSyncSubscribed = db['moveInSyncSubscriptions']
companyColection = db['customers_list']

@subscribeForMoveInSync_bp.route('/', methods=['GET'])
@jwt_required()
@roles_required('admin')  
def index():
    subscribedVehicles = list(moveInSyncSubscribed.find({}, {'_id': 0}))
    
    subscribedVehiclesNumber = [vehicle['LicensePlateNumber'] for vehicle in subscribedVehicles]
    
    notSubcribedVehicles = list(vehicleCollection.find(
        {"LicensePlateNumber": {"$nin": subscribedVehiclesNumber}},
        {"_id": 0, "LicensePlateNumber": 1,}
    ))
    
    notSubcribedVehiclesNumbers = [vehicle['LicensePlateNumber'] for vehicle in notSubcribedVehicles]
    
    companies = companyColection.distinct("Company Name")
    
    return render_template('subscribeForMoveInSync.html', 
        subscribedVehicles = subscribedVehicles,
        subscribedVehiclesNumber = subscribedVehiclesNumber,
        notSubcribedVehiclesNumbers = notSubcribedVehiclesNumbers,
        companies = companies
    )

@subscribeForMoveInSync_bp.route('/subcribe', methods=['POST'])
@jwt_required()
@roles_required('admin')  
def subscribeVehicles():
    try:
        vehicleNumbers = request.form.getlist('vehicleNumbers')

        if vehicleNumbers:
            vehicleDetails = list(vehicleCollection.find({"LicensePlateNumber": {"$in": vehicleNumbers}}, {"_id": 0,}))
            if not vehicleDetails:
                return jsonify({"message": "No vehicles found for the provided vehicle numbers"}), 404
        else:
            companyName = request.form.get('companyName')
            if not companyName:
                return jsonify({"message": "Company name is required if no vehicle numbers are provided"}), 400
            if not companyColection.find_one({"Company Name": companyName}):
                return jsonify({"message": "Invalid company name provided"}), 400
            
            vehicleDetails = list(vehicleCollection.find({"CompanyName": companyName}, {"_id": 0,}))
            if not vehicleDetails:
                return jsonify({"message": "No vehicles found for the provided company name"}), 404
            
        subscribeVehicles = []

        for vehicle in vehicleDetails:
            subscribeVehicle = {
                "LicensePlateNumber": vehicle.get("LicensePlateNumber"),
                "imei": vehicle.get("IMEI"),
                "CompanyName": vehicle.get("CompanyName"),
                "SubscribedAt": datetime.now(timezone('UTC'))
            }
            subscribeVehicles.append(subscribeVehicle)
        if subscribeVehicles:
            moveInSyncSubscribed.insert_many(subscribeVehicles)
            return jsonify({"message": "Vehicles subscribed successfully"}), 200
        else:
            return jsonify({"message": "No valid vehicles found to subscribe"}), 400
    
    except Exception as e:
        return jsonify({"message": f"An error occurred: {str(e)}"}), 500
    

@subscribeForMoveInSync_bp.route('/unsubscribe', methods=['POST'])
@jwt_required()
@roles_required('admin')
def unsubscribeVehicles():
    try:
        vehicleNumbers = request.form.getlist('vehicleNumbers')

        if vehicleNumbers:
            result = moveInSyncSubscribed.delete_many({"LicensePlateNumber": {"$in": vehicleNumbers}})
        else:
            companyName = request.form.get('companyName')
            
            if not companyColection.find_one({"Company Name": companyName}):
                return jsonify({"message": "Invalid company name provided"}), 400
            
            if not companyName:
                return jsonify({"message": "Company name is required if no vehicle numbers are provided"}), 400
            
            result = moveInSyncSubscribed.delete_many({"CompanyName": companyName})

        if result.deleted_count > 0:
            return jsonify({"message": f"Successfully unsubscribed {result.deleted_count} vehicles"}), 200
        else:
            return jsonify({"message": "No matching vehicles found to unsubscribe"}), 404
        
    except Exception as e:
        return jsonify({"message": f"An error occurred: {str(e)}"}), 500
    

        
        
    
    