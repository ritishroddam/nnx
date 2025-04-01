from flask import Blueprint, render_template, redirect, url_for, request, flash
from flask_jwt_extended import verify_jwt_in_request, jwt_required, get_jwt_identity, get_jwt
from .models import User
from .utils import roles_required

main_bp = Blueprint('main', __name__)

@main_bp.route('/')
def home():
    try:
        verify_jwt_in_request()
        return redirect(url_for('Vehicle.map'))
    except:
        return redirect(url_for('auth.login'))

@main_bp.route('/registerAdmin')
def register_admin():
    return render_template('register_admin.html')


@main_bp.route('/dashboard')
@jwt_required()
def dashboard():
    current_user = get_jwt_identity()
    claims = get_jwt()
    user_id = claims['user_id']
    user = User.get_user_by_id(user_id)
    
    return render_template('dashboard.html', 
                         username=current_user, 
                         role=user['role'])

@main_bp.route('/admin')
@jwt_required()
@roles_required('admin')
def admin_dashboard():
    return "Admin Dashboard - Only accessible by admins"