from flask import Blueprint, render_template, redirect, url_for, request, flash, jsonify
from flask_jwt_extended import verify_jwt_in_request, create_access_token, jwt_required, get_jwt_identity, set_access_cookies, unset_jwt_cookies
from flask_jwt_extended.exceptions import NoAuthorizationError
from .models import User
from .utils import roles_required
from app import db
import datetime
import requests

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    # Check if already logged in (optional - remove if you want to force new login)
    try:
        verify_jwt_in_request(optional=True)
        current_user = get_jwt_identity()
        if current_user:
            return redirect(url_for('Vehicle.map'))
    except NoAuthorizationError:
        pass

    if request.method == 'POST':

        username = request.form.get('username')
        password = request.form.get('password')

        user = User.find_by_username(username)
        if not user or not User.verify_password(user, password):
            flash('Invalid username or password', 'danger')
            return redirect(url_for('auth.login'))
        
        # Create both access and refresh tokens
        additional_claims = {
            'roles': [user['role']],
            'user_id': str(user['_id'])
        }
        
        access_token = create_access_token(
            identity=username,
            additional_claims=additional_claims
        )
        # refresh_token = create_refresh_token(
        #     identity=username,
        #     additional_claims=additional_claims
        # )
        
        response = redirect(url_for('Vehicle.map'))
        set_access_cookies(response, access_token)
        # set_refresh_cookies(response, refresh_token)
        return response

    return render_template('login.html')

@auth_bp.route('/api/login', methods=['POST'])
def api_login():
    """Pure API endpoint for programmatic access"""
    username = request.json.get('username')  # Note: using .json instead of .form
    password = request.json.get('password')
    
    user = User.find_by_username(username)
    if not user or not User.verify_password(user, password):
        return jsonify({'error': 'Invalid username or password'}), 401
    
    additional_claims = {
        'roles': [user['role']],
        'user_id': str(user['_id'])
    }
    
    access_token = create_access_token(
        identity=username,
        additional_claims=additional_claims
    )
    # refresh_token = create_refresh_token(
    #     identity=username,
    #     additional_claims=additional_claims
    # )
    
    return jsonify({
        'access_token': access_token,
    })
        # 'refresh_token': refresh_token

@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')
        
        if password != confirm_password:
            flash('Passwords do not match', 'danger')
            return redirect(url_for('auth.register'))
        
        if User.find_by_username(username):
            flash('Username already taken', 'danger')
            return redirect(url_for('auth.register'))
        
        if User.find_by_email(email):
            flash('Email already registered', 'danger')
            return redirect(url_for('auth.register'))
        
        User.create_user(username, email, password)
        flash('Registration successful. Please login.', 'success')
        return redirect(url_for('auth.login'))
    
    return render_template('register.html')

@auth_bp.route('/register-client-admin', methods=['GET', 'POST'])
@jwt_required()
@roles_required('admin')
def register_client_admin():
    
    if request.method == 'POST':
        # Rest of registration logic similar to regular register
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')
        company = request.form.get('company')

        if not all([username, email, password, company]):
            flash('All fields are required', 'danger')
            return redirect(url_for('auth.register_client_admin'))

        if User.find_by_username(username):
            flash('Username already exists', 'danger')
            return redirect(url_for('auth.register_client_admin'))
            
        if User.find_by_email(email):
            flash('Email already registered', 'danger')
            return redirect(url_for('auth.register_client_admin'))

        from flask_jwt_extended import get_jwt
        claims = get_jwt()
        print(f"JWT Claims: {claims}") 
        
        User.create_user(username, email, password, company, role='clientAdmin')
        flash('Admin registration successful. Please login.', 'success')
        return redirect(url_for('auth.login'))

    companies = db.customers_list.find()
    
    return render_template('register_client_admin.html', companies=companies)

@auth_bp.route('/register-admin', methods=['GET', 'POST'])
def register_admin():
    secret_key = "your-special-admin-key"  # Change this to a secure value
    
    if request.method == 'POST':
        if request.form.get('secret_key') != secret_key:
            flash('Invalid admin registration key', 'danger')
            return redirect(url_for('auth.register_admin'))
        
        # Rest of registration logic similar to regular register
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')

        existing_user = User.find_by_username(username)
        existing_email = User.find_by_email(email)

        if existing_user:
            flash('Username already exists', 'danger')
            return redirect(url_for('auth.register_client_admin'))
            
        if existing_email:
            flash('Email already registered', 'danger')
            return redirect(url_for('auth.register_client_admin'))
        
        User.create_user(username, email, password, role='admin')
        flash('Admin registration successful. Please login.', 'success')
        return redirect(url_for('auth.login'))
    
    return render_template('register_admin.html')  # You'll need to create this template

@auth_bp.route('/logout', methods=['POST'])
def logout():
    try:
        verify_jwt_in_request()
    except:
        pass  # Still allow logout even if token is expired

    response = redirect(url_for('auth.login'))
    unset_jwt_cookies(response)
    flash('You have been logged out', 'info')
    return response

@auth_bp.route('/unauthorized')
def unauthorized():
    flash('To access this page please login', 'danger')
    return render_template('login.html'), 403