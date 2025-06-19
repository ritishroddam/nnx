from flask import Flask, Blueprint, render_template, request, jsonify, flash, url_for
from datetime import datetime, timedelta
from pytz import timezone
from bson import ObjectId
from app.database import db
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt, verify_jwt_in_request
from app.models import User
from app.utils import roles_required
from app.geocoding import geocodeInternal

companyConfig_bp = Blueprint('CompanyConfig', __name__, static_folder='static', template_folder='templates')

companyConfigCollection = db['company_config']

@companyConfig_bp.route('/')
@jwt_required()
@roles_required('clientAdmin')
def home():
    claims = get_jwt()
    companyId = claims.get('company_id')
    if not companyId or companyId == '' or companyId.lower() == 'None':
        flash('You do not have access to this page.', 'danger')
        return url_for('main.home')
    
    companyConfig = companyConfigCollection.find_one({'companyId': ObjectId(companyId)}, {'_id': 0})
    
    if not companyConfig:
        companyConfig = {
            'busSlowSpeed' : "40",
            'busNormalSpeed' : "60",
            'sedanSlowSpeed' : "40",
            'sedanNormalSpeed' : "60",
            'hatchbackSlowSpeed' : "40",
            'hatchbackNormalSpeed' : "60",
            'suvSlowSpeed' : "40",
            'suvNormalSpeed' : "60",
            'vanSlowSpeed' : "40",
            'vanNormalSpeed' : "60",
            'truckSlowSpeed' : "40",
            'truckNormalSpeed' : "60",
            'bikeSlowSpeed' : "40",
            'bikeNormalSpeed' : "60",
        }
    
    return render_template('companyConfig.html', companyConfig=companyConfig)


@companyConfig_bp.route('/editConfig', methods=['POST'])
@jwt_required()
def editConfig():
    busSlowSpeed = str(request.json.get('busSlowSpeed'))
    busNormalSpeed = str(request.json.get('busNormalSpeed'))
    sedanSlowSpeed = str(request.json.get('sedanSlowSpeed'))
    sedanNormalSpeed = str(request.json.get('sedanNormalSpeed'))
    hatchbackSlowSpeed = str(request.json.get('hatchbackSlowSpeed'))
    hatchbackNormalSpeed = str(request.json.get('hatchbackNormalSpeed'))
    suvSlowSpeed = str(request.json.get('suvSlowSpeed'))
    suvNormalSpeed = str(request.json.get('suvNormalSpeed'))
    vanSlowSpeed = str(request.json.get('vanSlowSpeed'))
    vanNormalSpeed = str(request.json.get('vanNormalSpeed'))
    truckSlowSpeed = str(request.json.get('truckSlowSpeed'))
    truckNormalSpeed = str(request.json.get('truckNormalSpeed'))
    bikeSlowSpeed = str(request.json.get('bikeSlowSpeed'))
    bikeNormalSpeed = str(request.json.get('bikeNormalSpeed'))
    
    if not all([busSlowSpeed, busNormalSpeed, sedanSlowSpeed, sedanNormalSpeed,
                hatchbackSlowSpeed, hatchbackNormalSpeed, suvSlowSpeed, suvNormalSpeed,
                vanSlowSpeed, vanNormalSpeed, truckSlowSpeed, truckNormalSpeed,
                bikeSlowSpeed, bikeNormalSpeed]):
        return jsonify({"error": "All fields are required"}), 400
    
    companyConfig = {
        "busSlowSpeed": busSlowSpeed,
        "busNormalSpeed": busNormalSpeed,
        "sedanSlowSpeed": sedanSlowSpeed,
        "sedanNormalSpeed": sedanNormalSpeed,
        "hatchbackSlowSpeed": hatchbackSlowSpeed,
        "hatchbackNormalSpeed": hatchbackNormalSpeed,
        "suvSlowSpeed": suvSlowSpeed,
        "suvNormalSpeed": suvNormalSpeed,
        "vanSlowSpeed": vanSlowSpeed,
        "vanNormalSpeed": vanNormalSpeed,
        "truckSlowSpeed": truckSlowSpeed,
        "truckNormalSpeed": truckNormalSpeed,
        "bikeSlowSpeed": bikeSlowSpeed,
        "bikeNormalSpeed": bikeNormalSpeed
    }
    
    claims = get_jwt()
    companyId = claims.get('company_id')
    
    result = companyConfigCollection.update_one(
        {"companyId": ObjectId(companyId)},
        {"$set": companyConfig},
        upsert=True
    )
    
    if result.modified_count > 0 or result.upserted_id:
        return jsonify({"message": "User configuration updated successfully"}), 200
    else:
        return jsonify({"error": "Failed to update user configuration"}), 500