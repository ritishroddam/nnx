from flask import Flask, Blueprint, render_template, request, jsonify, flash
from datetime import datetime, timedelta
from pytz import timezone
from bson import ObjectId
from app.database import db
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt, verify_jwt_in_request
from app.models import User
from app.utils import roles_required
from app.geocoding import geocodeInternal

mapZoomIn_bp = Blueprint('MapZoomIn', __name__, static_folder='static', template_folder='templates')

company_collection = db['customers_list']

@mapZoomIn_bp.route('/')
@jwt_required()
def home():
    verify_jwt_in_request(optional=True)
    claims = get_jwt()
    company = claims.get('company')
    if company is None or company.lower() == 'none':
        companyLatLng = {'lat': "13.0142181596867", 'lng': "77.64852894386185"}
        company = 'Cordon Telematics Pvt Ltd'
    else:
        try:
            companyLatLng = company_collection.find_one({'_id': ObjectId(company)}, {'_id': 0,'lat': 1, 'lng': 1})
        except Exception as e:
            print(f"[DEBUG] Error fetching company data: {e}")
            companyLatLng = {'lat': "15.34776", 'lng': "75.13378"}
            
    return render_template('mapZoomIn.html', companyLatLng=companyLatLng, companyName=company)