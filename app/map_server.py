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

class MyTCPHandler(socketserver.BaseRequestHandler):

    lock = eventlet.semaphore.Semaphore()
    sos_active = False
    sos_alert_triggered = False
    status_prefix = ""

    @staticmethod
    def clean_imei(imei):
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
        dt_str = date_str + time_str
        dt_obj = datetime.strptime(dt_str, "%d%m%y%H%M%S")
        return dt_obj

    def handle(self):
        receive_data = self.request.recv(4096)
        try:
            try:
                index_03 = receive_data.find(b'\x03')
                index_01 = receive_data.find(b'\x01')

                first_special_index = min(i for i in [index_03, index_01] if i != -1)
                first_special_char = receive_data[first_special_index:first_special_index+1]

                self.status_prefix = first_special_char.hex()

                data = receive_data.decode('utf-8').strip()
            except UnicodeDecodeError:
                data = receive_data.decode('latin-1').strip()

            json_data = self.parse_json_data(data)
            if json_data:
                sos_state = json_data.get('sos', '0')

                with MyTCPHandler.lock:
                    if sos_state == '1':
                        self.log_sos_to_mongodb(json_data)

                        if MyTCPHandler.convert_to_datetime(json_data['date'], json_data['time']) < datetime.now() - timedelta(minutes=5):
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
            expected_fields_count = 35

            if len(parts) >= expected_fields_count:

                binary_string = parts[14].strip('#')

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
                'latitude': json_data['latitude'],
                'longitude': json_data['longitude'],
                'timestamp': str(datetime.now())
            }
            sos_logs_collection.insert_one(sos_log)
        except Exception as e:
            print("Error logging SOS alert to MongoDB:", e)

# Replace server threading with eventlet's WSGI server
def run_servers():
    HOST = "0.0.0.0"
    PORT = 8000
    
    # Use eventlet's WSGI server for better concurrency
    from eventlet import wsgi
    from app import pool

    # Initialize the server with your TCP handler
    server = socketserver.TCPServer((HOST, PORT), MyTCPHandler)
    print(f"Starting TCP Server @ IP: {HOST}, port: {PORT}")
    
    # Use GreenPool to manage green threads
    pool.spawn(wsgi.server, server)  # This will spawn the server to handle requests

    print("Server running. Press Ctrl+C to stop.")
    while True:
        try:
            eventlet.sleep(100)  # Sleep and keep the server running
        except KeyboardInterrupt:
            print("Server shutting down...")
            server.shutdown()
            server.server_close()
            sys.exit(0)


# Replace signal handling for eventlet
def signal_handler(signal, frame):
    print("Received signal:", signal)
    sys.exit(0)

