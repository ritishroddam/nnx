from flask import Blueprint, render_template, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from datetime import datetime
from bson import ObjectId
from app.database import db

geofence_bp = Blueprint('Geofence', __name__, static_folder='static', template_folder='templates')

# MongoDB collection for geofences
geofence_collection = db['geofences']

@geofence_bp.route('/page')
@jwt_required()
def page():
    return render_template('geofence.html')

@geofence_bp.route('/api/geofences', methods=['GET', 'POST'])
@jwt_required()
def handle_geofences():
    try:
        claims = get_jwt()
        user_id = claims.get('user_id')
        username = claims.get('username', 'Unknown')
        user_company = claims.get('company')
        
        if request.method == 'GET':
            # GET - Fetch geofences
            if 'admin' in claims.get('roles', []):
                geofences = list(geofence_collection.find())
            else:
                geofences = list(geofence_collection.find({'company': user_company}))
            
            # Convert ObjectId to string for JSON serialization
            for geofence in geofences:
                geofence['_id'] = str(geofence['_id'])
                if 'created_by_id' in geofence:
                    geofence['created_by_id'] = str(geofence['created_by_id'])
            
            return jsonify(geofences), 200
            
        elif request.method == 'POST':
            # POST - Create new geofence
            data = request.get_json()
            
            if not data:
                return jsonify({'error': 'No data provided'}), 400
            
            geofence_data = {
                'name': data.get('name'),
                'location': data.get('location'),
                'shape_type': data.get('shape_type'),
                'coordinates': data.get('coordinates'),
                'alert_enter': data.get('alert_enter', False),
                'alert_leave': data.get('alert_leave', False),
                'created_by': username,
                'created_by_id': ObjectId(user_id),
                'company': user_company,
                'created_at': datetime.utcnow(),
                'is_active': True
            }
            
            # Validate required fields
            required_fields = ['name', 'shape_type', 'coordinates']
            for field in required_fields:
                if not geofence_data.get(field):
                    return jsonify({'error': f'Missing required field: {field}'}), 400
            
            result = geofence_collection.insert_one(geofence_data)
            
            # Return the created geofence with ID
            geofence_data['_id'] = str(result.inserted_id)
            geofence_data['created_by_id'] = str(geofence_data['created_by_id'])
            
            return jsonify({
                'message': 'Geofence created successfully',
                'geofence': geofence_data
            }), 201
            
    except Exception as e:
        print(f"Error in handle_geofences: {e}")
        return jsonify({'error': str(e)}), 500

@geofence_bp.route('/api/geofences/<geofence_id>', methods=['DELETE'])
@jwt_required()
def delete_geofence(geofence_id):
    try:
        claims = get_jwt()
        user_roles = claims.get('roles', [])
        user_company = claims.get('company')
        
        # Validate ObjectId
        if not ObjectId.is_valid(geofence_id):
            return jsonify({'error': 'Invalid geofence ID'}), 400
        
        query = {'_id': ObjectId(geofence_id)}
        if 'admin' not in user_roles:
            query['company'] = user_company
        
        result = geofence_collection.delete_one(query)
        
        if result.deleted_count > 0:
            return jsonify({'message': 'Geofence deleted successfully'}), 200
        else:
            return jsonify({'error': 'Geofence not found or access denied'}), 404
            
    except Exception as e:
        print(f"Error in delete_geofence: {e}")
        return jsonify({'error': str(e)}), 500

@geofence_bp.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'message': 'Geofence API is working'}), 200