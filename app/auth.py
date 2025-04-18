from flask import Blueprint, render_template, redirect, url_for, request, flash, jsonify
from flask_jwt_extended import (
    get_jwt, verify_jwt_in_request, create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity, set_access_cookies, unset_jwt_cookies,
    set_refresh_cookies, unset_refresh_cookies, decode_token
)
from flask_jwt_extended.exceptions import NoAuthorizationError, JWTDecodeError
from .models import User
from .utils import roles_required
from app import db
from datetime import datetime, timezone, timedelta
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
        
        if user['company'] != 'none':
            company = User.get_company_by_company_id(user['company']),
        else:
            company = None

        # Create both access and refresh tokens
        additional_claims = {
            'roles': [user['role']],
            'company': company,
            'user_id': str(user['_id']),
        }
        
        access_token = create_access_token(
            identity=username,
            additional_claims=additional_claims
        )
        refresh_token = create_refresh_token(
            identity=username,
            additional_claims=additional_claims
        )

        decoded_access_token = decode_token(access_token)
        decoded_refresh_token = decode_token(refresh_token)

        access_token_exp = decoded_access_token['exp']
        refresh_token_exp = decoded_refresh_token['exp']
        current_time = datetime.now(timezone.utc).timestamp()

        access_token_max_age = int(access_token_exp - current_time)
        refresh_token_max_age = int(refresh_token_exp - current_time)

        # Wrap the rendered template in a Response object
        response = redirect(url_for('auth.login'))
        set_access_cookies(response, access_token, max_age=access_token_max_age)
        set_refresh_cookies(response, refresh_token, max_age=refresh_token_max_age)

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
    
    if user['company'] != 'none':
        company = User.get_company_by_company_id(user['company']),
    else:
        company = None
    
    additional_claims = {
        'roles': [user['role']],
        'company': company,
        'user_id': str(user['_id']),
    }
    
    access_token = create_access_token(
        identity=username,
        additional_claims=additional_claims
    )
    refresh_token = create_refresh_token(
        identity=username,
        additional_claims=additional_claims
    )
    
    return jsonify({
        'access_token': access_token,
        'refresh_token': refresh_token
    })

@auth_bp.route('/api/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """Refresh access token endpoint"""
    current_user = get_jwt_identity()
    claims = get_jwt()
    
    # Extract the necessary claims from the refresh token
    additional_claims = {
        'roles': claims.get('roles', []),
        'company': claims.get('company'),
        'user_id': claims.get('user_id'),
    }
    
    # Create new access token
    access_token = create_access_token(
        identity=current_user,
        additional_claims=additional_claims
    )

    print(f"Access Token: {access_token}")
    

    return jsonify(access_token=access_token)

@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def api_refresh():
    """Refresh access token endpoint"""
    current_user = get_jwt_identity()
    claims = get_jwt()
    
    exp_timestamp = claims["exp"]
    now = datetime.now(timezone.utc)
    target_timestamp = datetime.timestamp(now + timedelta(seconds=30))

    if exp_timestamp < target_timestamp:
        try:
            additional_claims = {
                'roles': claims.get('roles', []),
                'company': claims.get('company'),
                'user_id': claims.get('user_id'),
            }

            # Create new access token
            access_token = create_access_token(
                identity=current_user,
                additional_claims=additional_claims
            )

            print(f"Access Token: {access_token}")

                # For web clients using cookies
            response = jsonify({'refresh': True})
            set_access_cookies(response, access_token)
            print(f"Response headers: {response.headers}") 
            return response
        except NoAuthorizationError:
            return redirect(url_for('auth.login'))
        except JWTDecodeError:
            response = redirect(url_for('auth.login'))
            unset_jwt_cookies(response)
            unset_refresh_cookies(response)
            flash('Your session has expired. Please log in again.', 'warning')
            return response
        except Exception:
            flash(f'An error occurred while refreshing the token:{Exception}', 'danger')
            return
    else:
        return jsonify({'message': 'Token is still valid'}), 200

@auth_bp.route('/register', methods=['GET', 'POST'])
@roles_required('admin', 'clientAdmin')
def register():
    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')
        company = request.form.get('company')
        
        if User.find_by_username(username):
            flash('Username already taken', 'danger')
            return redirect(url_for('auth.register'))
        
        if User.find_by_email(email):
            flash('Email already registered', 'danger')
            return redirect(url_for('auth.register'))
        
        User.create_user(username, email, password, company)
        flash('Registration successful. Please login.', 'success')
        return redirect(url_for('auth.login'))

    claims = get_jwt()
    user_role = claims.get('roles', [])[0]  # Assuming roles is a list and taking the first role

    if user_role == 'admin':
        companies = db.customers_list.find()
        return render_template('register_client_admin.html', companies=companies)
    elif user_role == 'clientAdmin':
        return render_template('register.html')
    else:
        flash('Unauthorized access', 'danger')
        return redirect(url_for('auth.unauthorized'))

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
    unset_refresh_cookies(response)
    flash('You have been logged out', 'info')
    return response

@auth_bp.route('/unauthorized')
def unauthorized():
    flash('To access this page please login', 'danger')
    return render_template('login.html'), 403