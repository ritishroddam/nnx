import traceback
from pymongo import ASCENDING, DESCENDING
from datetime import datetime, timedelta, timezone
import eventlet

from app.database import db
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app.models import User
from app.utils import roles_required
from app.parser import atlantaAis140ToFront

atlanta_collection = db["atlanta"]
atlantaLatestCollection = db["atlantaLatest"]
collection = db['distinctAtlanta']
distance_travelled_collection = db['distanceTravelled']
vehicle_inventory = db["vehicle_inventory"]
atlantaAis140Collection = db["atlantaAis140"]
atlantaAis140LatestCollection = db["atlantaAis140_latest"]

def _build_time_record(imei, fromDate, toDate):
    records = []

    data = list(atlanta_collection.find(
        {
            "imei": imei,
            "date_time": {"$gte": fromDate, "$lt": toDate},
        }, {"_id": 0, "date_time": 1, "ignition": 1, "speed": 1},
        sort=[("date_time", ASCENDING), ("imei", ASCENDING)]
    ))

    if not data:
        data = list(atlantaAis140Collection.find(
            {
                "imei": imei,
                "gps.timestamp": {"$gte": fromDate, "$lt": toDate},
            }, {"_id": 0, "gps.timestamp": 1, "telemetry.ignition": 1, "telemetry.speed": 1},
            sort=[("gps.timestamp", ASCENDING), ("imei", ASCENDING)]
        ))
        for datum in data:
            records.append({
                "date_time": datum.get("gps", {}).get("timestamp"),
                "ignition": str(datum.get("telemetry", {}).get("ignition")),
                "speed": float(datum.get("telemetry", {}).get("speed", 0)),
            })
    else:
        for datum in data:
            records.append({
                "date_time": datum.get("date_time"),
                "ignition": datum.get("ignition"),
                "speed": float(datum.get("speed", 0)),
            })

    if records:
        return {"_id": imei, "records": records}
    return None

def getDistanceBasedOnTime(imeis, fromDate, toDate):
    distances = []
    for imei in imeis:
        imeiStartData = atlanta_collection.find_one(
            {
                "imei": imei,
                "date_time": {
                    "$gte": fromDate,
                    "$lt": toDate
                },
            },
            sort=[("date_time", ASCENDING)]
        )
        
        if imeiStartData:
            imeiEndData = atlanta_collection.find_one(
                {
                    "imei": imei,
                    "date_time": {
                        "$gte": fromDate,
                        "$lt": toDate
                    },
                },
                sort=[("date_time", DESCENDING)]
            )
            distance = [{
                "imei": imei,
                "first_odometer": imeiStartData.get("odometer", 0),
                "last_odometer": imeiEndData.get("odometer", 0)
            }]
            distances.extend(distance)
            continue
        else:
            imeiStartData = atlantaAis140Collection.find_one(
                {
                    "imei": imei,
                    "gps.timestamp": {
                        "$gte": fromDate,
                        "$lt": toDate
                    },
                },
                sort=[("gps.timestamp", ASCENDING)]
            )
            
            if not imeiStartData:
                continue
            
            imeiEndData = atlantaAis140Collection.find_one(
                {
                    "imei": imei,
                    "gps.timestamp": {
                        "$gte": fromDate,
                        "$lt": toDate
                    },
                },
                sort=[("gps.timestamp", DESCENDING)]
            )
            
            distance = [{
                "imei": imei,
                "first_odometer": imeiStartData.get("telemetry", {}).get("odometer", 0),
                "last_odometer": imeiEndData.get("telemetry", {}).get("odometer", 0)
            }]
            distances.extend(distance)

    return distances

def getSpeedDataBasedOnTime(imeis, fromDate, toDate):
    speed_data = []
    
    for imei in imeis:
        max_speed = 0.00
        speeds = []
            
        data = list(atlanta_collection.find(
            {
                "imei": imei,
                "date_time": {"$gte": fromDate, "$lt": toDate},
                "ignition": "1",
            }, {"_id": 0, "speed": 1}
        ))
        
        if not data:
            data = list(atlantaAis140Collection.find(
                {
                    "imei": imei,
                    "gps.timestamp": {"$gte": fromDate, "$lt": toDate},
                    "telemetry.ignition": 1,
                }, {"_id": 0, "telemetry.speed": 1}
            ))
            
            for datum in data:
                if float(datum.get("telemetry", {}).get("speed", 0)) > max_speed:
                    max_speed = float(datum.get("telemetry", {}).get("speed", 0))
                    
                if float(datum.get("telemetry", {}).get("speed", 0)) >= 0:
                    speeds.append(float(datum.get("telemetry", {}).get("speed", 0)))
            
            averageSpeed = sum(speeds) / len(speeds) if speeds else 0.00
            
            speed_data.append({
                "imei": imei,
                "max_speed": max_speed,
                "avg_speed": averageSpeed
            })
            continue
        
        for datum in data:
            if float(datum.get("speed", 0)) > max_speed:
                max_speed = float(datum.get("speed", 0))
            if float(datum.get("speed", 0)) >= 0:
                speeds.append(float(datum.get("speed", 0)))
        
        averageSpeed = sum(speeds) / len(speeds) if speeds else 0.00
        
        speed_data.append({
            "imei": imei,
            "max_speed": max_speed,
            "avg_speed": averageSpeed
        })

    return speed_data

def getTimeAnalysisBasedOnTime(imeis, fromDate, toDate):
    pool = eventlet.GreenPool(size=10)
    timeAnalysisData = []
    for result in pool.imap(lambda x: _build_time_record(x, fromDate, toDate), imeis):
        if result:
            timeAnalysisData.append(result)
    return timeAnalysisData