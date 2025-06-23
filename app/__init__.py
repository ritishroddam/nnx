from bson import ObjectId
import eventlet
from flask import Flask, redirect, url_for, flash, jsonify, request, g, render_template
from flask_jwt_extended import jwt_required,JWTManager, get_jwt, get_jwt_identity, verify_jwt_in_request, create_access_token, set_access_cookies, unset_jwt_cookies, unset_refresh_cookies
from flask_jwt_extended.exceptions import NoAuthorizationError, JWTDecodeError
from pymongo import MongoClient
from config import config
from flask_socketio import SocketIO, join_room, leave_room, rooms
import subprocess
import os
import signal
from datetime import datetime, timezone, timedelta
from functools import wraps

jwt = JWTManager()
mongo_client = None
db = None
socketio = SocketIO()
pool = eventlet.GreenPool()

user_sessions = {}
company_rooms = {}

def create_app(config_name='default'):
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    config[config_name].init_app(app)

    jwt.init_app(app)
    socketio.init_app(app, cors_allowed_origins="*", transports=["websocket"])

    @socketio.event
    def connect():
        sid = request.sid
        print(f"Client connected: {sid}")

    @socketio.event
    def subscribe_vehicle_updates(data):
        """
        Subscribe a client to live updates for a specific vehicle.
        Expected data: {LicensePlateNumber: string}
        """
        try:
            sid = request.sid
            license_plate_number = data.get('LicensePlateNumber')

            if not license_plate_number:
                socketio.emit('subscription_error', {'status': 'error', 'message': 'LicensePlateNumber is required'}, room=sid)
                return

            join_room(f"vehicle_{license_plate_number}")
            print(f"Client {sid} subscribed to updates for vehicle LicensePlateNumber {license_plate_number}")
            socketio.emit('subscription_success', {'status': 'success', 'LicensePlateNumber': license_plate_number}, room=sid)
        except Exception as e:
            print(f"Error subscribing to vehicle updates: {e}")
            socketio.emit('subscription_error', {'status': 'error', 'message': str(e)}, room=sid)

    @socketio.on('vehicle_live_update')
    def emit_vehicle_update(vehicle_data):
        """
        Emit new data for a specific vehicle to its subscribed clients.
        """
        try:
            license_plate_number = vehicle_data.get('LicensePlateNumber')
            if license_plate_number:
                socketio.emit('vehicle_live_update', vehicle_data, room=f"vehicle_{license_plate_number}")
                print(f"Emitted live update for vehicle LicensePlateNumber {license_plate_number}")
        except Exception as e:
            print(f"Error emitting vehicle live update: {e}")

    @socketio.event
    def authenticate(data):
        """
        Handle user authentication and room assignment
        Expected data: {user_id: string, company: string or null}
        """
        try:
            sid = request.sid
            user_id = data.get('user_id')
            company = data.get('company')
            userRole = data.get('userRole')
            userName = data.get('userName')    
            
            user = db['users'].find_one({"_id": ObjectId(user_id)})

            if not user:
                flash("Invalid user", "danger")
                socketio.emit('authentication_error', {'status': 'error', 'message': f'Invalid user {user_id}'}, room=sid)
                return
            
            if user['username'] != userName:
                flash("Invalid username", "danger")
                socketio.emit('authentication_error', {'status': 'error', 'message': f'Invalid username {userName}'}, room=sid)
                return
            
            if user['role'] != userRole:
                flash("Invalid user role", "danger")
                socketio.emit('authentication_error', {'status': 'error', 'message': f'Invalid user role {userRole}'}, room=sid)
                return
            
            if user['company'] != 'none':
                company_db = db['customers_list'].find_one({"Company Name": company})
                if not company_db:
                    flash("Invalid company", "danger")
                    socketio.emit('authentication_error', {'status': 'error', 'message': f'Invalid company {company}'}, room=sid)
                    return
                
                if str(company_db['_id']) != user['company']:
                    flash("User does not belong to this company", "danger")
                    socketio.emit('authentication_error', {'status': 'error', 'message': f'User does not belong to this company {company}'}, room=sid)
                    return
                
            if userRole in ['user']:
                assignedVehicles = list(db['vehicle_inventory'].find({"AssignedUsers": ObjectId(user_id)}, {"LicensePlateNumber": 1, "_id": 0}))
                if assignedVehicles:
                    assignedVehiclesList = [vehicle['LicensePlateNumber'] for vehicle in assignedVehicles]
                    join_room(f"user_{user_id}")
                    user_sessions[sid] = {
                        'user_id': user_id,
                        'company': company,
                        'userRole': userRole,
                        'userName': userName,
                        'assignedVehicles': assignedVehiclesList,
                    }
                    socketio.emit('authentication_success', {'status': 'success'}, room=sid)
                else:
                    flash("No vehicles assigned to this user", "warning")
                    socketio.emit('authentication_error', {'status': 'error', 'message': 'No vehicles assigned to this user'}, room=sid)
                    return
            else:     
                if company not in (None, '', 'none'):
                    company = company.strip().lower()
                    if company not in company_rooms:
                        company_rooms[company] = []
                    company_rooms[company].append(sid)
                    join_room(f"company_{company}")
                else:
                    join_room("all_data")

                print(f"User {user_id} authenticated with company {company}")
                print(company_rooms)
                print("SID: ",sid)
                socketio.emit('authentication_success', {'status': 'success'}, room=sid)

                user_sessions[sid] = {
                    'user_id': user_id,
                    'company': company,
                    'userRole': userRole,
                    'userName': userName,
                }
            
        except Exception as e:
            print(f"Authentication error: {e}")
            socketio.emit('authentication_error', {'status': 'error', 'message': str(e)}, room=sid)

    @socketio.event
    def get_rooms():
        try:
            sid = request.sid
            current_rooms = rooms()
            socketio.emit('rooms_list', {'rooms': list(current_rooms)}, room=sid)
        except Exception as e:
            print(f"Error fetching rooms for SID {sid}: {e}")
            socketio.emit('rooms_list', {'error': str(e)}, room=sid)

    @socketio.event
    def disconnect():
        sid = request.sid
        if sid in user_sessions:
            user_data = user_sessions[sid]
            company = user_data.get('company')

            if company and company in company_rooms and sid in company_rooms[company]:
                company_rooms[company].remove(sid)
                if not company_rooms[company]:  
                    del company_rooms[company]

            del user_sessions[sid]

        print(f"Client disconnected: {sid}")

    @socketio.on('vehicle_update')
    def handle_vehicle_update(vehicle_data):
            try:
                imei = vehicle_data.get('imei')
                vehicle_info = vehicle_inventory_collection.find_one({"IMEI": imei})
                
                assignedUsers = vehicle_info.get('AssignedUsers', []) if vehicle_info else []
                company = vehicle_info.get('CompanyName') if vehicle_info else None
                
                if assignedUsers:
                    for user_session in user_sessions.values():
                        if user_session['userRole'] == 'user' and user_session['user_id'] in assignedUsers:
                            socketio.emit('vehicle_update', vehicle_data, room=f"user_{user_session['user_id']}")
                            print(f"Emitted {user_session['user_id']} data for IMEI {vehicle_data['imei']}")

                if company:
                    company = company.strip().lower()
                    if  company in company_rooms:
                        print(f"Emitted {company} data for IMEI {vehicle_data['imei']}")
                        socketio.emit('vehicle_update', vehicle_data, room=f"company_{company}")

                socketio.emit('vehicle_update', vehicle_data, room="all_data")
                print(f"Emitted admin data for IMEI {vehicle_data['imei']}")

            except Exception as e:
                print(f"Error broadcasting vehicle data: {e}")

    @socketio.on('sos_alert')
    def handle_sos_alert(sos_data):
        try:
            imei = sos_data.get('imei')
            vehicle_info = vehicle_inventory_collection.find_one({"imei": imei})

            company = vehicle_info.get('CompanyName') if vehicle_info else None

            if company:
                socketio.emit('sos_alert', sos_data, room=f"company_{company}")

            socketio.emit('sos_alert', sos_data, room="all_data")

        except Exception as e:
            print(f"Error broadcasting SOS alert: {e}")

    global mongo_client, db
    mongo_client = MongoClient(app.config['MONGO_URI'], tz_aware=True)
    db = mongo_client["nnx"]
    vehicle_inventory_collection = db['vehicle_inventory']

    @app.context_processor
    def inject_csrf_token():
        try:
            verify_jwt_in_request(optional=True)
            jwt_data = get_jwt()
            return dict(csrf_token=jwt_data.get("csrf"))
        except:
            return dict(csrf_token=None)
        
    @app.context_processor
    def inject_user():
        try:
            from app.models import User
            verify_jwt_in_request(optional=True)
            current_user = get_jwt_identity()
            claims = get_jwt()
            user_id = claims['user_id']
            user = User.get_user_by_id(user_id)
            
            user_config = db['userConfig'].find_one({"userID": ObjectId(user_id)})
            dark_mode_value = user_config.get("darkMode") if user_config and user_config.get("darkMode") else "false"
            alert_Sound = user_config.get("alertSound") if user_config and user_config.get("alertSound") else "true"
            
            print(f"User ID: {user['company']}")
            if user['company'] != 'none':
                company = User.get_company_by_company_id(user['company'])
            else:
                company = None
            print(f"Company: {company}")
            return {
                'user_id': str(user_id),
                'username': str(current_user),
                'role': str(user['role']),
                'company_id': str(user['company']),
                'company': str(company),
                'dark_mode': dark_mode_value,
                'alert_sound': alert_Sound,
            }
        except Exception:
            return {
                'username': 'Guest',
                'role': 'N/A',
                'company_id': 'N/A',
                'company': 'N/A',
                'dark_mode': 'false',
                'alert_sound': 'true',
            }
    
    @jwt.expired_token_loader
    def handle_expired_token(jwt_header, jwt_payload):
        """Handle requests with expired JWTs."""
        if request.endpoint not in ['auth.logout', 'static', None]:
            flash("Your session has expired. Please log in again.", "warning")
            return redirect(url_for('auth.logout'))

    @app.before_request
    def refresh_token_if_needed():
        print(f"Request endpoint: {request.endpoint}")
        if request.endpoint not in ['login','auth.api_login', 'auth.login', 'auth.logout', 'static', 'main.home', None]:
            try:
                verify_jwt_in_request(optional=True)
                claims = get_jwt()

                if claims:
                    exp_timestamp = claims["exp"]
                    now = datetime.now(timezone.utc)
                    target_timestamp = datetime.timestamp(now + timedelta(days = 1))
                    if exp_timestamp < target_timestamp:
                        current_user = get_jwt_identity()
                        additional_claims = {
                            'roles': claims.get('roles', []),
                            'company': claims.get('company'),
                            'user_id': claims.get('user_id'),
                        }
                        new_access_token = create_access_token(
                            identity=current_user,
                            additional_claims=additional_claims
                        )
                        g.new_access_token = new_access_token
                else:
                    raise NoAuthorizationError("No JWT claims found")
            except NoAuthorizationError:
                return redirect(url_for('auth.logout'))
            except JWTDecodeError:
                flash('Your session has expired. Please log in again.', 'warning')
                return redirect(url_for('auth.logout'))
            except Exception:
                pass

    @app.after_request
    def afterRequest(response):
        try:
            if hasattr(g, 'new_access_token'):
                set_access_cookies(response, g.new_access_token)
        except Exception as e:
            print(f"Error setting refreshed token: {e}")
        
        if request.endpoint not in ['login','auth.api_login', 'auth.login', 'auth.logout', 'static', None]:
            try:
                verify_jwt_in_request(optional=True)
                claims = get_jwt()
                user_id = claims.get('user_id')
                user_config = db['userConfig'].find_one({"userID": ObjectId(user_id)})
                dark_mode_value = "true" if user_config and user_config.get("darkMode") == "true" else "false"
                expires = datetime.now() + timedelta(days=3650)
                response.set_cookie("darkMode", dark_mode_value, expires=expires, path="/")
                
            except Exception as e:
                print(f"Error retrieving user config: {e}")    
        
        return response
        
    
    from .auth import auth_bp
    from .routes import main_bp
    from .geocoding import gecoding_bp

    from app.Vehicle.VehicleBackend import vehicle_bp
    from app.Dashboard.DashboardBackend import dashboard_bp
    from app.CompanyDetails.companyBackend import company_bp
    from app.DeviceInvy.DeviceBackend import device_bp
    from app.Reports.allReports import reports_bp
    from app.RouteHistory.routeBackend import route_bp
    from app.SimInvy.SimBackend import sim_bp
    from app.VehicleDetails.vehicleDetails import vehicleDetails_bp
    from app.Alerts.alerts import alerts_bp
    from app.VehiclesAssign.vehicleAssign import vehicleAssign_bp
    from app.Vehicle.share_location import share_location_bp
    from app.userConfig.userConfig import userConfigBlueprint
    from app.companyConfig.companyConfig import companyConfig_bp
    from app.MapZoomIn.mapZoomIn import mapZoomIn_bp

    app.register_blueprint(vehicle_bp, url_prefix='/vehicle')
    app.register_blueprint(dashboard_bp, url_prefix='/dashboard')
    app.register_blueprint(company_bp, url_prefix='/companyDetails')
    app.register_blueprint(device_bp, url_prefix='/deviceInvy')
    app.register_blueprint(reports_bp, url_prefix='/reports')
    app.register_blueprint(route_bp, url_prefix='/routeHistory')
    app.register_blueprint(sim_bp, url_prefix='/simInvy')
    app.register_blueprint(vehicleDetails_bp, url_prefix='/vehicleDetails')
    app.register_blueprint(alerts_bp, url_prefix='/alerts')
    app.register_blueprint(vehicleAssign_bp, url_prefix='/vehicleAssign')
    app.register_blueprint(share_location_bp, url_prefix='/shareLocation')
    app.register_blueprint(userConfigBlueprint, url_prefix='/userConfig')
    app.register_blueprint(companyConfig_bp, url_prefix='/companyConfig')
    app.register_blueprint(mapZoomIn_bp, url_prefix='/mapZoomIn')

    app.register_blueprint(auth_bp)
    app.register_blueprint(main_bp)
    app.register_blueprint(gecoding_bp)
    
    return app