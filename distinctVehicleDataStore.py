from pymongo import MongoClient
from datetime import datetime
import os
import time

# Initialize MongoDB client
MONGO_URI = os.getenv(
    'MONGO_URI',
    'mongodb+srv://doadmin:4T81NSqj572g3o9f@db-mongodb-blr1-27716-c2bd0cae.mongo.ondigitalocean.com/admin?tls=true&authSource=admin'
)
client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
db = client['nnx']
atlanta_collection = db['atlanta']
distinct_atlanta_collection = db['distinctAtlanta']

def clean_imei(imei):
    # Extract the last 15 characters of the IMEI
    return imei[-15:]

def update_distinct_atlanta():
    try:
        # Fetch all documents from the atlanta collection
        all_documents = list(atlanta_collection.find())

        # Group documents by IMEI and find the most recent document for each IMEI
        distinct_documents = {}
        for doc in all_documents:
            imei = clean_imei(doc['imei'])
            date_time_str = f"{doc['date']} {doc['time']}"
            date_time = datetime.strptime(date_time_str, '%d%m%y %H%M%S')

            if imei not in distinct_documents or date_time > distinct_documents[imei]['date_time']:
                distinct_documents[imei] = {**doc, 'imei': imei, 'date_time': date_time}

        # Prepare documents for insertion
        documents_to_insert = [doc for doc in distinct_documents.values()]

        # Clear the distinctAtlanta collection
        distinct_atlanta_collection.delete_many({})

        # Insert the distinct documents into the distinctAtlanta collection
        distinct_atlanta_collection.insert_many(documents_to_insert)

        print('Distinct documents updated successfully')
    except Exception as e:
        print(f'Error updating distinct documents: {str(e)}')

if __name__ == '__main__':
    while True:
        update_distinct_atlanta()
        time.sleep(60)  # Wait for 60 seconds before running the function again