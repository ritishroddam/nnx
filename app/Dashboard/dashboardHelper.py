import dis
import traceback
from flask import Blueprint, jsonify, render_template, request
from datetime import datetime, timedelta, timezone
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

def getDistanceBasedOnTime(imeis, fromDate, toDate):
    distances = []
    for imei in imeis:
        pipeline = [
            {"$match": {
                "imei": imei,
                "date_time": {
                    "$gte": fromDate,
                    "$lt": toDate
                },
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

        distance = list(atlanta_collection.aggregate(pipeline))

        if not distance:
            pipeline = [
                    {"$match": {
                        "imei": imei,
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

            distance = list(atlantaAis140Collection.aggregate(pipeline))

        distances.extend(distance)

    return distances

def getSpeedDataBasedOnTime(imeis, fromDate, toDate):
    speed_data = []
    avgSpeedsRaw = []
    
    for imei in imeis:
        pipeline = [
            {
                "$match": {
                    "imei": imei,
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

        speed_datum = list(atlanta_collection.aggregate(pipeline))

        if not speed_datum:
            pipeline = [
                    {
                        "$match": {
                            "imei": imei,
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

            speed_datum = list(atlantaAis140Collection.aggregate(pipeline))
            
        speed_data.extend(speed_datum)

        pipeline = [
            {
                "$match": {
                    "imei": imei,
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

        avgSpeedRaw = list(atlanta_collection.aggregate(pipeline))
        
        if not avgSpeedRaw:
            pipeline = [
                {
                    "$match": {
                        "imei": imei,
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

            avgSpeedRaw = list(atlantaAis140Collection.aggregate(pipeline))
        
        avgSpeedsRaw.extend(avgSpeedRaw)
        
    for avg in avgSpeedsRaw:
        if len(avg["speeds"]) > 0:
            avg_speed = sum(avg["speeds"]) / len(avg["speeds"])
        else:
            avg_speed = 0
        
        for data in speed_data:
            if data["imei"] == avg["imei"]:
                data["avg_speed"] = avg_speed
                break
    

    return speed_data

def getTimeAnalysisBasedOnTime(imeis, fromDate, toDate):
    timeAnalysisData = []
    for imei in imeis:
        pipeline = [
            {
                "$match": 
                {
                    "imei": imei,
                    "date_time": {"$gte": fromDate, "$lt": toDate},
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

        timeAnalysisDatum = list(atlanta_collection.aggregate(pipeline))

        if not timeAnalysisDatum:
            pipeline = [
                {
                    "$match": 
                    {
                        "imei": imei,
                        "gps.timestamp": {"$gte": fromDate, "$lt": toDate},
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
                                "date_time": "$gps.timestamp",
                                "ignition": {"$toString": "$telemetry.ignition"},
                                "speed": "$telemetry.speed"
                            }
                        }
                    }
                }
            ]

            timeAnalysisDatum = list(atlantaAis140Collection.aggregate(pipeline))
        timeAnalysisData.extend(timeAnalysisDatum)
        
    return timeAnalysisData