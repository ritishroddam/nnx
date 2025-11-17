from flask import jsonify, request, render_template, redirect, Blueprint, flash
from datetime import datetime, timedelta, timezone
from app.database import db
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app.models import User
from app.utils import roles_required
from app.geocoding import geocodeInternal
from app.parser import atlantaAis140ToFront, getData, FLAT_TO_AIS140
from app.Reports.allReports import processTravelPathDistanceRecord
from config import config

route_bp = Blueprint('RouteHistory', __name__, static_folder='static', template_folder='templates')

data_collection = db["vehicle_inventory"]
atlanta_collection = db["atlanta"]
atlantaAIS140_collection = db['atlantaAis140']
company_collection = db["customers_list"]

def deltaTimeString(status_time_delta):
    days = status_time_delta.days
    seconds = status_time_delta.seconds
    hours, remainder = divmod(seconds, 3600)
    minutes, seconds = divmod(remainder, 60)

    if days > 0:
        return f"{days} days, {hours} hours"
    elif hours > 0:
        return f"{hours} hours, {minutes} minutes"
    elif minutes > 0:
        return f"{minutes} minutes, {seconds} seconds"
    else:
        return f"{seconds} seconds"
    
@route_bp.route("/vehicle/<LicensePlateNumber>", methods=["GET"])
@jwt_required()
def show_vehicle_data(LicensePlateNumber):
    try:
        print(f"Request received for LicensePlateNumber: {LicensePlateNumber}")
        vehicleData = data_collection.find_one({"LicensePlateNumber": LicensePlateNumber})
        if not vehicleData:
            flash(f"Vehicle with License Plate Number '{LicensePlateNumber}' does not exist.", "warning")
            return render_template('vehicleMap.html')

        processed_data = []
        recent_data = None
        print(vehicleData['IMEI'])

        pipeline = [
            {"$match": {"imei": vehicleData['IMEI'], "gps": "A" }},
            {"$sort": {"date_time": -1}},
            {"$limit": 50}
        ]

        vehicle_data = list(atlanta_collection.aggregate(pipeline))
        
        if not vehicle_data:
            pipeline = [
                {'$match': {'imei': vehicleData['IMEI'], 'gps.gpsStatus': 1}},
                {'$sort': {"gps.timestamp": -1}},
                {'$limit': 50},
            ]
            
            vehicleAisData = list(atlantaAIS140_collection.aggregate(pipeline))
            
            if not vehicleAisData:
                flash(f"Data for vehicle with License Plate Number '{LicensePlateNumber}' does not exist.", "warning")
                return render_template('vehicleMap.html')
            
            vehicle_data = []
            for datum in vehicleAisData:
                vehicle_datum = atlantaAis140ToFront(datum, include_address=False)
                
                vehicle_data.append(vehicle_datum)

        is_active = False
        most_recent_entry = None
        if vehicle_data:
            vehicle_data = [
                entry for entry in vehicle_data
                if entry.get("date") and
                   entry.get("latitude") is not None and
                   entry.get("longitude") is not None and
                   entry.get("speed") is not None
            ]
            if vehicle_data:
                most_recent_entry = vehicle_data[0]
                if float(most_recent_entry.get("speed","0.0")) > 0:
                    is_active = True

                now = datetime.now()
                five_minutes_ago = now - timedelta(hours=1)

                for entry in vehicle_data:
                    if entry.get("date_time") and entry.get("date_time") > five_minutes_ago.replace(tzinfo = timezone.utc):
                        if recent_data is None:
                            recent_data = []
                        if entry.get("speed") != "0.0":
                            recent_data.append(
                                {
                                    "time": entry["time"],
                                    "speed": entry["speed"]
                                }
                            )

        if recent_data and vehicle_data:
            print(f"Recent data for vehicle {LicensePlateNumber}: {recent_data}")
            print(f"Vehicle data for vehicle {LicensePlateNumber}: {vehicle_data}")
            

        if most_recent_entry.get("latitude") and most_recent_entry.get("longitude"):
            latitude = most_recent_entry["latitude"]
            longitude = most_recent_entry["longitude"]
            address = geocodeInternal(latitude, longitude)

        if vehicleData and most_recent_entry:
            processed_data.append({
                "License Plate Number": vehicleData.get("LicensePlateNumber", "Unknown"),
                "Address": address if address else "Unknown",
                "Vehicle Type": vehicleData.get("VehicleType", "Unknown"),
                "Vehicle Model": vehicleData.get("VehicleModel", "Unknown"),
                "Vehicle Make": vehicleData.get("VehicleMake", "Unknown"),
                "Driver Name": vehicleData.get("DriverName", "Unknown"),
                "Current Status": "Active" if is_active else "Inactive",
                "Time": most_recent_entry.get("time", "N/A") if most_recent_entry else "N/A",
                "Latitude": most_recent_entry.get("latitude", "N/A") if most_recent_entry else "N/A",
                "Longitude": most_recent_entry.get("longitude", "N/A") if most_recent_entry else "N/A",
                "Speed": most_recent_entry.get("speed", "N/A") if most_recent_entry else "N/A",
                "Date": most_recent_entry.get("date", "N/A") if most_recent_entry else "N/A",
                "Ignition": most_recent_entry.get("ignition", "Unknown") if most_recent_entry else "Unknown",
                "Door": most_recent_entry.get("door", "Unknown") if most_recent_entry else "Unknown",
                "SOS": most_recent_entry.get("sos", "Unknown") if most_recent_entry else "Unknown",
                "Odometer": most_recent_entry.get("odometer", "Unknown") if most_recent_entry else "Unknown",
                "IMEI": vehicleData.get("IMEI", "Unknown"),
            })
        else:
            processed_data.append({
                "License Plate Number": vehicleData.get("LicensePlateNumber", "Unknown"),
                "Address": "Unknown",
                "Vehicle Type": vehicleData.get("VehicleType", "Unknown"),
                "Vehicle Model": vehicleData.get("VehicleModel", "Unknown"),
                "Vehicle Make": vehicleData.get("VehicleMake", "Unknown"),
                "Driver Name": vehicleData.get("DriverName", "Unknown"),
                "Current Status": "Inactive",
                "Time": "N/A",
                "Latitude": "N/A",
                "Longitude": "N/A",
                "Speed": "N/A",
                "Date": "N/A",
                "Ignition": vehicleData.get("ignition", "Unknown"),
                "Door": vehicleData.get("door", "Unknown"),
                "SOS": vehicleData.get("sos", "Unknown"),
                "Odometer": vehicleData.get("odometer", "Unknown"),
                "IMEI": vehicleData.get("IMEI", "Unknown"),
            })

        alerts = list(db['sos_logs'].find({"imei": vehicleData['IMEI']}))

        return render_template('vehicle.html', vehicle_data=processed_data, recent_data=recent_data, alerts=alerts)
    except Exception as e:
        print(f"Error processing vehicle data for {LicensePlateNumber}: {e}")
        return "An error occurred while processing vehicle data.", 500

