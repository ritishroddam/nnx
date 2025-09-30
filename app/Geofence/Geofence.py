from flask import Blueprint, render_template, request, jsonify
from flask_login import login_required

geofence_bp = Blueprint('Geofence', __name__, static_folder='static', template_folder='templates')
@geofence_bp.route('/geofence', methods=['GET'])
@login_required
def page():
    return render_template('geofence.html')