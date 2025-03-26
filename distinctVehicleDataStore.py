from pymongo import MongoClient
from datetime import datetime
import os
import time
import socketio
import json

# Initialize MongoDB client
MONGO_URI = os.getenv(
    'MONGO_URI',
    'mongodb+srv://doadmin:4T81NSqj572g3o9f@db-mongodb-blr1-27716-c2bd0cae.mongo.ondigitalocean.com/admin?tls=true&authSource=admin'
)
client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
db = client['nnx']
atlanta_collection = db['atlanta']
distinct_atlanta_collection = db['distinctAtlanta']
vehicle_inventory_collection = db['vehicle_inventory']

# Initialize Socket.IO client
sio = socketio.Client()

try:
    sio.connect('http://0.0.0.0:8555', transports=['websocket'])
    print("Socket.IO connected successfully")
except Exception as e:
    print(f"Error connecting to Socket.IO server: {str(e)}")

def clean_imei(imei):
    # Extract the last 15 characters of the IMEI
    return imei[-15:]

def update_distinct_atlanta():
    try:
        print("Successfully running distinct Vehicle")
        all_documents = list(atlanta_collection.find())
        print(f"Fetched {len(all_documents)} documents from the atlanta collection")

        # Fetch existing data from distinctAtlanta collection
        existing_documents = {
            doc['imei']: doc for doc in distinct_atlanta_collection.find()
        }

        # Group documents by IMEI and find the most recent document for each IMEI
        distinct_documents = {}
        for doc in all_documents:
            imei = clean_imei(doc['imei'])
            date_time_str = f"{doc['date']} {doc['time']}"
            date_time = datetime.strptime(date_time_str, '%d%m%y %H%M%S')

            if imei not in distinct_documents or date_time > distinct_documents[imei]['date_time']:
                if doc['gps'] != 'V':
                    distinct_documents[imei] = {**doc, 'imei': imei, 'date_time': date_time}

        distinct_atlanta_collection.delete_many({})

        # Insert the distinct documents into the distinctAtlanta collection
        for doc in distinct_documents.values():
            distinct_atlanta_collection.insert_one(doc)

        print('Distinct documents updated successfully')
        
        # Send data one by one and compare with existing data
        count = 0
        for imei, doc in distinct_documents.items():
            if imei in existing_documents:
                # Compare with existing data
                if doc != existing_documents[imei]:
                    # Data has changed, emit the updated data
                    emit_data(doc)
                    count += 1
            else:
                # New data, emit it
                emit_data(doc)
                count += 1
                
        print(f"Emitted {count} updated documents")

    except Exception as e:
        print(f'Error updating distinct documents: {str(e)}')

def emit_data(json_data):
    try:

        # Add additional data from vehicle_inventory_collection
        inventory_data = vehicle_inventory_collection.find_one({'IMEI': json_data.get('imei')})
        json_data['date_time'] = str(json_data['date_time'])
        if inventory_data:
            json_data['LicensePlateNumber'] = inventory_data.get('LicensePlateNumber', 'Unknown')
        else:
            json_data['LicensePlateNumber'] = 'Unknown'
        json_data['_id'] = str(json_data['_id'])

        if not sio.connected:
            try:
                sio.connect('http://0.0.0.0:8555', transports=['websocket'])
                print("Socket.IO connected successfully")
            except Exception as e:
                print(f"Error connecting to Socket.IO server: {str(e)}")
        
        sio.emit('vehicle_update', json_data)
        print(f"Emitted data for IMEI {json_data['imei']}")

            

    except Exception as e:
        print(f"Error emitting data: {str(e)}")

if __name__ == '__main__':
    while True:
        update_distinct_atlanta()
        time.sleep(60)  # Wait for 60 seconds before running the function again