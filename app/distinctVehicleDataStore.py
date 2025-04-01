from datetime import datetime
import eventlet
from app import db  # Use the Flask app's database instance

atlanta_collection = db['atlanta']
distinct_atlanta_collection = db['distinctAtlanta']
vehicle_inventory_collection = db['vehicle_inventory']

def update_distinct_atlanta(socketio):
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
            imei = doc['imei']
            date_time_str = f"{doc['date']} {doc['time']}"
            date_time = datetime.strptime(date_time_str, '%d%m%y %H%M%S')
            doc.pop('_id', None)

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
                    emit_data(socketio, doc)
                    count += 1
            else:
                # New data, emit it
                emit_data(socketio, doc)
                count += 1
                
        print(f"Emitted {count} updated documents")

    except Exception as e:
        print(f'Error updating distinct documents: {str(e)}')

def emit_data(socketio, json_data):
    try:
        # Add additional data from vehicle_inventory_collection
        inventory_data = vehicle_inventory_collection.find_one({'IMEI': json_data.get('imei')})
        json_data['date_time'] = str(json_data['date_time'])
        if inventory_data:
            json_data['LicensePlateNumber'] = inventory_data.get('LicensePlateNumber', 'Unknown')
        else:
            json_data['LicensePlateNumber'] = 'Unknown'

        # Emit the data using Flask-SocketIO
        socketio.emit('vehicle_update', json_data)  # Removed 'broadcast=True'  

    except Exception as e:
        print(f"Error emitting data: {str(e)}")

def run_distinct_vehicle_data_store(socketio):
    while True:
        update_distinct_atlanta(socketio)
        eventlet.sleep(120)  # Wait for 60 seconds before running the function again