from pymongo import MongoClient
import gridfs
from bson.objectid import ObjectId


mongo_client = MongoClient("mongodb+srv://doadmin:4T81NSqj572g3o9f@db-mongodb-blr1-27716-c2bd0cae.mongo.ondigitalocean.com/admin?tls=true&authSource=admin", tz_aware=True)
db = mongo_client["nnx"]

companyLogoID = db['customers_list'].find_one(
        {"_id": ObjectId("67d00194391f8401d0ddf558")},
        {"companyLogo": 1}
    )

print(type(companyLogoID.get('companyLogo')))
