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
            data = self.request.recv(4096).decode('utf-8').strip()
            print("Received raw data:", data)
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
            if len(parts) >= 35:
                binary_string = parts[14].strip('#')
                ignition, door, sos = binary_string[:3] if len(binary_string) >= 3 else ('0', '0', '0')
                return {
                    'imei': parts[0], 'header': parts[1], 'time': parts[2],
                    'gps': parts[3], 'latitude': parts[4], 'dir1': parts[5],
                    'longitude': parts[6], 'dir2': parts[7], 'speed': parts[8],
                    'course': parts[9], 'date': parts[10], 'sos': sos,
                    'address': parts[25] if len(parts) > 25 else ''
                }
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
    socketio.run(app, host='0.0.0.0', port=8002, debug=True, use_reloader=False)

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
