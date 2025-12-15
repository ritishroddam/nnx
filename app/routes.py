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