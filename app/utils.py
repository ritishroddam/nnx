from app.database import db
from functools import wraps
from flask import jsonify, redirect, url_for, request, flash
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity, get_jwt

def roles_required(*required_roles):
    def wrapper(fn):
        @wraps(fn)
        def decorator(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            user_roles = claims.get('roles', [])
            
            # Check if any of the required roles are in the user's roles
            if not any(role in user_roles for role in required_roles):
                return redirect(url_for('auth.unauthorized'))
            
            return fn(*args, **kwargs)
        return decorator
    return wrapper

def get_filtered_results(collection_name, vehicle_inventory_name="vehicle_inventory", collection_query=None, projection=None):
    """
    Fetch results from a collection based on the user's role and company, with an optional query and projection.
    
    Args:
        collection_name (str): The name of the collection to query.
        vehicle_inventory_name (str): The name of the vehicle inventory collection (default: "vehicle_inventory").
        collection_query (dict): Query to filter the collection (default: None).
        projection (dict): Projection to specify fields to include or exclude (default: None).
    
    Returns:
        pymongo.cursor.Cursor: A cursor to the filtered results.
    """
    claims = get_jwt()
    user_roles = claims.get('roles', [])
    userID = claims.get('user_id')
    userCompany = claims.get('company')

    collection = db[collection_name]
    vehicle_inventory = db[vehicle_inventory_name]

    # Default query is an empty dictionary if no query is provided
    collection_query = collection_query or {}
    projection = projection or {}

    if 'admin' in user_roles:
        # Admins can access all data
        results = collection.find(collection_query, projection)
    elif 'user' in user_roles:
        # Users can only access data for vehicles assigned to them
        inventory_data = list(vehicle_inventory.find({
            'CompanyName': userCompany,
            'AssignedUsers': {'$in': [userID]}
        }))
        imei_list = [vehicle.get('IMEI') for vehicle in inventory_data if vehicle.get('IMEI')]
        results = collection.find({"imei": {"$in": imei_list}, **collection_query}, projection)
    else:
        # Client admins can access data for all vehicles in their company
        inventory_data = list(vehicle_inventory.find({'CompanyName': userCompany}))
        imei_list = [vehicle.get('IMEI') for vehicle in inventory_data if vehicle.get('IMEI')]
        results = collection.find({"imei": {"$in": imei_list}, **collection_query}, projection)

    return results
def admin_required(fn):
    return roles_required('admin')(fn)