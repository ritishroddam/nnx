import os
from datetime import timedelta

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'your-secret-key-here'
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or 'jwt-secret-key-here'
    JWT_COOKIE_MAX_AGE = None
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=1)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(minutes=5) 
    JWT_TOKEN_LOCATION = ['cookies']
    JWT_COOKIE_SECURE = True
    JWT_COOKIE_CSRF_PROTECT = True
    JWT_SESSION_COOKIE = False
    JWT_CSRF_CHECK_FORM = True
    JWT_ACCESS_CSRF_HEADER_NAME = "X-CSRF-TOKEN"
    JWT_REFRESH_CSRF_HEADER_NAME = "X-CSRF-REFRESH-TOKEN"
    JWT_CSRF_IN_COOKIES = True
    JWT_REFRESH_CSRF_PROTECT = True    
    
    GMAPS_API_KEY = os.environ.get('GMAPS_API_KEY') or 'AIzaSyDEFA1-1dlca1C2BbUNKpQEf-icQAJAfX0'
    MONGO_URI = "mongodb+srv://doadmin:4T81NSqj572g3o9f@db-mongodb-blr1-27716-c2bd0cae.mongo.ondigitalocean.com/admin?tls=true&authSource=admin"
    
    @staticmethod
    def init_app(app):
        pass

class DevelopmentConfig(Config):
    DEBUG = True
    JWT_COOKIE_SECURE = True  # For development only

config = {
    'development': DevelopmentConfig,
    'default': DevelopmentConfig
}