from pymongo import MongoClient
from config import config

mongo_client = MongoClient(config['default'].MONGO_URI, tz_aware=True)
db = mongo_client["nnx"]