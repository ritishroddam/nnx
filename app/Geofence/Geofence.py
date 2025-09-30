from flask import Blueprint, render_template, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt

geofence_bp = Blueprint('Geofence', __name__, static_folder='static', template_folder='templates')

@geofence_bp.route('/page')
@jwt_required()
def page():
    return render_template('geofence.html')