from flask import Blueprint, render_template, redirect, url_for, request, flash, jsonify
from flask_jwt_extended import verify_jwt_in_request, create_access_token, jwt_required, get_jwt_identity, set_access_cookies, unset_jwt_cookies
from .models import User
from .utils import roles_required
import datetime

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    try:
        verify_jwt_in_request()
        return redirect(url_for('Vehicle.map'))
    except:
        pass

    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        user = User.find_by_username(username)
        if not user or not User.verify_password(user, password):
            flash('Invalid username or password', 'danger')
            return redirect(url_for('auth.login'))
        
        # Create the tokens we will be sending back to the user
        additional_claims = {
            'roles': [user['role']],
            'user_id': str(user['_id'])
        }
        access_token = create_access_token(
            identity=username,
            additional_claims=additional_claims
        )
        
        response = redirect(url_for('Vehicle.map'))
        set_access_cookies(response, access_token)
        return response
    
    return render_template('login.html')

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
        
        User.create_user(username, email, password, role='admin')
        flash('Admin registration successful. Please login.', 'success')
        return redirect(url_for('auth.login'))
    
    return render_template('register_admin.html')  # You'll need to create this template

@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    response = redirect(url_for('auth.login'))
    unset_jwt_cookies(response)
    flash('You have been logged out', 'info')
    return response

@auth_bp.route('/unauthorized')
def unauthorized():
    return render_template('unauthorized.html'), 403