@route_bp.route("/vehicle/<imei>/liveData", methods=["GET"])
@jwt_required()
def fetch_live_data(imei):
    try:
        now = datetime.now().astimezone(timezone.utc)
        thirty_minutes_ago = now - timedelta(minutes=30)

        projection = {"_id": 0, "latitude": 1, "longitude": 1, "speed": 1, "ignition": 1, "date_time": 1, "course": 1}
        date_filter = {"date_time": {"$gte": thirty_minutes_ago.replace(tzinfo = timezone.utc)}}
        
        liveData = getData(imei, date_filter, projection)

        if not liveData:
            projection = {"_id": 0, "latitude": 1, "longitude": 1, "speed": 1, "ignition": 1, "date_time": 1, "course": 1}
            pipeline = [
                {"$match": {"imei": imei, "gps": "A"}},
                {"$sort": {"date_time": -1}},
                {"$project": projection},
                {"$limit": 1}
            ]
            data = list(atlanta_collection.aggregate(pipeline))
            
            if not data:
                wanted_fields = {k for k, v in projection.items() if v and k != "_id"}

                ais140_projection = {"_id": 0, "imei": 1}
                for flat in wanted_fields:
                    path = FLAT_TO_AIS140.get(flat)
                    if path:
                        ais140_projection[path] = 1
                        
                pipeline = [
                    {"$match": {"imei": imei}},
                    {"$sort": {"gps.timestamp": -1}},
                    {"$project": projection},
                    {"$limit": 1}
                ]
                
                data = list(atlantaAIS140_collection.aggregate(pipeline))
                
                if not data:
                    return jsonify({"error": "No data found for the specified vehicle"}), 404
                
                data = [atlantaAis140ToFront(datum, include_address=False) for datum in data]

            status_time_delta = now - data[0]["date_time"]
            status_time = deltaTimeString(status_time_delta)

            data[0]["status"] = "Inactive"
            data[0]["status_time"] = status_time
            data[0]["status_time_delta"] = int(status_time_delta.total_seconds()  * 1000)
            return jsonify(data), 200

        address = geocodeInternal(liveData[0]["latitude"], liveData[0]["longitude"])

        if address:
            liveData[0]["address"] = address

        if liveData[0]["ignition"] == "0" and liveData[0]["speed"] == "0.0":
            index = len(liveData) - 1
            for entry in liveData:
                if entry["ignition"] != "1" or entry["speed"] != "0.0":
                    index = liveData.index(entry)
                    break
            status_time_delta = liveData[0]["date_time"] - liveData[index]["date_time"]
            status_time = deltaTimeString(status_time_delta)

            liveData[0]["status"] = "Stopped"
            liveData[0]["status_time"] = status_time
            liveData[0]["status_time_delta"] = int(status_time_delta.total_seconds()  * 1000)
            return jsonify(liveData), 200
        elif liveData[0]["ignition"] == "1" and liveData[0]["speed"] != "0.0":
            index = len(liveData) - 1
            for entry in liveData:
                if entry["ignition"] != "1" or entry["speed"] == "0.0":
                    index = liveData.index(entry)
                    break
            status_time_delta = liveData[0]["date_time"] - liveData[index]["date_time"]
            status_time = deltaTimeString(status_time_delta)

            liveData[0]["status"] = "Moving"
            liveData[0]["status_time"] = status_time
            liveData[0]["status_time_delta"] = int(status_time_delta.total_seconds()  * 1000)
            return jsonify(liveData), 200
        elif liveData[0]["ignition"] == "1" and liveData[0]["speed"] == "0.0":
            index = len(liveData) - 1
            for entry in liveData:
                if entry["ignition"] != "1" or entry["speed"] != "0.0":
                    index = liveData.index(entry)
                    break
            status_time_delta = liveData[0]["date_time"] - liveData[index]["date_time"]
            status_time = deltaTimeString(status_time_delta)

            liveData[0]["status"] = "Idle"
            liveData[0]["status_time"] = status_time
            liveData[0]["status_time_delta"] = int(status_time_delta.total_seconds()  * 1000)
            return jsonify(liveData), 200
        else:
            liveData[0]["status"] = "unknown"
            liveData[0]["status_time"] = "unknown"
            liveData[0]["status_time_delta"] = "unknown"
            return jsonify(liveData), 200
            
    except Exception as e:
        print(f"Error fetching live data for IMEI {imei}: {e}")
        return jsonify({"error": "Error fetching live data"}), 500

