from flask import Flask, redirect, url_for, flash
from flask_jwt_extended import JWTManager, get_jwt, get_jwt_identity, verify_jwt_in_request
from pymongo import MongoClient
from config import config
from flask_socketio import SocketIO
import subprocess
import signal


jwt = JWTManager()
mongo_client = None
db = None
socketio = SocketIO()

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
    
    # Safe CSRF token injection
    @app.context_processor
    def inject_csrf_token():
        from flask_jwt_extended import verify_jwt_in_request
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
            return {
                'username': current_user,
                'role': user['role']
            }
        except Exception:
            # If no JWT or an error occurs, return default values
            return {
                'username': 'Guest',
                'role': 'N/A'
            }
        
    @jwt.unauthorized_loader
    def custom_unauthorized_response(callback):
        flash("You must log in to access this page.", "danger")
        return redirect(url_for('auth.login'))
    
    from .auth import auth_bp
    from .routes import main_bp

    from app.Vehicle.VehicleBackend import vehicle_bp
    from app.Dashboard.DashboardBackend import dashboard_bp
    from app.CompanyDetails.companyBackend import company_bp
    from app.DeviceInvy.DeviceBackend import device_bp
    from app.Reports.allReports import reports_bp
    from app.RouteHistory.routeBackend import route_bp
    from app.SimInvy.SimBackend import sim_bp
    from app.VehicleDetails.vehicleDetails import vehicleDetails_bp

    app.register_blueprint(vehicle_bp, url_prefix='/vehicle')
    app.register_blueprint(dashboard_bp, url_prefix='/dashboard')
    app.register_blueprint(company_bp, url_prefix='/companyDetails')
    app.register_blueprint(device_bp, url_prefix='/deviceInvy')
    app.register_blueprint(reports_bp, url_prefix='/reports')
    app.register_blueprint(route_bp, url_prefix='/routeHistory')
    app.register_blueprint(sim_bp, url_prefix='/simInvy')
    app.register_blueprint(vehicleDetails_bp, url_prefix='/vehicleDetails')


    app.register_blueprint(auth_bp)
    app.register_blueprint(main_bp)



    def start_background_task():
        from app.map_server import signal_handler

        # Start the distinct vehicle data store as a subprocess
        distinct_vehicle_process = subprocess.Popen(
            ["python", "-m", "app.distinctVehicleDataStore"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )

        # Start the map server as a subprocess
        map_server_process = subprocess.Popen(
            ["python", "-m", "app.map_server"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )

        # Start the past distance calculation as a subprocess
        past_distance_process = subprocess.Popen(
            ["python", "-m", "app.calculate_past_distances"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )

        # Register signal handlers to terminate subprocesses gracefully
        def terminate_subprocesses(signum, frame):
            distinct_vehicle_process.terminate()
            map_server_process.terminate()
            past_distance_process.terminate()
            signal_handler(signum, frame)

        signal.signal(signal.SIGINT, terminate_subprocesses)
        signal.signal(signal.SIGTERM, terminate_subprocesses)

    start_background_task()
    
    return app