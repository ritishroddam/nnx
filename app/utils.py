from flask import jsonify, redirect, url_for, request, flash
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity, get_jwt
from functools import wraps
from bson import ObjectId
from app.database import db

def roles_required(*required_roles):
    def wrapper(fn):
        @wraps(fn)
        def decorator(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            user_roles = claims.get('roles', [])
            
            if not any(role in user_roles for role in required_roles):
                return redirect(url_for('auth.unauthorized'))
            
            return fn(*args, **kwargs)
        return decorator
    return wrapper

def get_filtered_results(collection_name, vehicle_inventory_name="vehicle_inventory", collection_query=None):
    """
    Fetch results from a collection based on the user's role and company, with an optional query.
    
    Args:
        collection_name (str): The name of the collection to query.
        vehicle_inventory_name (str): The name of the vehicle inventory collection (default: "vehicle_inventory").
        collection_query (dict): Additional query to filter the collection (default: None).
    
    Returns:
        list: A list of results filtered based on the user's role and company.
    """
    claims = get_jwt()
    user_roles = claims.get('roles', [])
    userID = claims.get('user_id')
    userCompany = claims.get('company')

    collection = db[collection_name]
    vehicle_inventory = db[vehicle_inventory_name]

    collection_query = collection_query or {}

    if 'admin' in user_roles:
        results = collection.find(collection_query)
    elif 'user' in user_roles:
        inventory_data = list(vehicle_inventory.find({
            'CompanyName': userCompany,
            'AssignedUsers': ObjectId(userID)
        }))
        imei_list = [vehicle.get('IMEI') for vehicle in inventory_data if vehicle.get('IMEI')]
        results = collection.find({"imei": {"$in": imei_list}, **collection_query})
    else:
        inventory_data = list(vehicle_inventory.find({'CompanyName': userCompany}))
        imei_list = [vehicle.get('IMEI') for vehicle in inventory_data if vehicle.get('IMEI')]
        results = collection.find({"imei": {"$in": imei_list}, **collection_query})

    return results

def get_vehicle_data():
    """
    Fetch results from a collection based on the user's role and company
    
    Returns:
        list: A list of results filtered based on the user's role and company.
    """
    claims = get_jwt()
    user_roles = claims.get('roles', [])
    userID = claims.get('user_id')
    userCompany = claims.get('company')

    vehicle_inventory = db["vehicle_inventory"]

    if 'admin' in user_roles:
        results = vehicle_inventory.find()
    elif 'user' in user_roles:
        results = vehicle_inventory.find({
            'CompanyName': userCompany,
            'AssignedUsers': ObjectId(userID)
        })
    else:
        results = vehicle_inventory.find({'CompanyName': userCompany})


    return results

def get_vehicle_data_for_claims(claims):
    """
    Pure helper usable inside Celery tasks (no request context).
    claims: dict containing roles, company, user_id
    """
    user_roles = claims.get('roles', [])
    user_id = claims.get('user_id')
    user_company = claims.get('company')

    vehicle_inventory = db["vehicle_inventory"]

    if 'admin' in user_roles:
        cursor = vehicle_inventory.find()
    elif 'user' in user_roles:
        cursor = vehicle_inventory.find({
            'CompanyName': user_company,
            'AssignedUsers': ObjectId(user_id)
        })
    else:
        cursor = vehicle_inventory.find({'CompanyName': user_company})
    return list(cursor)

def admin_required(fn):
    return roles_required('admin')(fn)