from flask import Flask, redirect, url_for, flash, jsonify, request, g, render_template
from flask_jwt_extended import jwt_required,JWTManager, get_jwt, get_jwt_identity, verify_jwt_in_request, create_access_token, set_access_cookies, unset_jwt_cookies, unset_refresh_cookies
from flask_jwt_extended.exceptions import NoAuthorizationError, JWTDecodeError
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
                'user_id': str(user_id),
                'username': str(current_user),
                'role': str(user['role']),
                'company_id': str(user['company']),
                'company': str(company)
            }
        except Exception:
            return {
                'username': 'Guest',
                'role': 'N/A',
                'company_id': 'N/A',
                'company': 'N/A',
            }
    
    @jwt.expired_token_loader
    def handle_expired_token(jwt_header, jwt_payload):
        """Handle requests with expired JWTs."""
        if request.endpoint not in ['login', 'auth.login', 'auth.logout', 'static', None]:
            flash("Your session has expired. Please log in again.", "warning")
            return redirect(url_for('auth.logout'))

    @app.before_request
    def refresh_token_if_needed():

        print(request.endpoint)
        if request.endpoint not in ['login', 'auth.login', 'auth.logout', 'static', None]:
            try:
                verify_jwt_in_request(optional=True)
                claims = get_jwt()

                if claims:
                    # Check if the token is about to expire (e.g., within 30 seconds)
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
                        # Create a new access token
                        new_access_token = create_access_token(
                            identity=current_user,
                            additional_claims=additional_claims
                        )
                        # Set the new token in cookies
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
    def set_refreshed_token(response):
        try:
            if hasattr(g, 'new_access_token'):
                set_access_cookies(response, g.new_access_token)
        except Exception as e:
            print(f"Error setting refreshed token: {e}")
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