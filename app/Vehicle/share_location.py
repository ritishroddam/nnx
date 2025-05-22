from flask import Blueprint, request, jsonify, render_template, abort, url_for
from datetime import datetime
import secrets
from app.database import db
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app.models import User
from app.utils import roles_required
from app.geocoding import geocodeInternal

share_location_bp = Blueprint('share_location', __name__, template_folder='../templates')

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
    # User must be logged in (add your auth check here)
    user = getattr(request, 'user', None)
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    licensePlateNumber = data.get('LicensePlateNumber')
    from_str = data.get('from_datetime')
    to_str = data.get('to_datetime')
    if not licensePlateNumber or not from_str or not to_str:
        return jsonify({"error": "IMEI, from_datetime, and to_datetime required"}), 400

    try:
        from_datetime = datetime.strptime(from_str, "%Y-%m-%dT%H:%M")
        to_datetime = datetime.strptime(to_str, "%Y-%m-%dT%H:%M")
    except Exception:
        return jsonify({"error": "Invalid datetime format"}), 400

    token = create_share_link(licensePlateNumber, from_datetime, to_datetime, user['id'])
    link = url_for('share_location.view_share_location', token=token, _external=True)
    return jsonify({"link": link})

@share_location_bp.route('/share-location/<token>')
def view_share_location(token):
    info = share_links.get(token)
    now = datetime.utcnow()
    if not info or now < info['from_datetime'] or now > info['to_datetime']:
        return render_template('share_location_expired.html'), 410

    imei = info['imei']
    # Fetch latest vehicle location from DB
    # db = get_db()
    # vehicle = db.vehicles.find_one({"imei": imei})
    vehicle = {"imei": imei, "latitude": 12.9716, "longitude": 77.5946, "LicensePlateNumber": "KA01AB1234", "location": "Bangalore"}  # Demo
    if not vehicle:
        abort(404)
    return render_template(
        'share_location.html',
        vehicle=vehicle,
        from_datetime=info['from_datetime'].strftime('%Y-%m-%d %H:%M UTC'),
        to_datetime=info['to_datetime'].strftime('%Y-%m-%d %H:%M UTC')
    )