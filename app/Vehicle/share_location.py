from flask import Blueprint, app, request, jsonify, render_template, abort, url_for
from datetime import datetime
import secrets
from app.database import db
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app.models import User
from app.utils import roles_required
from app.geocoding import geocodeInternal
from flask_socketio import SocketIO, emit, join_room

share_location_bp = Blueprint('share_location', __name__, template_folder='../templates')
socketio = SocketIO(app, cors_allowed_origins="*")

# In-memory store for demo; use DB in production
share_links = {}

def create_share_link(imei, from_datetime, to_datetime, created_by):
    token = secrets.token_urlsafe(16)
    share_links[token] = {
        "imei": imei,
        "from_datetime": from_datetime,
        "to_datetime": to_datetime,
        "created_by": created_by
    }
    return token

@share_location_bp.route('/api/share-location', methods=['POST'])
@jwt_required()
def api_share_location():
    claims = get_jwt()
    user_id = claims.get('user_id')
    data = request.get_json()
    licensePlateNumber = data.get('LicensePlateNumber')
    from_str = data.get('from_datetime')
    to_str = data.get('to_datetime')
    if not licensePlateNumber or not from_str or not to_str:
        return jsonify({"error": "LicensePlateNumber, from_datetime, and to_datetime required"}), 400

    try:
        from_datetime = datetime.strptime(from_str, "%Y-%m-%dT%H:%M")
        to_datetime = datetime.strptime(to_str, "%Y-%m-%dT%H:%M")
    except Exception:
        return jsonify({"error": "Invalid datetime format"}), 400

    token = create_share_link(licensePlateNumber, from_datetime, to_datetime, user_id)
    link = url_for('share_location.view_share_location', token=token, _external=True)
    return jsonify({"link": link})

@share_location_bp.route('/share-location/<token>/json')
def view_share_location_json(token):
    info = share_links.get(token)
    now = datetime.utcnow()
    if not info or now < info['from_datetime'] or now > info['to_datetime']:
        return jsonify({"error": "Link expired"}), 410

    licensePlateNumber = info['imei']
    from app.database import db
    vehicle = db['vehicle_inventory'].find_one({"LicensePlateNumber": licensePlateNumber})
    if not vehicle:
        return jsonify({"error": "Vehicle not found"}), 404
    return jsonify({
        "latitude": vehicle.get("latitude"),
        "longitude": vehicle.get("longitude"),
        "LicensePlateNumber": vehicle.get("LicensePlateNumber"),
        "location": vehicle.get("location"),
    })
    
def emit_vehicle_location(token, licensePlateNumber):
    from app.database import db
    vehicle = db['vehicle_inventory'].find_one({"LicensePlateNumber": licensePlateNumber})
    if vehicle:
        socketio.emit(
            "location_update",
            {
                "latitude": vehicle.get("latitude"),
                "longitude": vehicle.get("longitude"),
                "LicensePlateNumber": vehicle.get("LicensePlateNumber"),
                "location": vehicle.get("location"),
            },
            room=token
        )

# When a client connects, join the room for their token
@socketio.on('join')
def on_join(data):
    token = data.get('token')
    join_room(token)

if __name__ == "__main__":
    socketio.run(app, debug=True)