from pymongo import MongoClient
from datetime import datetime
import os
import time
import socketio
import json
from pymongo import MongoClient
import socketio
import ssl
import os

sio = socketio.Client(ssl_verify=False) 

server_url = "https://localhost:5000" 
cert_path = os.path.join("cert", "fullchain.pem")  

ssl_context = ssl.create_default_context(cafile=cert_path)

try:
    sio.connect(server_url, transports=['websocket'])
    print("Connected to WebSocket server successfully!")
except Exception as e:
    print(f"Failed to connect to WebSocket server: {e}")

mongo_client = MongoClient("mongodb+srv://doadmin:4T81NSqj572g3o9f@db-mongodb-blr1-27716-c2bd0cae.mongo.ondigitalocean.com/admin?tls=true&authSource=admin")
db = mongo_client["nnx"]
atlanta_collection = db['atlanta']
distinct_atlanta_collection = db['distinctAtlanta']
vehicle_inventory_collection = db['vehicle_inventory']

def clean_imei(imei):
    return imei[-15:]

def update_distinct_atlanta():
    try:
        print("Successfully running distinct Vehicle")
        all_documents = list(atlanta_collection.aggregate([
                {"$match": {"gps": "A", "status": "01"}},
                {"$sort": {"timestamp": -1}},
                {
                    "$group": {
                        "_id": "$imei",
                        "latest_doc": {"$first": "$$ROOT"}
                    }
                },
                {"$replaceRoot": {"newRoot": "$latest_doc"}}
            ]))
        
        print(f"Fetched {len(all_documents)} documents from the atlanta collection")

        existing_documents = {
            doc['imei']: doc for doc in distinct_atlanta_collection.find()
        }

        distinct_documents = {}
        for doc in all_documents:
            imei = clean_imei(doc['imei'])
            doc.pop('_id', None)
            distinct_documents[imei] = {**doc, 'imei': imei}

        distinct_atlanta_collection.delete_many({})

        for doc in distinct_documents.values():
            distinct_atlanta_collection.insert_one(doc)

        print('Distinct documents updated successfully')
        
        count = 0
        for imei, doc in distinct_documents.items():
            if imei in existing_documents:
                if doc != existing_documents[imei]:
                    emit_data(doc)
                    count += 1
            else:
                emit_data(doc)
                count += 1
                
        print(f"Emitted {count} updated documents")

    except Exception as e:
        print(f'Error updating distinct documents: {str(e)}')

def emit_data(json_data):
    try:
        if not sio.connected:
            try:
                sio.connect(server_url, transports=['websocket'])
                print("Connected to WebSocket server successfully!")
            except Exception as e:
                print(f"Failed to connect to WebSocket server: {e}")

        json_data['date_time'] = str(json_data['date_time'])
        json_data['timestamp'] = str(json_data['timestamp'])
        inventory_data = vehicle_inventory_collection.find_one({'IMEI': json_data.get('imei')})
        if inventory_data:
            json_data['LicensePlateNumber'] = inventory_data.get('LicensePlateNumber', 'Unknown')
        else:
            json_data['LicensePlateNumber'] = 'Unknown'
        json_data['_id'] = str(json_data['_id'])           

    except Exception as e:
        print(f"Error emitting data: {str(e)}")

if __name__ == '__main__':
    while True:
        update_distinct_atlanta()
        time.sleep(60)  