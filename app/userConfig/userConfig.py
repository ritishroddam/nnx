from flask import Blueprint, render_template, request, jsonify, url_for, send_file, abort # type: ignore
from datetime import datetime, timedelta
from pytz import timezone # type: ignore
import pytz # type: ignore
from app.database import db
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt # type: ignore
from app.geocoding import geocodeInternal
from bson import ObjectId  # type: ignore
from functools import wraps
from app.utils import roles_required
import gridfs # type: ignore
import io

fs = gridfs.GridFS(db)
userConfiCollection = db['userConfig']

userConfigBlueprint = Blueprint('userConfig', __name__, static_folder='static', template_folder='templates')

def createUserConfig(userID):
    userConfig = {
        "userID": ObjectId(userID),
        "darkMode": "false",
        "alerts": [],
        "emailAlerts": [] 
    }
    result = userConfiCollection.insert_one(userConfig)

@userConfigBlueprint.route('/page')
@jwt_required()
def page():
    claims = get_jwt()
    userID = claims.get('user_id')
    userConfigs = userConfiCollection.find_one({"userID": ObjectId(userID)})
    if userConfigs:
        userConfigs['_id'] = str(userConfigs['_id'])
    return render_template('userConfig.html', userConfigs=userConfigs)

@userConfigBlueprint.route('/editDarkMode', methods=['POST'])
@jwt_required()
def editDarkMode():
    darkMode = request.json.get('darkMode')

    if darkMode not in ["true", "false"]:
        return jsonify({"error": "Invalid input"}), 400

    claims = get_jwt()
    userID = claims.get('user_id')

    userConfig = {
        "darkMode": darkMode,
    }

    checkUserConfig = userConfiCollection.find_one({"userID": ObjectId(userID)})
    
    if not checkUserConfig:
        createUserConfig(userID)
    else:
        if checkUserConfig['darkMode'] == darkMode:
            return jsonify({"message": "User configuration updated successfully"}), 200
    
    result = userConfiCollection.update_one(
        {"userID": ObjectId(userID)},
        {"$set": userConfig},
        upsert=True
    )

    if result.modified_count > 0 or result.upserted_id:
        return jsonify({"message": "User configuration updated successfully"}), 200
    else:
        return jsonify({"error": "Failed to update user configuration"}), 500
    
@userConfigBlueprint.route('/editEmailConfig', methods=['POST'])
@jwt_required()
def editEmailConfig():
    emails = request.json.get('emails', [])
    
    # Validate emails
    valid_emails = []
    for email in emails:
        email = email.strip()
        if email and '@' in email and '.' in email:  # Basic email validation
            valid_emails.append(email)
    
    claims = get_jwt()
    userID = claims.get('user_id')
    
    # Get existing config or create new one
    checkUserConfig = userConfiCollection.find_one({"userID": ObjectId(userID)})
    
    if not checkUserConfig:
        createUserConfig(userID)
    
    result = userConfiCollection.update_one(
        {"userID": ObjectId(userID)},
        {"$set": {"emailAlerts": valid_emails}},
        upsert=True
    )
    
    if result.modified_count > 0 or result.upserted_id:
        return jsonify({"message": "Email configuration updated successfully", "emails": valid_emails}), 200
    else:
        return jsonify({"error": "Failed to update email configuration"}), 500

# @userConfigBlueprint.route('/editConfig', methods=['POST'])
# @jwt_required()
# def editConfig():
#     darkMode = request.json.get('darkMode')
#     alerts = request.json.get('alerts')
#     alertsSound = request.json.get('alertsSound')
    
#     if not darkMode or not alerts:
#         return jsonify({"error": "Invalid input"}), 400
    
#     claims = get_jwt()
#     userID = claims.get('user_id')
    
#     listOfAlerts = list(alerts)
    
#     userConfig = {
#         "darkMode": "true" if darkMode == "true" else "false",
#         "alerts": listOfAlerts,
#         "alertsSound": "true" if alertsSound == "true" else "false"
#     }
    
#     result = userConfiCollection.update_one(
#         {"userID": ObjectId(userID)},
#         {"$set": userConfig},
#         upsert=True
#     )
    
#     if result.modified_count > 0 or result.upserted_id:
#         return jsonify({"message": "User configuration updated successfully"}), 200
#     else:
#         return jsonify({"error": "Failed to update user configuration"}), 500

@userConfigBlueprint.route('/editConfig', methods=['POST'])
@jwt_required()
def editConfig():
    darkMode = request.json.get('darkMode')
    alerts = request.json.get('alerts')
    alertsSound = request.json.get('alertsSound')
    
    if not darkMode or not alerts:
        return jsonify({"error": "Invalid input"}), 400
    
    claims = get_jwt()
    userID = claims.get('user_id')
    
    listOfAlerts = list(alerts)
    
    existing_config = userConfiCollection.find_one({"userID": ObjectId(userID)})
    existing_emails = existing_config.get('emailAlerts', []) if existing_config else []
    
    userConfig = {
        "darkMode": "true" if darkMode == "true" else "false",
        "alerts": listOfAlerts,
        "alertsSound": "true" if alertsSound == "true" else "false",
        "emailAlerts": existing_emails  
    }
    
    result = userConfiCollection.update_one(
        {"userID": ObjectId(userID)},
        {"$set": userConfig},
        upsert=True
    )
    
    if result.modified_count > 0 or result.upserted_id:
        return jsonify({"message": "User configuration updated successfully"}), 200
    else:
        return jsonify({"error": "Failed to update user configuration"}), 500
    
@userConfigBlueprint.route('/getCompanyLogo', methods=['GET'])
@jwt_required()
def getCompanyLogo():
    claims = get_jwt()
    companyID = claims.get('company_id')

    if companyID != "none":   
        companyLogoID = db['customers_list'].find_one(
            {"_id": ObjectId(companyID)},
            {"companyLogo": 1}
        )

        companyLogo = fs.find_one({"_id": companyLogoID['companyLogo']}) 

        if not companyLogo:
            abort(404, description="Company logo not found")

        return send_file(
            io.BytesIO(companyLogo.read()),
            mimetype = companyLogo.content_type or 'image/png',
            download_name=companyLogo.filename or 'company_logo.png'
        )    
        
    companyLogo = fs.find_one({"_id": ObjectId("683970cc1ae3f41668357362")}) 

    if not companyLogo:
        abort(404, description="Company logo not found")

    return send_file(
        io.BytesIO(companyLogo.read()),
        mimetype = companyLogo.content_type or 'image/png',
        download_name=companyLogo.filename or 'company_logo.png'
    )