import threading
import socketserver
import json
from datetime import datetime, timedelta
import os
from pymongo import MongoClient
from flask import Flask, render_template, jsonify, request
import signal
import sys
from datetime import datetime
from flask_cors import CORS
from math import radians, sin, cos, sqrt, atan2
import socketio
import eventlet
import eventlet.wsgi
from collections.abc import MutableMapping

app = Flask(__name__)
CORS(app)

sio = socketio.Server(cors_allowed_origins="*")
app.wsgi_app = socketio.WSGIApp(sio, app.wsgi_app)

MONGO_URI = os.getenv(
    'MONGO_URI',
    'mongodb+srv://doadmin:4T81NSqj572g3o9f@db-mongodb-blr1-27716-c2bd0cae.mongo.ondigitalocean.com/admin?tls=true&authSource=admin'
)
client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
db = client['nnx']
collection = db['atlanta']
distinctCollection = db['distinctAtlanta']
sos_logs_collection = db['sos_logs']  
distance_travelled_collection = db['distanceTravelled']

class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True

    def __init__(self, server_address, handler_cls):
        super().__init__(server_address, handler_cls)
        self.shutdown_event = threading.Event()

    def server_close(self):
        super().server_close()

class MyTCPHandler(socketserver.BaseRequestHandler):

    lock = threading.Lock()
    sos_active = False
    sos_alert_triggered = False

    @staticmethod
    def clean_imei(imei):
    # Extract the last 15 characters of the IMEI
        return imei[-15:]

    def handle(self):
        receive_data = self.request.recv(4096)
        try:
            try:
                data = receive_data.decode('utf-8').strip()
            except UnicodeDecodeError:
                data = receive_data.decode('latin-1').strip()
                # print("Received raw data:", data)

            json_data = self.parse_json_data(data)
            if json_data:
                # print("Valid JSON data:", json_data)

                sos_state = json_data.get('sos', '0')
                # print(f"SOS state received: {sos_state}")

                with MyTCPHandler.lock:
                    if sos_state == '1' and not MyTCPHandler.sos_alert_triggered:
                        MyTCPHandler.sos_active = True
                        MyTCPHandler.sos_alert_triggered = True
                        # print("SOS alert triggered!")

                        # Log SOS to MongoDB
                        self.log_sos_to_mongodb(json_data)

                        # Emit SOS alert to connected clients
                        json_data['_id'] = str(json_data['_id'])
                        sio.emit('sos_alert', json_data)

                    elif sos_state == '0' and MyTCPHandler.sos_active:
                        MyTCPHandler.sos_active = False
                        MyTCPHandler.sos_alert_triggered = False
                        # print("SOS alert reset.")

                if json_data.get('gps') == 'A':
                    self.store_data_in_mongodb(json_data)

                    # Emit vehicle update to connected clients
                    json_data['_id'] = str(json_data['_id'])
                    sio.emit('vehicle_update', json_data)

                if 'latitude' in json_data and 'longitude' in json_data:
                    latitude = json_data['latitude']
                    longitude = json_data['longitude']
                    # print(f"Vehicle location - Latitude: {latitude}, Longitude: {longitude}")

            else:
                print("Invalid JSON format")

        except Exception as e:
            print("Error handling request:", e)
            try:
                error_data = receive_data.decode('utf-8', errors='replace').strip()
                print("Error data:", error_data, e)
            except Exception as e:
                print("Error decoding data.", e)

    def parse_json_data(self, data):
        try:
            parts = data.split(',')
            # print(f"Parsed data parts: {parts}")
            expected_fields_count = 35

            if len(parts) >= expected_fields_count:

                binary_string = parts[14].strip('#')
                # print(f"Binary string: {binary_string}")

                ignition, door, sos = '0', '0', '0'

                if len(binary_string) >= 11:
                    ignition = binary_string[0]
                    door = binary_string[1]
                    sos = binary_string[2]
                    r1 = binary_string[3]
                    r2 = binary_string[4]
                    ac = binary_string[5]
                    r3 = binary_string[6]
                    main_power = binary_string[7]
                    harsh_speed = binary_string[8]
                    arm = binary_string[9]
                    sleep = binary_string[10]
                else:
                    ignition = door = sos = r1 = r2 = ac = r3 = main_power = harsh_speed = arm = sleep = '0'

                latitude = parts[4] if parts[4] != '-' else ''
                longitude = parts[6] if parts[6] != '-' else ''
                
                # Capture address (assuming address is passed after cellid field)
                address = parts[25] if len(parts) > 25 else ''  # Adjust index based on the data format

                json_data = {
                    'imei': parts[0],
                    'header': parts[1],
                    'time': parts[2],
                    'gps': parts[3],
                    'latitude': latitude,
                    'dir1': parts[5],
                    'longitude': longitude,
                    'dir2': parts[7],
                    'speed': parts[8],
                    'course': parts[9],
                    'date': parts[10],
                    'checksum': parts[13] if len(parts) > 13 else '0',
                    'ignition': ignition,
                    'door': door,
                    'sos': sos,
                    'r1': r1,
                    'r2': r2,
                    'ac': ac,
                    'r3': r3,
                    'main_power': main_power,
                    'harsh_speed': harsh_speed,
                    'arm': arm,
                    'sleep': sleep,
                    'accelerometer': parts[12],
                    'adc': parts[15],
                    'one_wire': parts[16],
                    'i_btn': parts[17],
                    'odometer': parts[18],
                    'temp': parts[19],
                    'internal_bat': parts[20],
                    'gsm_sig': parts[21],
                    'mcc': parts[22],
                    'mnc': parts[23],
                    'cellid': parts[24],
                    'address': address  # Store address data
                }
                return json_data
            else:
                print(f"Received data does not contain at least {expected_fields_count} fields.")
                return None

        except Exception as e:
            print("Error parsing JSON data:", e)
            return None

    def store_data_in_mongodb(self, json_data):
        try:
            json_data['imei'] = self.clean_imei(json_data['imei'])
            collection.insert_one(json_data)
            self.update_distance_travelled_today(json_data)
            # print("Data stored in MongoDB.")
        except Exception as e:
            print("Error storing data in MongoDB:", e)

    def update_distance_travelled_today(self, json_data):
        try:
            imei = json_data['imei']
            date_str = datetime.now().strftime('%d%m%y')
            odometer = float(json_data.get('odometer', 0))

            # Fetch the existing record for today
            record = distance_travelled_collection.find_one({"date": date_str})

            if record:
                # Calculate the new total distance
                total_distance = record.get('totalDistance', 0)
                previous_odometer = record.get('odometer', 0)
                distance = odometer - previous_odometer
                total_distance += distance

                # Update the total distance and odometer
                distance_travelled_collection.update_one(
                    {"date": date_str},
                    {"$set": {"totalDistance": total_distance, "odometer": odometer}}
                )
            else:
                # Insert a new record
                distance_travelled_collection.insert_one({
                    "date": date_str,
                    "totalDistance": 0,
                    "odometer": odometer
                })
        except Exception as e:
            print("Error updating distance travelled:", e)

    def log_sos_to_mongodb(self, json_data):
        try:
            sos_log = {
                'imei': json_data['imei'],
                'latitude': json_data['latitude'],
                'longitude': json_data['longitude'],
                'location': json_data['address'],
                'timestamp': datetime.now()
            }
            sos_logs_collection.insert_one(sos_log)
            # print("SOS alert logged in MongoDB:", sos_log)
        except Exception as e:
            print("Error logging SOS alert to MongoDB:", e)

