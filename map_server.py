import threading
import socketserver
import json
import os
import signal
import sys
from datetime import datetime
from math import radians, sin, cos, sqrt, atan2
from pymongo import MongoClient
from flask import Flask, render_template, jsonify, request
from flask_socketio import SocketIO

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

MONGO_URI = os.getenv(
    'MONGO_URI',
    'mongodb+srv://doadmin:4T81NSqj572g3o9f@db-mongodb-blr1-27716-c2bd0cae.mongo.ondigitalocean.com/admin?tls=true&authSource=admin'
)
client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
db = client['nnx']
collection = db['atlanta']
sos_logs_collection = db['sos_logs']

def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return R * c

class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True

class MyTCPHandler(socketserver.BaseRequestHandler):
    lock = threading.Lock()
    sos_alert_triggered = False

    def handle(self):
        try:
            data = self.request.recv(4096)
            try:
                data = data.decode('utf-8').strip()
            except UnicodeDecodeError:
                print("\nReceived non-UTF-8 data, displaying raw bytes")
                print(data)  # Display the raw bytes of the data
                return  # Exit the method as we cannot process non-UTF-8 data

            print("\nReceived raw data:", data)
            json_data = self.parse_json_data(data)
            
            if json_data:
                socketio.emit('vehicle_update', json_data)  # Send real-time update
                self.store_data_in_mongodb(json_data)
                
                if json_data.get('sos', '0') == '1' and not MyTCPHandler.sos_alert_triggered:
                    MyTCPHandler.sos_alert_triggered = True
                    self.log_sos_to_mongodb(json_data)
                    socketio.emit('sos_alert', json_data)  # Notify SOS event
        except Exception as e:
            print("Error handling request:", e)

    def parse_json_data(self, data):
        try:
            parts = data.split(',')
            print(f"\nParsed data parts: {parts}")
            expected_fields_count = 35

            if len(parts) >= expected_fields_count:
                binary_string = parts[14].strip('#')
                print(f"Binary string: {binary_string}")
                
                ignition, door, sos, r1, r2, ac, r3, main_power, harsh_speed, arm, sleep = ('0',) * 11
                
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
                
                latitude = parts[4] if parts[4] != '-' else ''
                longitude = parts[6] if parts[6] != '-' else ''
                
                address = parts[25] if len(parts) > 25 else ''  # Store address data

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
                    'address': address
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
            collection.update_one({'imei': json_data['imei'], 'date': json_data['date']}, {'$set': json_data}, upsert=True)
        except Exception as e:
            print("Error storing data in MongoDB:", e)

    def log_sos_to_mongodb(self, json_data):
        try:
            sos_logs_collection.insert_one({'imei': json_data['imei'], 'latitude': json_data['latitude'], 'longitude': json_data['longitude'], 'address': json_data['address'], 'timestamp': datetime.utcnow()})
        except Exception as e:
            print("Error logging SOS alert to MongoDB:", e)

@app.route('/')
def index():
    return render_template('Vehicle/templates/vehicleMap.html')

@app.route('/api/data', methods=['GET'])
def get_vehicle_data():
    try:
        imei = request.args.get('imei')
        today = datetime.now().strftime('%d%m%y')
        query = {'date': today}
        if imei:
            query['imei'] = imei
        vehicles = list(collection.find(query))
        for v in vehicles:
            v['_id'] = str(v['_id'])
        return jsonify(vehicles)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@socketio.on('connect')
def handle_connect():
    print("Client connected to WebSocket")

@socketio.on('disconnect')
def handle_disconnect():
    print("Client disconnected from WebSocket")

def start_flask_server():
    socketio.run(app, host='0.0.0.0', port=8555, debug=True, use_reloader=False)

def run_servers():
    server = ThreadedTCPServer(('0.0.0.0', 8000), MyTCPHandler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    threading.Thread(target=start_flask_server, daemon=True).start()
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    while True:
        try:
            signal.pause()
        except KeyboardInterrupt:
            server.shutdown()
            server.server_close()
            sys.exit(0)

def signal_handler(signal, frame):
    print("Received signal:", signal)
    sys.exit(0)

if __name__ == "__main__":
    run_servers()
