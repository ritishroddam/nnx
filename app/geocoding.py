from flask import Flask, request, jsonify, Blueprint
from geopy.distance import geodesic
from math import atan2, degrees, radians, sin, cos
import googlemaps
from app import db
from flask_jwt_extended import jwt_required
from config import config

gecoding_bp = Blueprint('auth', __name__)

# Initialize Google Maps API client
gmaps = googlemaps.Client(key=config['development']().GMAPS_API_KEY)

# Helper function to calculate bearing
def calculate_bearing(coord1, coord2):
    lat1, lon1 = radians(coord1[0]), radians(coord1[1])
    lat2, lon2 = radians(coord2[0]), radians(coord2[1])
    d_lon = lon2 - lon1

    x = sin(d_lon) * cos(lat2)
    y = cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(d_lon)
    initial_bearing = atan2(x, y)
    initial_bearing = degrees(initial_bearing)
    return (initial_bearing + 360) % 360

@gecoding_bp.route('/geocode', methods=['POST'])
@jwt_required()
def geocode():
    data = request.json
    lat = data.get('lat')
    lng = data.get('lng')

    if lat is None or lng is None:
        return jsonify({'error': 'Latitude and longitude are required'}), 400

    collection = db['geocoded_address']

    # Check if a nearby coordinate exists within 0.5 km
    nearby_entry = None
    for entry in collection.find():
        saved_coord = (entry['lat'], entry['lng'])
        current_coord = (lat, lng)
        distance = geodesic(saved_coord, current_coord).km
        if distance <= 0.5:
            nearby_entry = entry
            break

    if nearby_entry:
        # Calculate distance and bearing
        saved_coord = (nearby_entry['lat'], nearby_entry['lng'])
        current_coord = (lat, lng)
        distance = geodesic(saved_coord, current_coord).km
        bearing = calculate_bearing(saved_coord, current_coord)
        return jsonify({
            'distance_km': distance,
            'bearing_deg': bearing,
            'address': nearby_entry['address']
        })

    # Geocode the new coordinates using Google Maps API
    reverse_geocode_result = gmaps.reverse_geocode((lat, lng))
    if not reverse_geocode_result:
        return jsonify({'error': 'Failed to geocode the coordinates'}), 500

    address = reverse_geocode_result[0]['formatted_address']

    # Save the new geocoded address to the database
    new_entry = {
        'lat': lat,
        'lng': lng,
        'address': address
    }
    collection.insert_one(new_entry)

    return jsonify({'address': address})