def log_data(json_data):
    try:
        log_entry = {
            'imei': json_data['imei'],
            'latitude': json_data['latitude'],
            'longitude': json_data['longitude'],
            'speed': json_data.get('speed', '0'),
            'timestamp': datetime.now()
        }
        db['logs'].insert_one(log_entry)  # Store logs in 'logs' collection
        # print("Log stored in MongoDB:", log_entry)
    except Exception as e:
        print("Error logging data to MongoDB:", e)

@app.route('/')
def index():
    return render_template('vehicleMap.html')

@app.route('/api/data', methods=['GET', 'POST'])
def receive_data():
    if request.method == 'POST':
        try:
            data = request.get_json()
            if data:
                collection.insert_one(data)
                # print("Data received from TCP server and stored in MongoDB:", data)
                return jsonify({'message': 'Data received successfully'}), 200
            else:
                return jsonify({'error': 'No JSON data received'}), 400
        except Exception as e:
            print("Error in POST /api/data:", str(e))  # Log error
            return jsonify({'error': str(e)}), 500

    elif request.method == 'GET':
        try:
            imei = request.args.get('imei')
            today = datetime.now().strftime('%d%m%y')

            cursor = distinctCollection.find()
            vehicles = list(cursor)

            if not vehicles:
                print("No vehicle data found for today.")  # Debugging log
                return jsonify({'error': 'No data found'}), 404

            landmarks_cursor = db.landmarks.find({})
            landmarks = list(landmarks_cursor)

            for vehicle in vehicles:
                try:
                    vehicle_lat = float(vehicle.get('latitude', 0))
                    vehicle_lon = float(vehicle.get('longitude', 0))

                    nearest_landmark = None
                    min_distance = float('inf')

                    for landmark in landmarks:
                        landmark_lat = float(landmark['latitude'])
                        landmark_lon = float(landmark['longitude'])

                        distance = calculate_distance(vehicle_lat, vehicle_lon, landmark_lat, landmark_lon)
                        if distance < min_distance:
                            min_distance = distance
                            nearest_landmark = landmark

                    vehicle['nearest_landmark'] = nearest_landmark['name'] if nearest_landmark else None
                    vehicle['distance_to_landmark'] = min_distance if nearest_landmark else None
                    vehicle['_id'] = str(vehicle['_id'])  # Convert ObjectId to string
                except Exception as e:
                    print(f"Error processing vehicle data: {str(e)}")  # Log per-vehicle errors

            return jsonify(vehicles)

        except Exception as e:
            print("Error in GET /api/data:", str(e))  # Log error
            return jsonify({'error': str(e)}), 500

    else:
        return jsonify({'error': 'Method not allowed'}), 405

