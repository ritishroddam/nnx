from flask import Blueprint, render_template, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from datetime import datetime
from bson import ObjectId
from app.database import db

geofence_bp = Blueprint('Geofence', __name__, static_folder='static', template_folder='templates')

geofence_collection = db['geofences']

@geofence_bp.route('/page')
@jwt_required()
def page():
    return render_template('geofence.html')

@geofence_bp.route('/api/geofences', methods=['GET'])
@jwt_required()
def get_geofences():
    try:
        claims = get_jwt()
        user_roles = claims.get('roles', [])
        user_id = claims.get('user_id')
        user_company = claims.get('company')
        
        if 'admin' in user_roles:
            geofences = list(geofence_collection.find())
        else:
            geofences = list(geofence_collection.find({'company': user_company}))
        
        for geofence in geofences:
            geofence['_id'] = str(geofence['_id'])
            geofence['created_by_id'] = str(geofence.get('created_by_id', ''))
        
        return jsonify(geofences), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@geofence_bp.route('/api/geofences', methods=['POST'])
@jwt_required()
def create_geofence():
    try:
        claims = get_jwt()
        user_id = claims.get('user_id')
        username = claims.get('username', 'Unknown')
        user_company = claims.get('company')
        
        data = request.get_json()
        
        geofence_data = {
            'name': data.get('name'),
            'location': data.get('location'),
            'shape_type': data.get('shape_type'),
            'coordinates': data.get('coordinates'),
            'created_by': username,
            'created_by_id': str(user_id), 
            'company': user_company,
            'created_at': datetime.utcnow(),
            'is_active': True
        }
        
        result = geofence_collection.insert_one(geofence_data)
        
        return jsonify({
            'message': 'Geofence created successfully',
            'geofence_id': str(result.inserted_id)
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@geofence_bp.route('/api/geofences/<geofence_id>', methods=['DELETE'])
@jwt_required()
def delete_geofence(geofence_id):
    try:
        claims = get_jwt()
        user_roles = claims.get('roles', [])
        user_company = claims.get('company')
        
        query = {'_id': ObjectId(geofence_id)}
        if 'admin' not in user_roles:
            query['company'] = user_company
        
        result = geofence_collection.delete_one(query)
        
        if result.deleted_count > 0:
            return jsonify({'message': 'Geofence deleted successfully'}), 200
        else:
            return jsonify({'error': 'Geofence not found or access denied'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500