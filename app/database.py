from pymongo import MongoClient
from config import config
from pymongo.collection import Collection

def patched_aggregate(self, pipeline, *args, **kwargs):
    kwargs['allowDiskUse'] = True  # Automatically enable allowDiskUse
    return super(Collection, self).aggregate(pipeline, *args, **kwargs)

Collection.aggregate = patched_aggregate

mongo_client = MongoClient(config['default'].MONGO_URI, tz_aware=True)
db = mongo_client["nnx"]