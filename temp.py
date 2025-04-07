from pymongo import MongoClient
from datetime import datetime
import pytz  # for timezone handling

# Your input strings
date_str = "070425"  # DDMMYY format (07 April 2025)
time_str = "084334"  # HHMMSS format (08:43:34)

# Parse the strings into a datetime object
def parse_datetime(ddmmyy, hhmmss):
    day = int(ddmmyy[0:2])
    month = int(ddmmyy[2:4])
    year = 2000 + int(ddmmyy[4:6])  # assuming YY is 2000+
    
    hour = int(hhmmss[0:2])
    minute = int(hhmmss[2:4])
    second = int(hhmmss[4:6])
    
    return datetime(year, month, day, hour, minute, second, tzinfo=pytz.UTC)

# Create the datetime object
query_datetime = parse_datetime(date_str, time_str)

# Connect to MongoDB and query
client = MongoClient("mongodb+srv://doadmin:4T81NSqj572g3o9f@db-mongodb-blr1-27716-c2bd0cae.mongo.ondigitalocean.com/admin?tls=true&authSource=admin")
db = client['nnx']
collection = db['atlanta']

# Query documents where date_time >= our parsed datetime
results = collection.find({
    "date_time": {
        "$gte": query_datetime
    }
})

# Print results
for doc in results:
    print(doc)