@app.route('/api/logs', methods=['GET'])
def get_logs():
    try:
        logs_cursor = db['logs'].find().sort("timestamp", -1).limit(100)  # Fetch latest 100 logs
        logs = []
        for log in logs_cursor:
            log['_id'] = str(log['_id'])  # Convert ObjectId to string
            logs.append(log)
        return jsonify(logs)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def start_flask_server():
    eventlet.wsgi.server(eventlet.listen(('0.0.0.0', 8555)), app)

def run_servers():
    HOST = "0.0.0.0"
    PORT = 8000
    server = ThreadedTCPServer((HOST, PORT), MyTCPHandler)
    print(f"Starting TCP Server @ IP: {HOST}, port: {PORT}")

    server_thread = threading.Thread(target=server.serve_forever)
    server_thread.daemon = True
    server_thread.start()

    flask_thread = threading.Thread(target=start_flask_server)
    flask_thread.daemon = True
    flask_thread.start()

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    print("Server running. Press Ctrl+C to stop.")
    while True:
        try:
            signal.pause()
        except KeyboardInterrupt:
            print("Server shutting down...")
            server.shutdown()
            server.server_close()
            sys.exit(0)

def signal_handler(signal, frame):
    print("Received signal:", signal)
    sys.exit(0)

def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371.0  # Radius of the Earth in km
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)

    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))

    distance = R * c
    return distance


if __name__ == "__main__":
    run_servers()