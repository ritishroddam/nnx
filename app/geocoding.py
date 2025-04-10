# from flask import Flask, request, jsonify, Blueprint
# from geopy.distance import geodesic
# from math import atan2, degrees, radians, sin, cos
# import googlemaps
# from app import db
# from flask_jwt_extended import jwt_required
# from config import config

# gecoding_bp = Blueprint('geocode', __name__)

# # Initialize Google Maps API client
# gmaps = googlemaps.Client(key=config['development']().GMAPS_API_KEY)

# # Helper function to calculate bearing
# def calculate_bearing(coord1, coord2):
#     lat1, lon1 = radians(coord1[0]), radians(coord1[1])
#     lat2, lon2 = radians(coord2[0]), radians(coord2[1])
#     d_lon = lon2 - lon1

#     x = sin(d_lon) * cos(lat2)
#     y = cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(d_lon)
#     initial_bearing = atan2(x, y)
#     initial_bearing = degrees(initial_bearing)
#     bearing = (initial_bearing + 360) % 360

#     # Convert bearing to cardinal direction
#     if 22.5 <= bearing < 67.5:
#         return "NE"
#     elif 67.5 <= bearing < 112.5:
#         return "E"
#     elif 112.5 <= bearing < 157.5:
#         return "SE"
#     elif 157.5 <= bearing < 202.5:
#         return "S"
#     elif 202.5 <= bearing < 247.5:
#         return "SW"
#     elif 247.5 <= bearing < 292.5:
#         return "W"
#     elif 292.5 <= bearing < 337.5:
#         return "NW"
#     else:
#         return "N"

# @gecoding_bp.route('/geocode', methods=['POST'])
# @jwt_required()
# def geocode():
#     data = request.json
#     lat = data.get('lat')
#     lng = data.get('lng')

#     if lat is None or lng is None:
#         return jsonify({'error': 'Latitude and longitude are required'}), 400

#     collection = db['geocoded_address']

#     # Check if a nearby coordinate exists within 0.5 km
#     nearby_entry = None
#     for entry in collection.find():
#         saved_coord = (entry['lat'], entry['lng'])
#         current_coord = (lat, lng)
#         distance = geodesic(saved_coord, current_coord).km
#         if distance <= 0.5:
#             nearby_entry = entry
#             break

#     if nearby_entry:
#         # Calculate distance and bearing
#         saved_coord = (nearby_entry['lat'], nearby_entry['lng'])
#         current_coord = (lat, lng)
#         distance = geodesic(saved_coord, current_coord).km
#         print(f"Distance: {distance} km")
#         if distance != 0:
#             bearing = calculate_bearing(saved_coord, current_coord)
#             address = f"{distance:.2f} km {bearing} from {nearby_entry['address']}"
#         else:
#             address = nearby_entry['address']
        
#         return jsonify({
#             'address': address,
#         })

#     # Geocode the new coordinates using Google Maps API
#     reverse_geocode_result = gmaps.reverse_geocode((lat, lng))
#     if not reverse_geocode_result:
#         return jsonify({'error': 'Failed to geocode the coordinates'}), 500

#     address = reverse_geocode_result[0]['formatted_address']

#     # Save the new geocoded address to the database
#     new_entry = {
#         'lat': lat,
#         'lng': lng,
#         'address': address
#     }
#     collection.insert_one(new_entry)

#     return jsonify({'address': address})

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

# Create 2d index for legacy coordinate pairs (run once)
collection = db['geocoded_address']
collection.create_index([("lat", ASCENDING), ("lng", ASCENDING)])

# Direction mapping optimization
DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
BEARING_DEGREES = 360 / len(DIRECTIONS)

def calculate_bearing(coord1, coord2):
    """Optimized bearing calculation"""
    lat1, lon1 = radians(coord1[0]), radians(coord1[1])
    lat2, lon2 = radians(coord2[0]), radians(coord2[1])
    
    d_lon = lon2 - lon1
    x = sin(d_lon) * cos(lat2)
    y = cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(d_lon)
    
    bearing = (degrees(atan2(x, y)) + 360) % 360
    index = int(((bearing + (BEARING_DEGREES/2)) % 360) // BEARING_DEGREES)
    return DIRECTIONS[index]

def validate_coordinates(lat, lng):
    """Validate coordinate ranges"""
    if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
        raise ValueError("Invalid coordinates")

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
        # Find nearest existing point within 0.5 km using 2d index
        nearby_entry = collection.find_one({
            "lat": {"$gte": lat - 0.0045, "$lte": lat + 0.0045},  # ~0.5km latitude range
            "lng": {"$gte": lng - 0.0045, "$lte": lng + 0.0045},  # ~0.5km longitude range
            "$expr": {
                "$lte": [
                    {"$sqrt": {
                        {"$add": [
                            {"$pow": [{"$subtract": ["$lat", lat]}, 2]},
                            {"$pow": [{"$subtract": ["$lng", lng]}, 2]}
                        ]}
                    }},
                    0.0045  # Euclidean approximation for 0.5km
                ]
            }
        })

        if nearby_entry:
            saved_coord = (nearby_entry['lat'], nearby_entry['lng'])
            current_coord = (lat, lng)
            
            # Calculate exact distance
            distance = geodesic(saved_coord, current_coord).km
            bearing = calculate_bearing(saved_coord, current_coord)
            
            address = (f"{distance:.2f} km {bearing} from {nearby_entry['address']}"
                      if distance > 0 else nearby_entry['address'])
            
            return jsonify({'address': address})

        # Geocode new coordinates
        reverse_geocode_result = gmaps.reverse_geocode((lat, lng))
        if not reverse_geocode_result:
            print("Geocoding API failed")
            return jsonify({'error': 'Geocoding service unavailable'}), 503

        address = reverse_geocode_result[0]['formatted_address']
        
        # Insert new document with double coordinates
        collection.insert_one({
            'lat': lat,
            'lng': lng,
            'address': address
        })

        return jsonify({'address': address})

    except Exception as e:
        print(f"Geocoding error: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500