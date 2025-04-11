from flask import Flask, request, jsonify, Blueprint
from geopy.distance import geodesic
from math import atan2, degrees, radians, sin, cos
import googlemaps
from app import db
from flask_jwt_extended import jwt_required
from config import config
from pymongo import ASCENDING

gecoding_bp = Blueprint('geocode', __name__)

# Initialize Google Maps API client
gmaps = googlemaps.Client(key=config['development']().GMAPS_API_KEY)

# Create compound index for fast queries
collection = db['geocoded_address']
collection.create_index([("lat", ASCENDING), ("lng", ASCENDING)])

DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
BEARING_DEGREES = 360 / len(DIRECTIONS)

def calculate_bearing(coord1, coord2):
    lat1, lon1 = radians(coord1[0]), radians(coord1[1])
    lat2, lon2 = radians(coord2[0]), radians(coord2[1])
    d_lon = lon2 - lon1
    x = sin(d_lon) * cos(lat2)
    y = cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(d_lon)
    bearing = (degrees(atan2(x, y)) + 360) % 360
    return DIRECTIONS[int(((bearing + (BEARING_DEGREES/2)) % 360) // BEARING_DEGREES)]

def validate_coordinates(lat, lng):
    if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
        raise ValueError("Invalid coordinates")
    
def geocodeInternal(lat,lng):
    try:
        validate_coordinates(lat, lng)
    except(ValueError) as e:
        print(f"Invalid input: {str(e)}")
        return "Invalid coordinates"

    try:
        # Step 1: Fast bounding box filter (0.5km range)
        nearby_entries = collection.find({
            "lat": {"$gte": lat - 0.0045, "$lte": lat + 0.0045},
            "lng": {"$gte": lng - 0.0045, "$lte": lng + 0.0045}
        })

        # Step 2: Precise distance calculation
        nearest_entry = None
        min_distance = 0.5  # Max search radius in km
        
        for entry in nearby_entries:
            saved_coord = (entry['lat'], entry['lng'])
            current_coord = (lat, lng)
            distance = geodesic(saved_coord, current_coord).km
            
            if distance <= min_distance:
                nearest_entry = entry
                min_distance = distance

        if nearest_entry:
            saved_coord = (nearest_entry['lat'], nearest_entry['lng'])
            current_coord = (lat, lng)
            bearing = calculate_bearing(saved_coord, current_coord)
            
            return (f"{min_distance:.2f} km {bearing} from {nearest_entry['address']}"
                      if min_distance > 0 else nearest_entry['address'])

        # Step 3: Geocode new coordinates
        reverse_geocode_result = gmaps.reverse_geocode((lat, lng))
        if not reverse_geocode_result:
            print("Geocoding API failed")
            return "Address unavailable"

        address = reverse_geocode_result[0]['formatted_address']
        
        # Step 4: Insert new entry
        collection.insert_one({
            'lat': lat,
            'lng': lng,
            'address': address
        })

        return address

    except Exception as e:
        print(f"Geocoding error: {str(e)}", exc_info=True)
        return "Error retrieving address"

@gecoding_bp.route('/geocode', methods=['POST'])
@jwt_required()
def geocode():
    try:
        data = request.json
        lat = float(data.get('lat'))
        lng = float(data.get('lng'))
        validate_coordinates(lat, lng)
    except (TypeError, ValueError) as e:
        print(f"Invalid input: {str(e)}")
        return jsonify({'error': 'Invalid coordinates'}), 400

    try:
        # Step 1: Fast bounding box filter (0.5km range)
        nearby_entries = collection.find({
            "lat": {"$gte": lat - 0.0045, "$lte": lat + 0.0045},
            "lng": {"$gte": lng - 0.0045, "$lte": lng + 0.0045}
        })

        # Step 2: Precise distance calculation
        nearest_entry = None
        min_distance = 0.5  # Max search radius in km
        
        for entry in nearby_entries:
            saved_coord = (entry['lat'], entry['lng'])
            current_coord = (lat, lng)
            distance = geodesic(saved_coord, current_coord).km
            
            if distance <= min_distance:
                nearest_entry = entry
                min_distance = distance

        if nearest_entry:
            saved_coord = (nearest_entry['lat'], nearest_entry['lng'])
            current_coord = (lat, lng)
            bearing = calculate_bearing(saved_coord, current_coord)
            
            address = (f"{min_distance:.2f} km {bearing} from {nearest_entry['address']}"
                      if min_distance > 0 else nearest_entry['address'])
            
            return jsonify({'address': address})

        # Step 3: Geocode new coordinates
        reverse_geocode_result = gmaps.reverse_geocode((lat, lng))
        if not reverse_geocode_result:
            print("Geocoding API failed")
            return jsonify({'error': 'Geocoding service unavailable'}), 503

        address = reverse_geocode_result[0]['formatted_address']
        
        # Step 4: Insert new entry
        collection.insert_one({
            'lat': lat,
            'lng': lng,
            'address': address
        })

        return jsonify({'address': address})

    except Exception as e:
        print(f"Geocoding error: {str(e)}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500