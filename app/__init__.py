from flask import Flask, redirect, url_for, flash, jsonify, request
from flask_jwt_extended import JWTManager, get_jwt, get_jwt_identity, verify_jwt_in_request, create_access_token, set_access_cookies
from pymongo import MongoClient
from config import config
from flask_socketio import SocketIO
import subprocess
import os
import eventlet
import signal
from datetime import datetime, timezone, timedelta
from functools import wraps

jwt = JWTManager()
mongo_client = None
db = None
socketio = SocketIO()
pool = eventlet.GreenPool()

# This decorator is used to check if token needs to be refreshed
def check_token_freshness():
    def wrapper(fn):
        @wraps(fn)
        def decorator(*args, **kwargs):
            try:
                verify_jwt_in_request(optional=True)
                claims = get_jwt()
                if claims:
                    # Check if token is about to expire (less than 12 hours left)
                    exp_timestamp = claims["exp"]
                    now = datetime.now(timezone.utc)
                    target_timestamp = datetime.timestamp(now + timedelta(seconds=30))
                    
                    # If token is about to expire and we're not already on the refresh page
                    if exp_timestamp < target_timestamp and request.endpoint != 'auth.refresh':
                        return redirect(url_for('auth.refresh'))
            except Exception as e:
                # Token verification failed, continue with the original function
                pass
            
            return fn(*args, **kwargs)
        return decorator
    return wrapper

def create_app(config_name='default'):
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    config[config_name].init_app(app)

    jwt.init_app(app)
    socketio.init_app(app, cors_allowed_origins="*", transports=["websocket"])

    @socketio.on('connect')
    def connect():
        print(f"Client connected")

    @socketio.on('disconnect')
    def disconnect():
        print(f"Client disconnected")
    
    global mongo_client, db
    mongo_client = MongoClient(app.config['MONGO_URI'])
    db = mongo_client["nnx"]
    
    # Apply token freshness check to all routes
    @app.before_request
    def before_request_func():
        # Only check token freshness for non-refresh endpoints
        if request.endpoint != 'auth.refresh':
            try:
                verify_jwt_in_request(optional=True)
                claims = get_jwt()
                if claims:
                    # Check if token is about to expire (less than 12 hours left)
                    exp_timestamp = claims.get("exp")
                    if exp_timestamp:
                        now = datetime.now(timezone.utc)
                        target_timestamp = datetime.timestamp(now + timedelta(seconds=30))
                        
                        # If token is about to expire
                        if exp_timestamp < target_timestamp:
                            return redirect(url_for('auth.refresh'))
            except Exception as e:
                # Token verification failed, continue with the request
                pass
    
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
            print(f"User ID: {user['company']}")
            if user['company'] != 'none':
                company = User.get_company_by_company_id(user['company'])
            else:
                company = None
            print(f"Company: {company}")
            return {
                'username': current_user,
                'role': user['role'],
                'company_id': user['company'],
                'company': company
            }
        except Exception:
            return {
                'username': 'Guest',
                'role': 'N/A',
                'company_id': 'N/A',
                'company': 'N/A',
            }
        
    @jwt.unauthorized_loader
    def custom_unauthorized_response(callback):
        flash("You must log in to access this page.", "danger")
        return redirect(url_for('auth.login'))
    
    # Add token refresh handler
    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(jwt_header, jwt_payload):
        # You could implement token blocklist/revocation here if needed
        return False  # For now, no tokens are blocked
    
    # Handler for expired tokens - redirect to refresh
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        if jwt_payload.get('type') == 'refresh':
            flash("Your session has expired. Please log in again.", "warning")
            return redirect(url_for('auth.login'))
        else:
            return redirect(url_for('auth.refresh'))
    
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

    app.register_blueprint(vehicle_bp, url_prefix='/vehicle')
    app.register_blueprint(dashboard_bp, url_prefix='/dashboard')
    app.register_blueprint(company_bp, url_prefix='/companyDetails')
    app.register_blueprint(device_bp, url_prefix='/deviceInvy')
    app.register_blueprint(reports_bp, url_prefix='/reports')
    app.register_blueprint(route_bp, url_prefix='/routeHistory')
    app.register_blueprint(sim_bp, url_prefix='/simInvy')
    app.register_blueprint(vehicleDetails_bp, url_prefix='/vehicleDetails')
    app.register_blueprint(alerts_bp, url_prefix='/alerts')

    app.register_blueprint(auth_bp)
    app.register_blueprint(main_bp)
    app.register_blueprint(gecoding_bp)

    map_server_path = os.path.join(os.path.dirname(__file__), 'map_server.py')
    subprocess.Popen(['python', map_server_path])
    
    run_distinct_vehicle_data_store_path = os.path.join(os.path.dirname(__file__), 'distinctVehicleDataStore.py')
    subprocess.Popen(['python', run_distinct_vehicle_data_store_path])
    
    run_calculate_past_distances_path = os.path.join(os.path.dirname(__file__), 'calculate_past_distances.py')
    subprocess.Popen(['python', run_calculate_past_distances_path])
    
    return app