import os
from datetime import timedelta

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'blVyRnvtvbfGle5hnZlpXRUbrt0wZYFWGqVEZpz6eomOvQRxRzEiScBuhSwiwl96dx4AqZejIRc2cGZGv3itklaCGxfJTaV9ybN0CzAXTbRwn2O4CTnMGMBirsmzk8vK'
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or '42eS1MRvewLSGjPx1ItPM0QFQsAdH2pj8Ij4CxHjNreVsZAG4OPQWIqmkqKSgKkwJ90XQYCCFnLu6pUWDaH5x1Z8sVl68D5xzAUqGTLhx0wwWrsyoAdL3BR8s5bMjie6'
    JWT_COOKIE_MAX_AGE = None
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days = 7)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days = 30) 
    JWT_TOKEN_LOCATION = ['cookies']
    JWT_COOKIE_SECURE = True
    JWT_COOKIE_CSRF_PROTECT = True
    JWT_SESSION_COOKIE = False
    JWT_CSRF_CHECK_FORM = True
    JWT_ACCESS_CSRF_HEADER_NAME = "X-CSRF-TOKEN"
    JWT_REFRESH_CSRF_HEADER_NAME = "X-CSRF-REFRESH-TOKEN"
    JWT_CSRF_IN_COOKIES = True
    JWT_REFRESH_CSRF_PROTECT = True
    JSON_SORT_KEYS = False
    
    GMAPS_API_KEY = os.environ.get('GMAPS_API_KEY') or 'AIzaSyCHlZGVWKK4ibhGfF__nv9B55VxCc-US84'
    MONGO_URI = "mongodb+srv://doadmin:U6bOV204y9r75Iz3@db-mongodb-blr1-96186-51f75312.mongo.ondigitalocean.com/admin?authSource=admin&tls=true"
    CELERY_BROKER_URL = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")
    CELERY_RESULT_BACKEND = os.environ.get("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")
    
    @staticmethod
    def init_app(app):
        pass

class DevelopmentConfig(Config):
    DEBUG = True
    JWT_COOKIE_SECURE = True  # For development only

config = {
    'development': DevelopmentConfig,
    'default': Config
}