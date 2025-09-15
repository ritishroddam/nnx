from flask import Blueprint, render_template, redirect, url_for, request, flash, jsonify
from flask_jwt_extended import (
    get_csrf_token, get_jwt, verify_jwt_in_request, create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity, set_access_cookies, unset_jwt_cookies,
    set_refresh_cookies, unset_refresh_cookies, decode_token
)
from flask_jwt_extended.exceptions import NoAuthorizationError, JWTDecodeError
from .models import User
from .utils import roles_required
from app import db
from datetime import datetime, timezone, timedelta
import requests
from app.userConfig.userConfig import userConfiCollection
from bson import ObjectId

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    try:
        verify_jwt_in_request(optional=True)
        current_user = get_jwt_identity()
        if current_user:
            return redirect(url_for('Vehicle.map'))
    except NoAuthorizationError:
        response = redirect(url_for('auth.login'))
        unset_jwt_cookies(response)
        unset_refresh_cookies(response)
        flash('Your session has expired. Please log in again.', 'warning')
        return response
    except JWTDecodeError:
        response = redirect(url_for('auth.login'))
        unset_jwt_cookies(response)
        unset_refresh_cookies(response)
        flash('Invalid session. Please log in again.', 'danger')
        return response
    except NoAuthorizationError:
        pass

    if request.method == 'GET':
        return render_template('login.html')
    else:
        username = request.form.get('username')
        password = request.form.get('password')

        if not username or not password:
            flash('Username and password are required', 'danger')
            return redirect(url_for('auth.login'))

        user = User.find_by_username(username)
        
        if not user:
            flash('Inavlid Username', 'danger')
            return redirect(url_for('auth.login'))

        if user['disabled'] == 1:
            flash('Your account has been disabled. Please contact the administrator.', 'danger')
            return redirect(url_for('auth.login'))
        
        if not User.verify_password(user, password):
            flash('Incorrect Password', 'danger')
            return redirect(url_for('auth.login'))
        
        user_config = userConfiCollection.find_one({"userID": user['_id']})
        dark_mode_value = "false"
        if user_config and user_config.get("darkMode") == "true":
            dark_mode_value = "true"
        
        if user['company'] != 'none':
            company = User.get_company_by_company_id(user['company'])
            print(f"Company: {company}")
        else:
            company = None

        additional_claims = {
            'username': username,
            'user_id': str(user['_id']),
            'roles': str([user['role']]),
            'company_id': str(user['company']),
            'company': str(company),
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

        if user['role'] == 'sim':
            response = redirect(url_for('SimInvy.page'))
        elif user['role'] == 'device':
            response = redirect(url_for('DeviceInvy.page'))
        elif user['role'] == 'vehicle':
            response = redirect(url_for('VehicleInvy.page'))
        else:
            response = redirect(url_for('MapZoomIn.home'))

        set_access_cookies(response, access_token, max_age=access_token_max_age)
        set_refresh_cookies(response, refresh_token, max_age=refresh_token_max_age)
        
        expires = datetime.now() + timedelta(days=3650)
        response.set_cookie("darkMode", dark_mode_value, expires=expires, path="/")
        return response

@auth_bp.route('/api/login', methods=['POST'])
def api_login():
    """Pure API endpoint for programmatic access"""
    username = request.json.get('username') 
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
        'refresh_token': refresh_token,
        'csrf_access_token': get_csrf_token(access_token),
        'csrf_refresh_token': get_csrf_token(refresh_token)
    })

@auth_bp.route('/api/refresh', methods=['POST'])
@jwt_required(refresh=True)
def api_refresh():
    """Refresh access token endpoint"""
    current_user = get_jwt_identity()
    claims = get_jwt()
    
    additional_claims = {
        'roles': claims.get('roles', []),
        'company': claims.get('company'),
        'user_id': claims.get('user_id'),
    }
    
    access_token = create_access_token(
        identity=current_user,
        additional_claims=additional_claims
    )

    print(f"Access Token: {access_token}")
    

    return jsonify(access_token=access_token)

