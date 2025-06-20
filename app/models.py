from app import db
from bson.objectid import ObjectId
import bcrypt

class User:
    @staticmethod
    def create_user(username, email, password, company = 'none', role='user'):
        hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        return db.users.insert_one({
            'username': username,
            'email': email,
            'password': hashed,
            'company': company,
            'role': role
        })
    
    @staticmethod
    def find_by_username(username):
        return db.users.find_one({'username': username})
    
    @staticmethod
    def find_by_email(email):
        return db.users.find_one({'email': email})
    
    @staticmethod
    def verify_password(user, password):
        return bcrypt.checkpw(password.encode('utf-8'), user['password'])
    
    @staticmethod
    def get_user_by_id(user_id):
        return db.users.find_one({'_id': ObjectId(user_id)})
    
    @staticmethod
    def get_company_by_company_id(company_id):
        user = db.customers_list.find_one({'_id': ObjectId(company_id)})
        return user['Company Name'] if user else None
    
    @staticmethod
    def find_by_role(role):
        return db.users.find({"role": role})