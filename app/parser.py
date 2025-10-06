from datetime import datetime, timezone, timedelta
from app.geocoding import geocodeInternal
from pymongo import ASCENDING, DESCENDING
from app.database import db

def _convert_date_time_emit(date):
    if not date:
        now = datetime.now(timezone(timedelta(hours=5, minutes=30)))
        return now.strftime("%d%m%y"), now.strftime("%H%M%S")
    # Convert UTC datetime to IST (UTC+5:30)
    ist = date.astimezone(timezone(timedelta(hours=5, minutes=30)))
    return ist.strftime("%d%m%y"), ist.strftime("%H%M%S")

def atlantaAis140ToFront(parsedData):
    date, time = _convert_date_time_emit(parsedData.get("timestamp"))

    address = geocodeInternal(parsedData.get("gps", {}).get("lat"), parsedData.get("gps", {}).get("lon"))
    json_data = {
        "_id": parsedData.get("_id"),
        "imei": parsedData.get("imei"),
        "speed": parsedData.get("telemetry", {}).get("speed"),
        "latitude": parsedData.get("gps", {}).get("lat"),
        "dir1": parsedData.get("gps", {}).get("latDir"),
        "longitude": parsedData.get("gps", {}).get("lon"),
        "dir2": parsedData.get("gps", {}).get("lonDir"),
        "date": date,
        "time": time,
        "course": parsedData.get("gps", {}).get("heading"),
        "address": address,
        "ignition": parsedData.get("telemetry", {}).get("ignition"),
        "gsm_sig": parsedData.get("network", {}).get("gsmSignal"),
        "sos": parsedData.get("telemetry", {}).get("emergencyStatus"),
        "odometer": parsedData.get("telemetry", {}).get("odometer"),
        "main_power": parsedData.get("telemetry", {}).get("mainPower"),
        "harsh_speed": "0" if parsedData.get("packet").get("id") != "14" else "1",
        "harsh_break": "0" if parsedData.get("packet").get("id") != "13" else "1",
        "adc_voltage": parsedData.get("telemetry", {}).get("mainBatteryVoltage"),
        "odometer": parsedData.get("telemetry", {}).get("odometer"),
        "internal_bat": parsedData.get("telemetry", {}).get("internalBatteryVoltage"),
        "gsm_sig": parsedData.get("network", {}).get("gsmSignal"),
        "mobCountryCode": parsedData.get("network", {}).get("mcc"),
        "mobNetworkCode": parsedData.get("network", {}).get("mnc"),
        "localAreaCode": parsedData.get("network", {}).get("lac"),
        "cellid": parsedData.get("network", {}).get("cellId"),
        "date_time": parsedData.get("gps", {}).get("timestamp"),
    }
    return json_data

def getData(imei, date_filter, projection):
    """
    Unified data fetch:
      1. Try 'atlanta' (flat schema) with given projection.
      2. If no records, try 'atlantaAis140' (nested schema), convert each
         using atlantaAis140ToFront to flat keys, then filter to requested
         projection keys.
    projection: dict of flat atlanta-style field names (e.g. latitude, longitude, speed, date_time)
    """
    query = {"imei": imei, "gps": "A"}
    query.update(date_filter or {})

    # 1. Primary: atlanta
    data = list(db["atlanta"].find(query, projection).sort("date_time", ASCENDING))
    if data:
        return data

    # 2. Fallback: atlantaAis140
    # Determine which flat fields were requested (exclude _id control flags)
    wanted_fields = {k for k, v in projection.items() if v and k != "_id"}

    # Minimal projection for nested ais140 schema (grab blocks needed to derive flat fields)
    ais140_projection = {
        "_id": 0,
        "imei": 1,
        "gps.lat": 1,
        "gps.lon": 1,
        "gps.timestamp": 1,
        "gps.heading": 1,
        "gps.latDir": 1,
        "gps.lonDir": 1,
        "telemetry.speed": 1,
        "telemetry.ignition": 1,
        "telemetry.odometer": 1,
        "telemetry.mainPower": 1,
        "telemetry.internalBatteryVoltage": 1,
        "telemetry.emergencyStatus": 1,
        "telemetry.mainBatteryVoltage": 1,
        "network.gsmSignal": 1,
        "network.mcc": 1,
        "network.mnc": 1,
        "network.lac": 1,
        "network.cellId": 1,
        "packet.id": 1,
        "timestamp": 1    # raw packet timestamp if present
    }

    ais140_data = list(db["atlantaAis140"].find(
        {"imei": imei, "gps.timestamp": {"$exists": True}, **{k: v for k, v in query.items() if k not in ["date_time"]}},
        ais140_projection
    ).sort("gps.timestamp", ASCENDING))

    if not ais140_data:
        return None

    converted = []
    for doc in ais140_data:
        flat_doc = atlantaAis140ToFront(doc)  # produces atlanta-style keys
        # Filter to requested projection keys + _id if requested
        out_doc = {}
        for field in wanted_fields:
            if field in flat_doc:
                out_doc[field] = flat_doc[field]
        # Ensure date_time present for sorting
        if "date_time" not in out_doc and "date_time" in flat_doc:
            out_doc["date_time"] = flat_doc["date_time"]
        if "_id" in projection:
            out_doc["_id"] = flat_doc.get("_id")
        converted.append(out_doc)

    # Final sort (safety) by date_time ascending
    converted.sort(key=lambda r: r.get("date_time") or datetime.min.replace(tzinfo=timezone.utc))
    return converted