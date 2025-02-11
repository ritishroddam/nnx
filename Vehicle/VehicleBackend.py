from flask import Blueprint, render_template
import map_server

vehicle_bp = Blueprint('Vehicle', __name__, static_folder='static', template_folder='templates')

@vehicle_bp.route('/map')
def map():
    return render_template('vehicleMap.html')