@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """Refresh access token endpoint"""
    try:
        current_user = get_jwt_identity()
        claims = get_jwt()

        exp_timestamp = claims["exp"]
        now = datetime.now(timezone.utc)
        target_timestamp = datetime.timestamp(now + timedelta(days = 1))

        if exp_timestamp < target_timestamp:
            additional_claims = {
                'roles': claims.get('roles', []),
                'company': claims.get('company'),
                'user_id': claims.get('user_id'),
            }
            access_token = create_access_token(
                identity=current_user,
                additional_claims=additional_claims
            )
            print(f"Access Token: {access_token}")
            response = jsonify({'refresh': True})
            set_access_cookies(response, access_token)
            print(f"Response headers: {response.headers}") 
            return response
        else:
            return jsonify({'message': 'Token is still valid'}), 304
    except NoAuthorizationError:
        flash('You are not authorized to access this resource. Please log in', 'danger')
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

# @auth_bp.route('/register', methods=['GET', 'POST'])
# @roles_required('admin', 'clientAdmin')
# def register():
#     if request.method == 'POST':
#         username = request.form.get('username')
#         email = request.form.get('email')
#         password = request.form.get('password')
#         company = request.form.get('company')
        
#         if User.find_by_username(username):
#             flash('Username already taken', 'danger')
#             return redirect(url_for('auth.register'))
        
#         if User.find_by_email(email):
#             flash('Email already registered', 'danger')
#             return redirect(url_for('auth.register'))
        
#         User.create_user(username, email, password, company, role = 'user', disabled=0)
#         flash('Registration successful. Please login.', 'success')
#         return redirect(request.referrer or url_for('auth.login'))

#     claims = get_jwt()
#     user_role = claims.get('roles', [])  
#     print(f"User Role: {user_role}")
#     if 'admin' in user_role:
#         companies = db.customers_list.find()
#         return render_template('register.html', companies=companies)
#     elif 'clientAdmin' in user_role:
#         return render_template('register.html')
#     else:
#         flash('Unauthorized access', 'danger')
#         return redirect(url_for('auth.unauthorized'))

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
        
        User.create_user(username, email, password, company, role = 'user', disabled=0)
        flash('Registration successful. Please login.', 'success')
        return redirect(request.referrer or url_for('auth.login'))

    claims = get_jwt()
    user_role = claims.get('roles', [])  
    print(f"User Role: {user_role}")
    
    # Fetch existing users with role 'user' for display in table
    existing_users = []
    if 'admin' in user_role:
        companies = db.customers_list.find()
        # Get all users with role 'user'
        for user in db.users.find({"role": "user"}):
            # Get company name
            company_name = "Unknown Company"
            company_id = user.get("company", "")
            
            if company_id and company_id != "none":
                try:
                    company = db.customers_list.find_one({"_id": ObjectId(user.get("company", ""))})
                    company_name = company["Company Name"] if company else "Unknown Company"
                except:
                    company_name = "Invalid Company ID"
            
            existing_users.append({
                "_id": user["_id"],
                "username": user["username"],
                "email": user["email"],
                "company_name": company_name,
                "disabled": user.get("disabled", 0)
            })
        
        return render_template('register.html', companies=companies, existing_users=existing_users, role='admin')
    elif 'clientAdmin' in user_role:
        # For clientAdmin, only show users from their company
        company_id = claims.get('company_id', '')
        existing_users = []
        
        if company_id and company_id != "none":
            for user in db.users.find({"role": "user", "company": company_id}):
                # Get company name
                company_name = "Unknown Company"
                try:
                    company = db.customers_list.find_one({"_id": ObjectId(company_id)})
                    company_name = company["Company Name"] if company else "Unknown Company"
                except:
                    company_name = "Invalid Company ID"
                
                existing_users.append({
                    "_id": user["_id"],
                    "username": user["username"],
                    "email": user["email"],
                    "company_name": company_name,
                    "disabled": user.get("disabled", 0)
                })
        
        return render_template('register.html', existing_users=existing_users, role='clientAdmin')
    else:
        flash('Unauthorized access', 'danger')
        return redirect(url_for('auth.unauthorized'))
    

