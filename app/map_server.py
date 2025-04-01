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
import time

from app import db, socketio as sio

last_emit_time = {}

@sio.event
def connect(sid, environ):
    print(f"Client connected: {sid}")

@sio.event
def disconnect(sid):
    print(f"Client disconnected: {sid}")

@sio.event
def vehicle_update(sid, data):
    print(f"Received vehicle_update event: {data}")
    sio.emit('vehicle_update', data)  

@sio.event
def sos_alert(sid, data):
    print(f"Received sos alert: {data}")
    sio.emit('sos_alert', data) 


collection = db['atlanta']
distinctCollection = db['distinctAtlanta']
sos_logs_collection = db['sos_logs']  
distance_travelled_collection = db['distanceTravelled']
vehicle_inventory_collection = db['vehicle_inventory']

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
    status_prefix = ""

    @staticmethod
    def clean_imei(imei):
    # Extract the last 15 characters of the IMEI
        return imei[-15:]
    
    @staticmethod
    def clean_cellid(cellid):
        return cellid[:5]
    
    def should_emit(imei):
        now = time.time()
        if imei not in last_emit_time or now - last_emit_time[imei] > 1:
            last_emit_time[imei] = now
            return True
        return False
    
    def convert_to_datetime(date_str: str, time_str: str) -> datetime:
    # Parse the date and time components
        dt_str = date_str + time_str  # Combine both
        dt_obj = datetime.strptime(dt_str, "%d%m%y%H%M%S")  # Convert to datetime object
        return dt_obj

    def handle(self):
        receive_data = self.request.recv(4096)
        try:
            try:
                index_03 = receive_data.find(b'\x03')  # Finds first occurrence of \x03
                index_01 = receive_data.find(b'\x01')  # Finds first occurrence of \x01

                # Get the first occurring special character
                first_special_index = min(i for i in [index_03, index_01] if i != -1)
                first_special_char = receive_data[first_special_index:first_special_index+1]

                self.status_prefix = first_special_char.hex()

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
                    if sos_state == '1':
                        self.log_sos_to_mongodb(json_data)

                        if MyTCPHandler.convert_to_datetime(json_data['date'],json_data['time']) < datetime.now() - timedelta(minutes = 5):
                            sio.emit('sos_alert', json_data)

                self.store_data_in_mongodb(json_data)
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

                if len(binary_string) == 14:
                    ignition = binary_string[0]
                    door = binary_string[1]
                    sos = binary_string[2]
                    reserve1 = binary_string[3]
                    reserve2 = binary_string[4]
                    ac = binary_string[5]
                    reserve3 = binary_string[6]
                    main_power = binary_string[7]
                    harsh_speed = binary_string[8]
                    harsh_break = binary_string[9]
                    arm = binary_string[10]
                    sleep = binary_string[11]
                    reserve4 = binary_string[12]
                    status_accelerometer = binary_string[13]
                else:
                    print(f"Received data does not contain at least {expected_fields_count} fields.")
                    return None

                latitude = parts[4] if parts[4] != '-' else ''
                longitude = parts[6] if parts[6] != '-' else ''
                
                # Capture address (assuming address is passed after cellid field)
                address = parts[25] if len(parts) > 25 else ''

                speed_mph = float(parts[8]) if parts[8].replace('.', '', 1).isdigit() else 0.0
                speed_kmph = round(speed_mph * 1.60934, 2)

                status = parts[0]
                status_prefix = status[:-15] if len(status) > 15 else ''

                json_data = {
                    'status': self.status_prefix,
                    'imei': self.clean_imei(parts[0]),
                    'header': parts[1],
                    'time': parts[2],
                    'gps': parts[3],
                    'latitude': latitude,
                    'dir1': parts[5],
                    'longitude': longitude,
                    'dir2': parts[7],
                    'speed': str(speed_kmph),
                    'course': parts[9],
                    'date': parts[10],
                    'checksum': parts[13] if len(parts) > 13 else '0',
                    'ignition': ignition,
                    'door': door,
                    'sos': sos,
                    'reserve1': reserve1,
                    'reserve2': reserve2,
                    'ac': ac,
                    'reserve3': reserve3,
                    'main_power': main_power,
                    'harsh_speed': harsh_speed,
                    'harsh_break': harsh_break,
                    'arm': arm,
                    'sleep': sleep,
                    'reserve4': reserve4,
                    'status_accelerometer': status_accelerometer,
                    'adc_voltage': parts[15],
                    'one_wire_temp': parts[16],
                    'i_btn': parts[17],
                    'odometer': parts[18],
                    'onBoard_temp': parts[19],
                    'internal_bat': parts[20],
                    'gsm_sig': parts[21],
                    'mobCountryCode': parts[22],
                    'mobNetworkCode': parts[23],
                    'localAreaCode': parts[24],
                    'cellid':  self.clean_cellid(parts[25]),  
                    'timestamp': str(datetime.now())
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
            result = collection.insert_one(json_data)  
        except Exception as e:
            print("Error storing data in MongoDB:", e)


    def log_sos_to_mongodb(self, json_data):
        try:
            sos_log = {
                'imei': json_data['imei'],
                'date': json_data['date'],
                'time': json_data['time'],
                'latitude': json_data['latitude'],
                'longitude': json_data['longitude'],
                'location': json_data['address'],
                'timestamp': str(datetime.now())
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

def run_servers():
    HOST = "0.0.0.0"
    PORT = 8000
    server = ThreadedTCPServer((HOST, PORT), MyTCPHandler)
    print(f"Starting TCP Server @ IP: {HOST}, port: {PORT}")

    server_thread = threading.Thread(target=server.serve_forever)
    server_thread.daemon = True
    server_thread.start()

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