@route_bp.route("/vehicle/<imei>/alerts", methods=["GET"])
@jwt_required()
def fetch_vehicle_alerts(imei):
    try:
        alerts = list(db["sos_logs"].find({"imei": imei}, {"_id": 0}))

        if not alerts:
            return jsonify([])

        ist = timezone(timedelta(hours=5, minutes=30))

        formatted_alerts = [
            {
                "timestamp": alert["date_time"].astimezone(ist).strftime("%d-%m-%Y %I:%M:%S %p"),
                "location": f"{alert['latitude']}, {alert['longitude']}",
                "severity": "Critical",
            }
            for alert in alerts
        ]

        return jsonify(formatted_alerts)
    except Exception as e:
        return jsonify({"error": "Error fetching alerts"}), 500

@route_bp.route("/alerts", methods=["GET"])
@jwt_required()
def get_alerts():
    try:
        imei = request.args.get("imei")
        if not imei:
            return jsonify({"error": "IMEI is required"}), 400

        alerts = list(db["sos_logs"].find({"imei": imei}, {"_id": 0, "latitude": 1, "longitude": 1, "location": 1, "timestamp": 1}))

        formatted_alerts = [
            {
                "timestamp": alert["timestamp"],
                "location": alert["location"],
                "latitude": alert.get("latitude", "N/A"),
                "longitude": alert.get("longitude", "N/A"),
            }
            for alert in alerts
        ]

        return jsonify(formatted_alerts)

    except Exception as e:
        return jsonify({"error": "Error fetching alerts"}), 500


@route_bp.route("/get_vehicle_path", methods=["GET"])
@jwt_required()
def get_vehicle_path():
    imei_numeric = request.args.get("imei")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    
    IST = timezone(timedelta(hours=5, minutes=30))
    
    if start_date and end_date:
        start_date = datetime.fromisoformat(start_date) 
        end_date = datetime.fromisoformat(end_date) 
        
        iso_start_date = start_date.replace(tzinfo=IST)
        iso_end_date = end_date.replace(tzinfo=IST)
    else:
        iso_start_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        iso_end_date = datetime.now()
        
    iso_start_date = start_date.astimezone(timezone.utc)
    iso_end_date = end_date.astimezone(timezone.utc)

    try:
        data_record = data_collection.find_one({"IMEI": str(imei_numeric)})
        if not data_record:
            return jsonify({"error": f"IMEI number {imei_numeric} not found in data collection"}), 404

        projection = {
                    "_id": 0,
                    "latitude": 1,
                    "longitude": 1,
                    "speed": 1,
                    "ignition": 1,
                    "date_time": 1,
                    "course": 1,
                }
        
        date_filter = {"date_time": {"$gte": iso_start_date, "$lte": iso_end_date}}
        

        records_list = getData(str(imei_numeric), date_filter, projection)
        records_list = processTravelPathDistanceRecord(records_list)
        if not records_list:
            return jsonify({"error": f"No path data found for the specified IMEI {imei_numeric} and date range {iso_start_date} and {iso_end_date} "}), 404

        ist = timezone(timedelta(hours=5, minutes=30))

        path_data = []
        for record in records_list:
            
            if not record['latitude'] or not record['longitude']:
                continue

            latitude = float(record["latitude"])
            longitude = float(record["longitude"])
            path_data.append({
                "LicensePlateNumber": data_record.get("LicensePlateNumber", "Unknown"),
                "latitude": latitude,
                "longitude": longitude,
                "speed": record["speed"],
                "ignition": record["ignition"],
                "time": record["date_time"].astimezone(ist).strftime("%d-%m-%Y %I:%M:%S %p"),
                "course": record["course"],
            })

        return jsonify(path_data)

    except Exception as e:
        print(f"Error fetching path data: {str(e)}")
        return jsonify({"error": "Error fetching path data"}), 500
