from pymongo import MongoClient

from pymongo import MongoClient
from config import config

mongo_client = MongoClient("mongodb+srv://doadmin:4T81NSqj572g3o9f@db-mongodb-blr1-27716-c2bd0cae.mongo.ondigitalocean.com/admin?tls=true&authSource=admin", tz_aware=True)
db = mongo_client["nnx"]

atlanta_collection = db["atlanta"]
atlantaLatestCollection = db["atlantaLatest"]
collection = db['distinctAtlanta']
distance_travelled_collection = db['distanceTravelled']
vehicle_inventory = db["vehicle_inventory"]
atlantaAis140Collection = db["atlantaAis140"]
atlantaAis140LatestCollection = db["atlantaAis140_latest"]

def getCollectionImeis(vehicleInvyImeis=None):
    atlantaImeis = db['atlanta'].distinct('imei')
    ais140Imeis = db['atlantaAis140'].distinct('imei')
    combinedImeis = set(atlantaImeis) | set(ais140Imeis)

    if vehicleInvyImeis:
        return [i for i in vehicleInvyImeis if i in combinedImeis]

    return []

result = vehicle_inventory.find().distinct("IMEI")

imeis = getCollectionImeis(result)

print(len(imeis))
latest_records = list(atlantaLatestCollection.find({"_id": {"$in": imeis}}))

imeisss = [record['_id'] for record in latest_records]

atlantaAis140Records = list(atlantaAis140LatestCollection.find({"_id": {"$in": imeis}}))
print(f"Total latest records fetched: {len(latest_records) + len(atlantaAis140Records)}")

atlantaImeis = db['atlanta'].distinct('imei')
ais140Imeis = db['atlantaAis140'].distinct('imei')
combinedImeis = set(atlantaImeis) | set(ais140Imeis)
if imeis:
    ssd = [i for i in imeis if i in combinedImeis]
    
print(f"Total IMEIs in combined collection: {len(ssd)}")

for doc in atlantaAis140Records:
    imeisss.append(doc['_id'])
    
for imei in imeis:
    if imei not in imeisss:
        print(f"Missing IMEI: {imei}")