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