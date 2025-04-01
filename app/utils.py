from functools import wraps
from flask import jsonify, redirect, url_for, request, flash
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity, get_jwt

def roles_required(*required_roles):
    def wrapper(fn):
        @wraps(fn)
        def decorator(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            user_roles = claims.get('roles', [])
            
            # Check if any of the required roles are in the user's roles
            if not any(role in user_roles for role in required_roles):
                return redirect(url_for('auth.unauthorized'))
            
            return fn(*args, **kwargs)
        return decorator
    return wrapper

def admin_required(fn):
    return roles_required('admin')(fn)