from datetime import datetime, timezone, timedelta

from urllib3 import Retry
from app.geocoding import geocodeInternal
from pymongo import ASCENDING, DESCENDING
from app.database import db

FLAT_TO_AIS140 = {
    "latitude": "gps.lat",
    "longitude": "gps.lon",
    "dir1": "gps.latDir",
    "dir2": "gps.lonDir",
    "course": "gps.heading",
    "date_time": "gps.timestamp",
    "speed": "telemetry.speed",
    "ignition": "telemetry.ignition",
    "odometer": "telemetry.odometer",
    "main_power": "telemetry.mainPower",
    "internal_bat": "telemetry.internalBatteryVoltage",
    "sos": "telemetry.emergencyStatus",
    "gsm_sig": "network.gsmSignal",
    "mobCountryCode": "network.mcc",
    "mobNetworkCode": "network.mnc",
    "localAreaCode": "network.lac",
    "cellid": "network.cellId",
    "harsh_speed": "packet.id",
    "harsh_break": "packet.id",
    "timestamp": "timestamp",
}

def getCollectionImeis(vehicleInvyImeis=None):
    atlantaImeis = db['atlanta'].distinct('imei')
    ais140Imeis = db['atlantaAis140'].distinct('imei')
    combinedImeis = set(atlantaImeis) | set(ais140Imeis)

    if vehicleInvyImeis:
        return [i for i in vehicleInvyImeis if i in combinedImeis]

    return []

def _convert_date_time_emit(date):
    if not date:
        now = datetime.now(timezone(timedelta(hours=5, minutes=30)))
        return now.strftime("%d%m%y"), now.strftime("%H%M%S")
    # Convert UTC datetime to IST (UTC+5:30)
    ist = date.astimezone(timezone(timedelta(hours=5, minutes=30)))
    return ist.strftime("%d%m%y"), ist.strftime("%H%M%S")

def atlantaAis140ToFront(parsedData, include_address=True):
    date, time = _convert_date_time_emit(parsedData.get("timestamp"))

    gps = parsedData.get("gps", {}) or {}
    telemetry = parsedData.get("telemetry", {}) or {}
    network = parsedData.get("network", {}) or {}
    packet = parsedData.get("packet", {}) or {}
    packet_id = str(packet.get("id", ""))

    if include_address:
        try:
            address = geocodeInternal(gps.get("lat"), gps.get("lon"))
        except Exception:
            address = None
    else:
        address = None

    json_data = {
        "_id": parsedData.get("_id"),
        "imei": parsedData.get("imei"),
        "speed": telemetry.get("speed"),
        "latitude": gps.get("lat"),
        "dir1": gps.get("latDir"),
        "longitude": gps.get("lon"),
        "dir2": gps.get("lonDir"),
        "date": date,
        "time": time,
        "course": gps.get("heading"),
        "address": address,
        "ignition": telemetry.get("ignition"),
        "gsm_sig": network.get("gsmSignal"),
        "sos": telemetry.get("emergencyStatus"),
        "odometer": telemetry.get("odometer"),
        "main_power": telemetry.get("mainPower"),
        "harsh_speed": "1" if packet_id == "14" else "0",
        "harsh_break": "1" if packet_id == "13" else "0",
        "adc_voltage": telemetry.get("mainBatteryVoltage"),
        "internal_bat": telemetry.get("internalBatteryVoltage"),
        "mobCountryCode": network.get("mcc"),
        "mobNetworkCode": network.get("mnc"),
        "localAreaCode": network.get("lac"),
        "cellid": network.get("cellId"),
        "date_time": gps.get("timestamp"),
        "timestamp": parsedData.get("timestamp"),
    }
    return json_data

def getData(imei, date_filter, projection, speedThreshold = None):
    if not speedThreshold:
        query = {"imei": imei, "gps": "A"}
        query.update(date_filter or {})
        data = db["atlanta"].find(query, projection).sort("date_time", ASCENDING)
    else:
        query = {"imei": imei, "gps": "A"}
        query.update(date_filter or {})
        data = db["atlanta"].find(query, projection).sort("date_time", DESCENDING)
    
    data = [record for record in data]
    if data:
        return data

    wanted_fields = {k for k, v in projection.items() if v and k != "_id"}

    ais140_projection = {"_id": 0, "imei": 1}
    for flat in wanted_fields:
        path = FLAT_TO_AIS140.get(flat)
        if path:
            ais140_projection[path] = 1

    dt_filter = None
    if isinstance(date_filter, dict):
        dt_filter = date_filter.get("date_time")

    if not speedThreshold:
        ais140_query = {"imei": imei, "gps.gpsStatus": 1}
    else:
        ais140_query = {"imei": imei, "gps.gpsStatus": 1,}
    
    if dt_filter is not None:
        ais140_query["gps.timestamp"] = dt_filter

    ais140_cursor = db["atlantaAis140"].find(
            ais140_query,
            ais140_projection
        )
    
    if not speedThreshold:
        ais140_data = ais140_cursor.sort("gps.timestamp", ASCENDING)
        ais140_data = [datum for datum in ais140_data]
    else:
        ais140_data = ais140_cursor.sort("gps.timestamp", DESCENDING)
        ais140_data = [datum for datum in ais140_data]

    if not ais140_data:
        return []

    converted = []
    for doc in ais140_data:
        flat_doc = atlantaAis140ToFront(doc, include_address=False)
        out_doc = {}
        for field in wanted_fields:
            if field in flat_doc:
                out_doc[field] = flat_doc[field]
        if "date_time" in flat_doc and ("date_time" in projection or "date_time" not in out_doc):
            out_doc.setdefault("date_time", flat_doc["date_time"])
        if projection.get("_id"):
            out_doc["_id"] = flat_doc.get("_id")
        converted.append(out_doc)

    return converted

def getDataForDistanceReport(imei, date_filter):
    projection = {"_id": 0, "odometer": 1, "latitude": 1, "longitude": 1}
    
    query = {
        "imei": imei, "gps": "A"
    }
    query.update(date_filter)
    
    start_doc = db["atlanta"].find_one(
        query, projection,
        sort=[("date_time", ASCENDING)]
    )
    
    end_doc = db["atlanta"].find_one(
        query, projection,
        sort=[("date_time", DESCENDING)]
    )
    
    if start_doc:
        return start_doc, end_doc
    
    query = {
       "imei": imei,
       "gps.gpsStatus": 1,
       "gps.timestamp": date_filter.get("date_time"),
    }
    
    ais140_projection = {"_id": 0, "telemetry.odometer": 1, "gps.lat": 1, "gps.lon": 1}
    
    start_data = db["atlantaAis140"].find_one(
        query, ais140_projection,
        sort = [("gps.timestamp", ASCENDING)]
    )
    
    if not start_data:
        return start_doc, end_doc
    
    end_data = db["atlantaAis140"].find_one(
        query, ais140_projection,
        sort = [("gps.timestamp", DESCENDING)]
    )
    
    start_doc = {
        "odometer": start_data.get("telemetry", {}).get("odometer", ""),
        "latitude": start_data.get("gps", {}).get("lat", ""),
        "longitude": start_data.get("gps", {}).get("lon", ""),
    }
    
    end_doc = {
        "odometer": end_data.get("telemetry", {}).get("odometer", ""),
        "latitude": end_data.get("gps", {}).get("lat", ""),
        "longitude": end_data.get("gps", {}).get("lon", ""),
    }
    
    return start_doc, end_doc