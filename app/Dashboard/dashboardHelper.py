import traceback
from flask import Blueprint, jsonify, render_template, request
from datetime import datetime, timedelta, timezone
from app.database import db
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app.models import User
from app.utils import roles_required, get_filtered_results, get_vehicle_data
from app.parser import atlantaAis140ToFront

atlanta_collection = db["atlanta"]
atlantaLatestCollection = db["atlantaLatest"]
collection = db['distinctAtlanta']
distance_travelled_collection = db['distanceTravelled']
vehicle_inventory = db["vehicle_inventory"]
atlantaAis140Collection = db["atlantaAis140"]
atlantaAis140LatestCollection = db["atlantaAis140_latest"]

def getDistanceBasedOnTime(imeis, fromDate, toDate):
    pipeline = [
        {"$match": {
            "date_time": {
                "$gte": fromDate,
                "$lt": toDate
            },
            "imei": {"$in":imeis}
        }},
        {"$sort": {"date_time": -1}},
        {"$group": {
            "_id": "$imei",
            "last_odometer": {"$first": "$odometer"},
            "first_odometer": {"$last": "$odometer"}
        }},
        {"$project": {
            "_id": 0,
            "imei": "$_id",
            "first_odometer": 1,
            "last_odometer": 1
        }}
    ]

    distances_atlanta = list(atlanta_collection.aggregate(pipeline))

    pipeline = [
            {"$match": {
                "imei": {"$in": imeis},
                "gps.timestamp": {"$gte": fromDate, "$lt": toDate}
            }},
            {"$sort": {"gps.timestamp": -1}},
            {
                "$group": {
                    "_id": "$imei",
                    "last_odometer": {"$first": "$telemetry.odometer"},
                    "first_odometer": {"$last": "$telemetry.odometer"}
                }
            },
            {"$project": {
                "_id": 0,
                "imei": "$_id",
                "first_odometer": 1,
                "last_odometer": 1
            }}
        ]

    distances_ais140 = list(atlantaAis140Collection.aggregate(pipeline))

    for dist in distances_ais140:
        distances_atlanta.append(dist)

    return distances_atlanta

def getSpeedDataBasedOnTime(imeis, fromDate, toDate):
    pipeline = [
        {
            "$match": {
                "imei": {"$in": imeis},
                "date_time": {"$gte": fromDate, "$lt": toDate},
                "ignition": "1",
            }
        },
        {
            "$addFields": {
                "speed_float": {
                    "$convert": {
                        "input": "$speed",
                        "to": "double",
                        "onError": 0,
                        "onNull": 0
                    }
                }
            }
        },
        {
            "$match": {
                "speed_float": {"$gt": 0}
            }
        },
        {
            "$group": {
                "_id": "$imei",
                "max_speed": {"$max": "$speed_float"}
            }
        },
        {
            "$project": {
                "_id": 0,
                "imei": "$_id",
                "max_speed": 1
            }
        }
    ]

    speed_data_atlanta = list(atlanta_collection.aggregate(pipeline))

    pipeline = [
            {
                "$match": {
                    "imei": {"$in": imeis},
                    "gps.timestamp": {"$gte": fromDate, "$lt": toDate},
                    "telemetry.ignition": 1,
                }
            },
            {"$sort": {"gps.timestamp": -1}},
            {
                "$group": {
                    "_id": "$imei",
                    "max_speed": {"$max": "$telemetry.speed"},
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "imei": "$_id",
                    "max_speed": 1,
                }
            }
        ]

    speed_data_ais140 = list(atlantaAis140Collection.aggregate(pipeline))

    for speed in speed_data_ais140:
        speed_data_atlanta.append(speed)
    
    pipeline = [
        {
            "$match": {
                "imei": {"$in": imeis},
                "date_time": {"$gte": fromDate, "$lt": toDate},
                "ignition": "1",
            }
        },
        {
            "$addFields": {
                "speed_float": {
                    "$convert": {
                        "input": "$speed",
                        "to": "double",
                        "onError": 0,
                        "onNull": 0
                    }
                }
            }
        },
        {
            "$match": {
                "speed_float": {"$gt": 0}
            }
        },
        {
            "$group": {
                "_id": "$imei",
                "speeds": {"$push": "$speed_float"}
            }
        },
        {
            "$project": {
                "_id": 0,
                "imei": "$_id",
                "speeds": 1
            }
        }
    ]
    
    avgSpeedsRaw = list(atlanta_collection.aggregate(pipeline))
    
    pipeline = [
        {
            "$match": {
                "imei": {"$in": imeis},
                "gps.timestamp": {"$gte": fromDate, "$lt": toDate},
                "telemetry.ignition": 1,
                "telemetry.speed": {"$gt": 0}
            },
        },
        {
            "$group": {
                "_id": "$imei",
                "speeds": {"$push": "$telemetry.speed"}
            },
        },
        {
            "$project": {
                "_id": 0,
                "imei": "$_id",
                "speeds": 1
            }
        }
    ]
    
    avgSpeedAtlantaAis140 = list(atlantaAis140Collection.aggregate(pipeline))
    
    for avg in avgSpeedAtlantaAis140:
        avgSpeedsRaw.append(avg)
        
    for avg in avgSpeedsRaw:
        if len(avg["speeds"]) > 0:
            avg_speed = sum(avg["speeds"]) / len(avg["speeds"])
        else:
            avg_speed = 0
        
        for data in speed_data_atlanta:
            if data["imei"] == avg["imei"]:
                data["avg_speed"] = avg_speed
                break
    

    return speed_data_atlanta

def getTimeAnalysisBasedOnTime(imeis, fromDate, toDate):
    pipeline = [
        {
            "$match": 
            {
                "date_time": {"$gte": fromDate, "$lt": toDate},
                "imei": {"$in": imeis}
            }
        },
        {"$sort": {"imei": 1, "date_time": 1}},
        {
            "$group": 
            {
                "_id": "$imei",
                "records": 
                {
                    "$push": {
                        "date_time": "$date_time",
                        "ignition": "$ignition",
                        "speed": {"$toDouble": "$speed"}
                    }
                }
            }
        }
    ]
    
    timeAnalysisData = list(atlanta_collection.aggregate(pipeline))
    
    pipepline = [
        {
            "$match": 
            {
                "gps.timestamp": {"$gte": fromDate, "$lt": toDate},
                "imei": {"$in": imeis}
            }
        },
        {"$sort": {"imei": 1, "gps.timestamp": 1}},
        {
            "$group": 
            {
                "_id": "$imei",
                "records": 
                {
                    "$push": {
                        "timestamp": "$gps.timestamp",
                        "ignition": "$telemetry.ignition",
                        "speed": "$telemetry.speed"
                    }
                }
            }
        }
    ]
    
    timeAnalysisDataAtlantaAis140 = list(atlantaAis140Collection.aggregate(pipeline))
    
    for record in timeAnalysisDataAtlantaAis140:
        timeAnalysisData.append(record)
        
    return timeAnalysisData