from pymongo import MongoClient
from config import config

mongo_client = MongoClient(config['default'].MONGO_URI)
db = mongo_client["nnx"]