# Add these new API endpoints for edit and delete operations
@auth_bp.route('/api/user/<user_id>', methods=['GET', 'PUT', 'DELETE'])
@jwt_required()
@roles_required('admin', 'clientAdmin')
def user_operations(user_id):
    try:
        claims = get_jwt()
        user_role = claims.get('roles', [])
        user_company_id = claims.get('company_id', '')
        
        # Check if user exists
        user = db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            return jsonify({"success": False, "error": "User not found"}), 404
        
        # For clientAdmin, ensure they can only modify users from their company
        if 'clientAdmin' in user_role and user.get('company') != user_company_id:
            return jsonify({"success": False, "error": "Unauthorized access"}), 403
        
        if request.method == 'GET':
            # Get user details for editing
            company_name = "Unknown Company"
            company_id = user.get("company", "")
            
            if company_id and company_id != "none":
                try:
                    company = db.customers_list.find_one({"_id": ObjectId(user.get("company", ""))})
                    company_name = company["Company Name"] if company else "Unknown Company"
                except:
                    company_name = "Invalid Company ID"
            
            return jsonify({
                "success": True,
                "user": {
                    "_id": str(user["_id"]),
                    "username": user["username"],
                    "email": user["email"],
                    "company_id": user.get("company", ""),
                    "company_name": company_name,
                    "disabled": user.get("disabled", 0)
                }
            })
            
        elif request.method == 'PUT':
            # Update user details
            data = request.json
            update_data = {}
            
            if 'username' in data:
                # Check if username is already taken by another user
                existing_user = db.users.find_one({"username": data['username'], "_id": {"$ne": ObjectId(user_id)}})
                if existing_user:
                    return jsonify({"success": False, "error": "Username already taken"}), 400
                update_data['username'] = data['username']
            
            if 'email' in data:
                # Check if email is already registered by another user
                existing_email = db.users.find_one({"email": data['email'], "_id": {"$ne": ObjectId(user_id)}})
                if existing_email:
                    return jsonify({"success": False, "error": "Email already registered"}), 400
                update_data['email'] = data['email']
            
            if 'company' in data and 'admin' in user_role:
                update_data['company'] = data['company']
            
            if 'password' in data and data['password']:
                # Hash the new password
                hashed_password = generate_password_hash(data['password'])
                update_data['password'] = hashed_password
            
            db.users.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": update_data}
            )
            
            return jsonify({"success": True, "message": "User updated successfully"})
            
        elif request.method == 'DELETE':
            # Delete user
            db.users.delete_one({"_id": ObjectId(user_id)})
            return jsonify({"success": True, "message": "User deleted successfully"})
            
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# @auth_bp.route('/register-client-admin', methods=['GET', 'POST'])
# @jwt_required()
# @roles_required('admin')
# def register_client_admin():
    
#     if request.method == 'POST':
#         username = request.form.get('username')
#         email = request.form.get('email')
#         password = request.form.get('password')
#         company = request.form.get('company')

#         if not all([username, email, password, company]):
#             flash('All fields are required', 'danger')
#             return redirect(url_for('auth.register_client_admin'))

#         if User.find_by_username(username):
#             flash('Username already exists', 'danger')
#             return redirect(url_for('auth.register_client_admin'))
            
#         if User.find_by_email(email):
#             flash('Email already registered', 'danger')
#             return redirect(url_for('auth.register_client_admin'))
        
#         User.create_user(username, email, password, company, role='clientAdmin')
#         flash('Admin registration successful. Please login.', 'success')
#         return redirect(request.referrer or url_for('auth.login'))

#     companies = db.customers_list.find()
    
#     return render_template('register_client_admin.html', companies=companies)

@auth_bp.route('/register-client-admin', methods=['GET', 'POST'])
@jwt_required()
@roles_required('admin')
def register_client_admin():
    # Get all client admins for display
    client_admins = []
    for user in db.users.find({"role": "clientAdmin"}):
        # Get company name
        company_name = "Unknown Company"
        company_id = user.get("company", "")
        
        if company_id and company_id != "none":
            try:
                company = db.customers_list.find_one({"_id": ObjectId(user.get("company", ""))})
                company_name = company["Company Name"] if company else "Unknown Company"
            except:
                company_name = "Invalid Company ID"
        
        client_admins.append({
            "_id": user["_id"],
            "username": user["username"],
            "email": user["email"],
            "company_name": company_name,
            "disabled": user.get("disabled", 0)
        })
    
    if request.method == 'POST':
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
        
        User.create_user(username, email, password, company, role='clientAdmin', disabled=0)
        flash('Admin registration successful. Please login.', 'success')
        return redirect(request.referrer or url_for('auth.login'))

    companies = db.customers_list.find()
    
    return render_template('register_client_admin.html', 
                          companies=companies, 
                          client_admins=client_admins)
    
