from flask import Blueprint, app, request, jsonify, render_template, abort, url_for
from datetime import datetime, timezone
import pytz
import secrets
from app.database import db
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt # type: ignore
from app.models import User # type: ignore
from app.utils import roles_required # type: ignore
from app.geocoding import geocodeInternal # type: ignore
from flask_socketio import emit, join_room
from app import socketio

share_location_bp = Blueprint('ShareLocation', __name__, static_folder='static', template_folder='templates')

# In-memory store for demo; use DB in production
share_links = {}

def create_share_link(licensePlateNumber, from_datetime, to_datetime, created_by):
    token = secrets.token_urlsafe(16)
    share_links[token] = {
        "licensePlateNumber": licensePlateNumber,
        "from_datetime": from_datetime,
        "to_datetime": to_datetime,
        "created_by": created_by
    }
    return token

@share_location_bp.route('/share-location', methods=['POST'])
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
        local_tz = pytz.timezone("Asia/Kolkata")  # or your local timezone
        from_naive = datetime.strptime(from_str, "%Y-%m-%dT%H:%M")
        to_naive = datetime.strptime(to_str, "%Y-%m-%dT%H:%M")
        from_datetime = local_tz.localize(from_naive).astimezone(pytz.UTC)
        to_datetime = local_tz.localize(to_naive).astimezone(pytz.UTC)
    except Exception:
        return jsonify({"error": "Invalid datetime format"}), 400

    token = create_share_link(licensePlateNumber, from_datetime, to_datetime, user_id)
    link = url_for('ShareLocation.view_share_location_json', token=token, _external=True)
    return jsonify({"link": link})

@share_location_bp.route('/share-location/<token>/json')
def view_share_location_json(token):
    info = share_links.get(token)
    now = datetime.now(timezone.utc)  # Make now timezone-aware (UTC)
    if not info or now < info['from_datetime'] or now > info['to_datetime']:
        return jsonify({"error": "Link expired"}), 410

    licensePlateNumber = info['licensePlateNumber']
    vehicle = db['vehicle_inventory'].find_one({"LicensePlateNumber": licensePlateNumber},{"_id": 0, "IMEI":1})
    if not vehicle:
        return jsonify({"error": "Vehicle not found"}), 404
    
    latestLocation = db['distinctAtlanta'].find_one(
        {"IMEI": vehicle.get("IMEI")},
        {"_id": 0, "latitude": 1, "longitude": 1},
    )
    
    if not latestLocation:
        return jsonify({"error": "No location data found for this vehicle"}), 404
    
    location = geocodeInternal(latestLocation.get("latitude"), latestLocation.get("longitude"))
    
    if not location:
        return jsonify({"error": "Geocoding failed"}), 500
    
    return jsonify({
        "latitude": latestLocation.get("latitude"),
        "longitude": latestLocation.get("longitude"),
        "LicensePlateNumber": vehicle.get("LicensePlateNumber"),
        "location": location,
    })
    
def emit_vehicle_location(token, licensePlateNumber):
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