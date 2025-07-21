from pymongo import MongoClient
from config import config
from pymongo.collection import Collection

original_aggregate = Collection.aggregate

def patched_aggregate(self, pipeline, *args, **kwargs):
    kwargs['allowDiskUse'] = True  # Automatically enable allowDiskUse
    return original_aggregate(self, pipeline, *args, **kwargs)

Collection.aggregate = patched_aggregate

mongo_client = MongoClient(config['default'].MONGO_URI, tz_aware=True)
db = mongo_client["nnx"]