@auth_bp.route('/api/client-admin/<user_id>/toggle-disable', methods=['POST'])
@jwt_required()
@roles_required('admin')
def toggle_disable_client_admin(user_id):
    try:
        user = db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            return jsonify({"success": False, "error": "User not found"}), 404
            
        # Toggle disabled status (0 = active, 1 = disabled)
        new_disabled_status = 1 if user.get('disabled', 0) == 0 else 0
        
        db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"disabled": new_disabled_status}}
        )
        
        return jsonify({
            "success": True, 
            "disabled": new_disabled_status == 1,
            "message": "User status updated successfully"
        })
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500   

@auth_bp.route('/register-admin', methods=['GET', 'POST'])
def register_admin():
    secret_key = "your-special-admin-key" 
    
    if request.method == 'POST':
        if request.form.get('secret_key') != secret_key:
            flash('Invalid admin registration key', 'danger')
            return redirect(url_for('auth.register_admin'))
        
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
        
        User.create_user(username, email, password, role='admin', disabled=0)
        flash('Admin registration successful. Please login.', 'success')
        return redirect(url_for('auth.login'))
    
    return render_template('register_admin.html') 

# @auth_bp.route('/register-inventory', methods=['GET', 'POST'])
# @roles_required('admin')
# def register_inventory():
#     if request.method == 'POST':
#         username = request.form.get('username')
#         email = request.form.get('email')
#         password = request.form.get('password')
#         role = request.form.get('role')

#         existing_user = User.find_by_username(username)
#         existing_email = User.find_by_email(email)

#         if existing_user:
#             flash('Username already exists', 'danger')
#             return redirect(url_for('auth.register_client_admin'))
            
#         if existing_email:
#             flash('Email already registered', 'danger')
#             return redirect(url_for('auth.register_client_admin'))
        
#         User.create_user(username, email, password, "none", role, disabled=0)
#         flash('Admin registration successful. Please login.', 'success')
#         return redirect(request.referrer or url_for('auth.login'))
    
#     return render_template('register_inventory.html') 

@auth_bp.route('/register-inventory', methods=['GET', 'POST'])
@roles_required('admin')
def register_inventory():
    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')
        role = request.form.get('role')

        existing_user = User.find_by_username(username)
        existing_email = User.find_by_email(email)

        if existing_user:
            flash('Username already exists', 'danger')
            return redirect(url_for('auth.register_inventory'))  # Fixed redirect
            
        if existing_email:
            flash('Email already registered', 'danger')
            return redirect(url_for('auth.register_inventory'))  # Fixed redirect
        
        User.create_user(username, email, password, "none", role)
        flash('Inventory user registration successful.', 'success')
        return redirect(url_for('auth.register_inventory'))
    
    # Query each role separately and convert cursors to lists
    device_users = list(User.find_by_role('device')) if hasattr(User, 'find_by_role') else []
    sim_users = list(User.find_by_role('sim')) if hasattr(User, 'find_by_role') else []
    vehicle_users = list(User.find_by_role('vehicle')) if hasattr(User, 'find_by_role') else []
    
    # Combine all inventory users
    inventory_users = device_users + sim_users + vehicle_users
    
    return render_template('register_inventory.html', inventory_users=inventory_users)

@auth_bp.route('/update-user-status/<user_id>', methods=['POST'])
@roles_required('admin')
def update_user_status(user_id):
    try:
        data = request.get_json()
        disabled = data.get('disabled', 0)
        
        status = User.disable_user_by_id(user_id, disabled)
            
        if status.matched_count == 0:
            return jsonify({'success': False, 'error': 'User not found'}), 404
        elif status.modified_count == 0:
            return jsonify({'success': False, 'error': 'Account state was not changed'}), 500
                
        return jsonify({'success': True}), 200

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@auth_bp.route('/logout', methods=['POST', 'GET'])
def logout():
    try:
        verify_jwt_in_request()
    except:
        pass  

    response = redirect(url_for('auth.login'))
    unset_jwt_cookies(response)
    unset_refresh_cookies(response)

    flash('You have been logged out', 'info')
    return response

@auth_bp.route('/unauthorized')
def unauthorized():
    flash('To access this page please login or login with an account that has access to the page', 'danger')
    return render_template('login.html'), 403