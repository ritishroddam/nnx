from flask import render_template, Blueprint, request, jsonify, send_file, Response
import json
from datetime import datetime, timedelta
from datetime import timezone as timeZ
from numpy import record
from pymongo import ASCENDING, DESCENDING
import pandas as pd
import pytz
from pytz import timezone
from io import BytesIO
import os
from collections import OrderedDict
import boto3
from botocore.client import Config
from bson import ObjectId
from app.database import db
from flask_jwt_extended import get_jwt, jwt_required, get_jwt_identity
from app.models import User
from app.utils import roles_required, get_vehicle_data, get_vehicle_data_for_claims
from app.geocoding import geocodeInternal
from app.parser import atlantaAis140ToFront, getData, getDataForDistanceReport
from celery import states
from app.celery_app import celery as celery_app

reports_bp = Blueprint('Reports', __name__, static_folder='static', template_folder='templates')

SPACES_KEY = 'DO80126D9XH4CX283ZFW'
SPACES_SECRET = 'fpPZRhNzbAzvMBDpzwoht2I6FDDxfp34ENUnz1h1lH8'
SPACE_NAME = 'cordonnx'
REGION = 'blr1'
ENDPOINT = 'https://blr1.digitaloceanspaces.com'

session = boto3.session.Session()
s3 = session.client('s3',
    region_name=REGION,
    endpoint_url=ENDPOINT,
    aws_access_key_id=SPACES_KEY,
    aws_secret_access_key=SPACES_SECRET
)

IST = timezone('Asia/Kolkata')

FIELD_COLLECTION_MAP = {
    'atlanta': ['status', 'time', 'gps', 'latitude', 'longitude', 'speed', 
                'date', 'ignition', 'door', 'sos', 'main_power', 'odometer',
                'internal_bat', 'gsm_sig', 'cellid', 'temp', 'harsh_speed',
                'timestamp', 'course', 'checksum', 'reserve1', 'reserve2',
                'ac', 'reserve3', 'harsh_break', 'arm', 'sleep', 'reserve4',
                'status_accelerometer', 'adc_voltage', 'one_wire_temp', 'i_btn',
                'onBoard_temp', 'mobCountryCode', 'mobNetworkCode', 'localAreaCode',
                'Average Speed', 'Maximum Speed'],
    'vehicle_inventory': ['LicensePlateNumber', 'IMEI', 'SIM', 'VehicleModel', 
                         'VehicleMake', 'YearOfManufacture', 'DateOfPurchase',
                         'InsuranceNumber', 'DriverName', 'CurrentStatus','VehicleType',
                         'Location', 'OdometerReading', 'ServiceDueDate'],
    'sos_logs': ['imei', 'date', 'time', 'latitude', 'longitude', 'date_time', 'timestamp']
}       

report_configs = {
    'daily-distance': {
        'collection': 'atlanta',
        'fields': ["date_time", "odometer", "latitude", "longitude", "speed"],
        'query': {"gps": "A"},
        'sheet_name': "Travel Path Report",
        'post_process': lambda df, _: process_travel_path_report(df)
    },
    'odometer-daily-distance': {
        'collection': 'atlanta',
        'fields': ["date_time", "odometer", "latitude", "longitude"],
        'query': {"gps": "A"},
        'sheet_name': "Distance Report",
    },
    'distance-speed-range': {
        'collection': 'atlanta',
        'fields': ["date_time", "speed", "latitude", "longitude"],
        'query': {"gps": "A"},
        'sheet_name': "Speed Report"
    },
    'stoppage': {
        'collection': 'atlanta',
        'fields': ["date_time", "latitude", "longitude", "ignition"],
        'query': {"ignition": "0", "gps": "A"},
        'sheet_name': "Stoppage Report",
        'post_process': lambda df, _: process_duration_report(df, "Stoppage Duration (min)")
    },
    'idle': {
        'collection': 'atlanta',
        'fields': ["date_time", "latitude", "longitude", "ignition", "speed"],
        'query': {"ignition": "1", "speed": "0.0", "gps": "A"},
        'sheet_name': "Idle Report",
        'post_process': lambda df, _: process_duration_report(df, "Idle Duration (min)")
    },
    'ignition': {
        'collection': 'atlanta',
        'fields': ["date_time", "latitude", "longitude", "ignition"],
        'query': {"gps": "A"},
        'sheet_name': "Ignition Report",
        'post_process': lambda df, _: process_duration_report(df, "Ignition Duration (min)")
    },
    'daily': {
        'collection': 'atlanta',
        'fields': ["date_time", "odometer", "speed", "latitude", "longitude"],
        'query': {"gps": "A"},
        'sheet_name': "Daily Report"
    },
    'panic': {
        'collection': 'sos_logs',
        'fileds': ['all', 'all'],
        'query': ['this is a placeholder, and am to lazy to remove this'],
        'sheet_name': 'Panic Report'
    },
}

def safe_geocode(lat, lng):
    try:
        if lat in (None, "",) or lng in (None, "",):
            return "Location Not Available"
        return geocodeInternal(float(lat), float(lng))
    except Exception:
        return "Location Not Available"

def format_duration_hms(total_seconds):
    try:
        secs = int(total_seconds)
        if secs < 0:
            secs = 0
        h = secs // 3600
        m = (secs % 3600) // 60
        s = secs % 60
        parts = []
        if h > 0:
            parts.append(f"{h} h")
        if m > 0 or h > 0:
            parts.append(f"{m} m")
        parts.append(f"{s} s")
        return " ".join(parts)
    except Exception:
        return "0 s"

def _update_report(report_id, fields):
    db['generated_reports'].update_one({'_id': ObjectId(report_id)}, {'$set': {**fields, 'updated_at': datetime.now(timeZ.utc)}})

def _extract_range(date_filter):
    start_dt_utc = end_dt_utc = None
    if isinstance(date_filter, dict):
        dt_part = date_filter.get('date_time') or {}
        if isinstance(dt_part, dict):
            start_dt_utc = dt_part.get('$gte')
            end_dt_utc = dt_part.get('$lte') or dt_part.get('$lt')
    if start_dt_utc and not end_dt_utc:
        end_dt_utc = datetime.now(timeZ.utc)
    return start_dt_utc, end_dt_utc

def save_and_return_report(output, report_type, vehicle_number, override_user_id, date_filter=None):
    print(f"[DEBUG] Entering save_and_return_report with report_type={report_type}, vehicle_number={vehicle_number}")
    user_id = override_user_id

    start_dt_utc = end_dt_utc = None
    if isinstance(date_filter, dict):
        dt_part = date_filter.get('date_time') or {}
        if isinstance(dt_part, dict):
            start_dt_utc = dt_part.get('$gte')
            end_dt_utc = dt_part.get('$lte') or dt_part.get('$lt')

    if start_dt_utc and not end_dt_utc:
        end_dt_utc = datetime.now(timeZ.utc)

    def _fmt(dt):
        if isinstance(dt, datetime):
            try:
                return dt.astimezone(IST).strftime('%d-%b-%Y_%H-%M-%S')
            except Exception:
                return "NA"
        return "NA"

    start_str = _fmt(start_dt_utc) if start_dt_utc else "NA"
    end_str = _fmt(end_dt_utc) if end_dt_utc else "NA"

    base_vehicle = vehicle_number if vehicle_number != 'all' else 'ALL_VEHICLES'
    if start_str != "NA" or end_str != "NA":
        report_filename = f"{report_type}_report_{base_vehicle}_{start_str}_to_{end_str}.json"
    else:
        report_filename = f"{report_type}_report_{base_vehicle}.json"

    remote_path = f"reports/{user_id}/{report_filename}"
    print(f"[DEBUG] Generated report filename: {report_filename}")
    print(f"[DEBUG] Uploading report to remote path: {remote_path}")

    payload_bytes = json.dumps({"data": output}, ensure_ascii=False, default=str).encode('utf-8')
    size_bytes = len(payload_bytes)
    buffer_content = BytesIO(payload_bytes)
    buffer_content.seek(0)
    s3.upload_fileobj(buffer_content, SPACE_NAME, remote_path)
    buffer_content.close()

    report_metadata = {
        'user_id': user_id,
        'report_name': report_type.replace('-', ' ').title() + ' Report',
        'filename': report_filename,
        'path': remote_path,
        'size': size_bytes,
        'generated_at': datetime.now(pytz.UTC),
        'vehicle_number': vehicle_number,
        'report_type': report_type,
        'range_start_utc': start_dt_utc,
        'range_end_utc': end_dt_utc
    }
    db['generated_reports'].insert_one(report_metadata)
    print(f"[DEBUG] Report metadata saved to MongoDB: {report_metadata}")
    return report_filename

def process_df(df, license_plate, fields, post_process=None):
    print(f"[DEBUG] [process_df] Starting for license_plate={license_plate} with fields={fields}")

    if df.empty:
        print(f"[DEBUG] [process_df] DataFrame is empty. Returning None.")
        return None
    
    print(f"[DEBUG] [process_df] Starting Location column block A")
    if 'latitude' in df.columns and 'longitude' in df.columns:
        df['latitude'] = pd.to_numeric(df['latitude'], errors='coerce').round(3)
        df['longitude'] = pd.to_numeric(df['longitude'], errors='coerce').round(3)
    print(f"[DEBUG] [process_df] Location column block A has finished executing")

    print(f"[DEBUG] [process_df] Starting Vehicle Number column block")
    if 'Vehicle Number' not in df.columns:
        df.insert(0, 'Vehicle Number', license_plate)
        print(f"[DEBUG] [process_df] Vehicle Number column block has finished executing")

    print(f"[DEBUG] [process_df] Starting _id column drop block")
    if '_id' in df.columns:
        df.drop('_id', axis=1, inplace=True)
        print(f"[DEBUG] [process_df] _id column drop block has finished executing")

    print(f"[DEBUG] [process_df] Starting ignition column block")
    if "ignition" in fields:
        df['ignition'] = df['ignition'].replace({"0": "OFF", "1": "ON"})
        print(f"[DEBUG] [process_df] ignition column block has finished executing")

    print(f"[DEBUG] [process_df] Starting post_process block")
    if post_process:
        df = post_process(df)
        print(f"[DEBUG] [process_df] post_process block has finished executing")

    print(f"[DEBUG] [process_df] Starting date_time formatting block")
    if 'date_time' in df.columns:
        df['date_time'] = df['date_time'].dt.tz_convert(IST).dt.strftime('%d-%b-%Y %I:%M:%S %p')
        print(f"[DEBUG] [process_df] date_time formatting block has finished executing")

    print(f"[DEBUG] [process_df] DataFrame processing complete")
    return df

def get_date_range_filter(date_range, from_date=None, to_date=None):
    print(f"[DEBUG] Generating date range filter for date_range={date_range}, from_date={from_date}, to_date={to_date}")
    tz = pytz.UTC
    now = datetime.now(tz)

    if date_range == "last24hours":
        return {'date_time': {'$gte': now - timedelta(hours=24)}}
    elif date_range == "today":
        today_start = datetime(now.year, now.month, now.day, tzinfo=tz)
        return {'date_time': {'$gte': today_start}}
    elif date_range == "yesterday":
        ist = timezone('Asia/Kolkata')
        now_ist = datetime.now(ist)
        today_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
        yesterday_start_ist = today_ist - timedelta(days=1)
        yesterday_end_ist = today_ist
        yesterday_start_utc = yesterday_start_ist.astimezone(pytz.UTC)
        yesterday_end_utc = yesterday_end_ist.astimezone(pytz.UTC)
        return {'date_time': {'$gte': yesterday_start_utc, '$lt': yesterday_end_utc}}
    elif date_range == "last7days":
        return {'date_time': {'$gte': now - timedelta(days=7)}}
    elif date_range == "last30days":
        return {'date_time': {'$gte': now - timedelta(days=30)}}
    elif date_range == "custom" and from_date and to_date:
        try:
            from_datetime = datetime.strptime(from_date, "%Y-%m-%dT%H:%M").replace(tzinfo=tz)
            to_datetime = datetime.strptime(to_date, "%Y-%m-%dT%H:%M").replace(tzinfo=tz)
            three_months_ago = now - timedelta(days=90)
            if from_datetime < three_months_ago or to_datetime < three_months_ago:
                raise ValueError("Date range cannot be older than 3 months")
            if from_datetime > to_datetime:
                raise ValueError("From date cannot be after To date")
            return {'date_time': {'$gte': from_datetime, '$lte': to_datetime}}
        except ValueError as e:
            raise ValueError(f"Invalid custom date range: {str(e)}")
    return {}


def process_panic_report(imei, vehicle_number, date_filter):
    try:
        projection = {'_id': 0}

        query = {'imei': imei}
        query.update(date_filter or {})

        data = list(db['sos_logs'].find(
            query, projection,
        ).sort('date_time', -1))

        if not data:
            return None

        records = []
        for datum in data:
            if datum['latitude'] or datum['latitude'] not in ['', "", None]:
                location = geocodeInternal(float(datum['latitude']), float(datum['longitude']))
                records = {
                    "Vehicle Number": vehicle_number,
                    "Latitude & Longitude": f'{datum['latitude']}, {datum['longitude']}',
                    "DATE & TIME": datum['date_time'].astimezone(IST).strftime('%d-%b-%Y %I:%M:%S %p'),
                    "LOCATION": location
                }
                records.append(record)
        if not records:
            return None
        return pd.DataFrame(records)
    except Exception as e:
        print("[DEBUG] Error generating Idle Report: ", e)
        return e

def process_idle_report(imei, vehicle_number, date_filter):
    try:
        projection = {"_id": 0, "latitude": 1, "longitude": 1, "date_time": 1, "ignition": 1, "speed": 1}
        
        data_asc = getData(imei, date_filter, projection)
        
        if not data_asc:
            return None

        current_start = None
        last_zero_time = None
        start_lat = None
        start_lng = None
        dfs = []

        def push_block(start_dt, end_dt, lat, lng):
            if not start_dt or not end_dt:
                return
            duration_min = round(((end_dt - start_dt).total_seconds() / 60.0), 2)
            if duration_min < 0:
                return
            if lat is not None and lng is not None:
                try:
                    resolved = geocodeInternal(float(lat), float(lng))
                except Exception:
                    resolved = "Location Not Available"
            else:
                resolved = "Location Not Available"
            df = pd.DataFrame([{
                "Vehicle Number": vehicle_number,
                "FROM DATE & TIME": start_dt.astimezone(IST).strftime('%d-%b-%Y %I:%M:%S %p'),
                "TO DATE & TIME": end_dt.astimezone(IST).strftime('%d-%b-%Y %I:%M:%S %p'),
                "DURATION (min)": duration_min,
                "LOCATION": resolved
            }])
            dfs.append(df)

        for rec in data_asc:
            ign = str(rec.get('ignition', '')).strip()
            speed = float(rec.get('speed', 0))
            ts = rec.get('date_time')
            lat = rec.get('latitude') if rec.get('latitude') not in ("", None) else None
            lng = rec.get('longitude') if rec.get('longitude') not in ("", None) else None

            if ign == "1" and speed == 0.00:
                if current_start is None:
                    current_start = ts
                    last_zero_time = ts
                    start_lat, start_lng = (lat, lng) if (lat is not None and lng is not None) else (None, None)
                else:
                    last_zero_time = ts
                    if start_lat is None and lat is not None and lng is not None:
                        start_lat, start_lng = lat, lng
            else:
                if current_start is not None and last_zero_time is not None:
                    push_block(current_start, last_zero_time, start_lat, start_lng)
                current_start = None
                last_zero_time = None
                start_lat = None
                start_lng = None

        if current_start is not None and last_zero_time is not None:
            push_block(current_start, last_zero_time, start_lat, start_lng)

        if not dfs:
            return None
        return pd.concat(dfs, ignore_index=True)
    except Exception as e:
        print("[DEBUG] Error generating Idle Report: ", e)
        return e

def process_daily_report(imei, vehicle_doc, date_filter):

    try:
        projection = {
                "_id": 0,
                "date_time": 1,
                "ignition": 1,
                "speed": 1,
                "odometer": 1,
                "latitude": 1,
                "longitude": 1
            }

        records = getData(imei, date_filter, projection)
        if not records:
            return None

        # Thresholds (fallbacks if missing in inventory record)
        normal_speed = float(vehicle_doc.get("normalSpeed") or vehicle_doc.get("normal_speed") or 60)
        license_plate = vehicle_doc.get("LicensePlateNumber", "")

        tz_ist = IST

        # Bucket records by IST date
        from collections import defaultdict
        day_buckets = defaultdict(list)
        for r in records:
            dt = r.get("date_time")
            if not dt:
                continue
            dt_ist = dt.astimezone(tz_ist)
            r["_dt_ist"] = dt_ist
            r["_date_key"] = dt_ist.date()
            # Normalize numeric
            try:
                r["_speed_f"] = float(r.get("speed", 0) or 0)
            except:
                r["_speed_f"] = 0.0
            try:
                r["_odo_f"] = float(r.get("odometer", 0) or 0)
            except:
                r["_odo_f"] = None
            day_buckets[r["_date_key"]].append(r)

        rows = []
        for day, recs in sorted(day_buckets.items()):
            if not recs:
                continue
            # First ignition ON record
            first_on = next((r for r in recs if str(r.get("ignition", "")).strip() == "1"), None)
            # Last ignition OFF record (search from end)
            last_off = None
            for r in reversed(recs):
                if str(r.get("ignition", "")).strip() == "0":
                    last_off = r
                    break
            # Fallbacks
            first_on = first_on or recs[0]
            last_off = last_off or recs[-1]

            # Odometer start/end
            odo_start = first_on.get("_odo_f")
            odo_end = last_off.get("_odo_f")
            distance = None
            if odo_start is not None and odo_end is not None:
                diff = odo_end - odo_start
                if diff >= 0:
                    distance = round(diff, 2)

            # Locations
            start_loc = safe_geocode(first_on.get("latitude"), first_on.get("longitude"))
            stop_loc = safe_geocode(last_off.get("latitude"), last_off.get("longitude"))

            # Speed stats
            speeds = [r["_speed_f"] for r in recs if r["_speed_f"] is not None]
            avg_speed = round(sum(s for s in speeds if s > 0) / len([s for s in speeds if s > 0]), 2) if any(s > 0 for s in speeds) else 0.0
            max_speed = round(max(speeds), 2) if speeds else 0.0

            # Way points
            total_way_points = len(recs)

            # Durations
            running_seconds = 0
            idle_seconds = 0
            stoppage_seconds = 0
            overspeed_seconds = 0
            overspeed_count = 0

            prev = None
            for r in recs:
                if prev:
                    delta = (r["_dt_ist"] - prev["_dt_ist"]).total_seconds()
                    if delta < 0:
                        delta = 0
                    prev_ign = str(prev.get("ignition", "")).strip()
                    prev_speed = prev["_speed_f"]
                    # Running
                    if prev_ign == "1" and prev_speed > 0:
                        running_seconds += delta
                    # Idle
                    if prev_ign == "1" and prev_speed == 0:
                        idle_seconds += delta
                    # Stoppage
                    if prev_ign == "0":
                        stoppage_seconds += delta
                    # Overspeed
                    if prev_speed >= normal_speed:
                        overspeed_seconds += delta
                prev = r

            # Overspeed count (number of records with speed >= threshold)
            overspeed_count = sum(1 for r in recs if r["_speed_f"] >= normal_speed)

            row = {
                "Vehicle Number": license_plate,
                "Date": day.strftime("%Y-%m-%d"),
                "First Ignition On": first_on["_dt_ist"].strftime('%Y-%m-%d %H:%M:%S'),
                "Odometer Start": odo_start if odo_start is not None else "",
                "Start Location": start_loc,
                "Last Ignition Off": last_off["_dt_ist"].strftime('%Y-%m-%d %H:%M:%S'),
                "Odometer End": odo_end if odo_end is not None else "",
                "Stop Location": stop_loc,
                "Avg Speed": avg_speed,
                "Max Speed": max_speed,
                "Over Speed Count": overspeed_count,
                "Running Time": format_duration_hms(running_seconds),
                "Overspeed Duration": format_duration_hms(overspeed_seconds),
                "Idle Time": format_duration_hms(idle_seconds),
                "Stoppage Time": format_duration_hms(stoppage_seconds),
                "Distance": distance if distance is not None else "",
                "Total Way Points": total_way_points
            }
            rows.append(row)

        if not rows:
            return None
        return pd.DataFrame(rows)
    except Exception as e:
        print("[DEBUG] Error generating Daily Report: ", e)
        return None

def process_stoppage_report(imei, vehicle_number, date_filter):
    try:
        projection = {"_id": 0, "latitude": 1, "longitude": 1, "date_time": 1, "ignition": 1}
        
        data_asc = getData(imei, date_filter, projection)
        
        if not data_asc:
            return None

        current_start = None
        last_zero_time = None
        start_lat = None
        start_lng = None
        dfs = []

        def push_block(start_dt, end_dt, lat, lng):
            if not start_dt or not end_dt:
                return
            duration_min = round(((end_dt - start_dt).total_seconds() / 60.0), 2)
            if duration_min < 0:
                return
            if lat is not None and lng is not None:
                try:
                    resolved = geocodeInternal(float(lat), float(lng))
                except Exception:
                    resolved = "Location Not Available"
            else:
                resolved = "Location Not Available"
            df = pd.DataFrame([{
                "Vehicle Number": vehicle_number,
                "FROM DATE & TIME": start_dt.astimezone(IST).strftime('%d-%b-%Y %I:%M:%S %p'),
                "TO DATE & TIME": end_dt.astimezone(IST).strftime('%d-%b-%Y %I:%M:%S %p'),
                "DURATION (min)": duration_min,
                "LOCATION": resolved
            }])
            dfs.append(df)

        for rec in data_asc:
            ign = str(rec.get('ignition', '')).strip()
            ts = rec.get('date_time')
            lat = rec.get('latitude') if rec.get('latitude') not in ("", None) else None
            lng = rec.get('longitude') if rec.get('longitude') not in ("", None) else None

            if ign == "0":
                if current_start is None:
                    current_start = ts
                    last_zero_time = ts
                    start_lat, start_lng = (lat, lng) if (lat is not None and lng is not None) else (None, None)
                else:
                    last_zero_time = ts
                    if start_lat is None and lat is not None and lng is not None:
                        start_lat, start_lng = lat, lng
            else:
                if current_start is not None and last_zero_time is not None:
                    push_block(current_start, last_zero_time, start_lat, start_lng)
                current_start = None
                last_zero_time = None
                start_lat = None
                start_lng = None

        if current_start is not None and last_zero_time is not None:
            push_block(current_start, last_zero_time, start_lat, start_lng)

        if not dfs:
            return None
        return pd.concat(dfs, ignore_index=True)
    except Exception as e:
        print("[DEBUG] Error generating Stoppage Report: ", e)
        return e
    
def process_ignition_report(imei, vehicle_number, date_filter):
    try:
        projection = {"_id": 0, "latitude": 1, "longitude": 1, "date_time": 1, "ignition": 1, "odometer": 1}
        
        data_asc = getData(imei, date_filter, projection)

        if not data_asc:
            return None

        dfs = []
        current_start = None
        start_lat = start_lng = None
        last_valid_lat = last_valid_lng = None

        def push_block(start_dt, stop_dt_calc, s_lat, s_lng, e_lat, e_lng, start_odo, end_odo, ongoing=False):
            if not start_dt or not stop_dt_calc:
                return
            duration_min = round((stop_dt_calc - start_dt).total_seconds() / 60.0, 2)
            if duration_min < 0:
                return
            start_resolved = safe_geocode(s_lat, s_lng)
            end_resolved = safe_geocode(e_lat, e_lng)
            distance = float(end_odo) - float(start_odo)
            stop_display = "ONGOING" if ongoing else stop_dt_calc.astimezone(IST).strftime('%d-%b-%Y %I:%M:%S %p')
            df = pd.DataFrame([{
                "Vehicle Number": vehicle_number,
                "START DATE & TIME": start_dt.astimezone(IST).strftime('%d-%b-%Y %I:%M:%S %p'),
                "START LOCATION": start_resolved,
                "STOP DATE & TIME": stop_display,
                "STOP LOCATION": end_resolved,
                "DURATION (min)": duration_min,
                "DISTANCE (km)": distance
            }])
            dfs.append(df)

        for rec in data_asc:
            ign = str(rec.get("ignition", "")).strip()
            ts = rec.get("date_time")
            lat = rec.get("latitude") if rec.get("latitude") not in ("", None) else None
            lng = rec.get("longitude") if rec.get("longitude") not in ("", None) else None
            odo = rec.get("odometer")

            if ign == "1":
                if current_start is None:
                    current_start = ts
                    start_lat, start_lng = lat, lng
                    last_valid_lat, last_valid_lng = lat, lng
                    start_odo = odo
                else:
                    if lat is not None and lng is not None:
                        last_valid_lat, last_valid_lng = lat, lng
                    end_odo = odo
            else:
                if current_start is not None:
                    end_lat = last_valid_lat if last_valid_lat is not None else start_lat
                    end_lng = last_valid_lng if last_valid_lng is not None else start_lng
                    end_odo = odo
                    push_block(current_start, ts, start_lat, start_lng, end_lat, end_lng, start_odo, end_odo, ongoing=False)
                    current_start = None
                    start_lat = start_lng = None
                    last_valid_lat = last_valid_lng = None
                    start_odo = end_odo = None

        if current_start is not None:
            calc_stop = datetime.now(pytz.UTC)
            end_lat = last_valid_lat if last_valid_lat is not None else start_lat
            end_lng = last_valid_lng if last_valid_lng is not None else start_lng
            push_block(current_start, calc_stop, start_lat, start_lng, end_lat, end_lng, start_odo, end_odo, ongoing=True)

        if not dfs:
            return None
        return pd.concat(dfs, ignore_index=True)
    except Exception as e:
        print("[DEBUG] Error generating Ignition Report: ", e)
        return e

def process_distance_report(imei, vehicle_number, date_filter):
    """Calculate total distance traveled"""
    try:
        start_doc, end_doc = getDataForDistanceReport(imei, date_filter)
        
        if not start_doc or not end_doc:
            return None
        
        start_location = safe_geocode(start_doc['latitude'], start_doc['longitude'])
        end_location = safe_geocode(end_doc['latitude'], end_doc['longitude'])
        
        start_odometer = start_doc["odometer"]
        end_odometer = end_doc["odometer"]
        
        
        total_distance = abs(float(end_odometer) - float(start_odometer))
        
        summary_df = pd.DataFrame({
            'Vehicle Number': [vehicle_number],
            'Total Distance (km)': [total_distance],
            'Start Odometer': [start_odometer],
            'Start Location': [start_location],
            'End Odometer': [end_odometer],
            'End Location': [end_location]
        })

        summary_df = summary_df[['Vehicle Number', 'Total Distance (km)', 'Start Odometer','Start Location', 
                                 'End Odometer', 'End Location']]
        
        return summary_df
    except Exception as e:
        print(e)
        return e

def process_travel_path_report(df):
    try:
        if 'odometer' in df.columns and not df.empty:
            df['odometer'] = pd.to_numeric(df['odometer'], errors='coerce')
            df['distance'] = df['odometer'].diff().fillna(0).abs()
            df['distance'] = df['distance'].cumsum()
            df['distance'] = pd.to_numeric(df['distance'], errors='coerce').round(3)
            
        return df
    except:
        return   

def process_duration_report(df, duration_col_name):
    """Calculate duration between records in minutes"""
    try:
        df['date_time'] = pd.to_datetime(df['date_time'])

        df['time_diff'] = df['date_time'].diff().dt.total_seconds().div(60).fillna(0)
        df[duration_col_name] = df['time_diff'].cumsum()

        df.drop('time_diff', axis=1, inplace=True)
        return df
    except Exception:
        return df   
    
def add_speed_metrics(rows):
    try:
        if not rows:
            return rows
        
        speeds = []
        for r in rows:
            value = r.get('speed')
            
            if value in (None, "", " "):
                value = 0
            
            value = float(value)
            speeds.append(value)
            
        if not speeds:
            return rows
        
        avg_speed = round(sum(speeds) / len(speeds), 2)
        max_speed = round(max(speeds), 2)
        
        columns = list(rows[0].keys())
        
        summary = OrderedDict()
        
        summary[columns[0]] = "Average Speed"
        summary[columns[1]] = avg_speed
        summary[columns[2]] = "Maximum Speed"
        summary[columns[3]] = max_speed
        for i in range(4, len(columns)):
            summary[columns[i]] = ""
            
        return rows + [summary]
    except Exception as e:
        print(f"[DEBUG] Skipping speed summary (single): {e}")
        return e

def process_speed_report(imei, vehicle, date_filter):
    try:
        projection = {"imei": 1, "speed": 1, "date_time": 1, "latitude": 1, "longitude": 1}
     
        speedThreshold = float(vehicle.get('normalSpeed', 60))
        
        data = getData(imei, date_filter, projection, speedThreshold)
        
        if not data: 
            return None
        
        rows =[]
        
        vehicle_number = vehicle["LicensePlateNumber"]
        for doc in data:
            
            lat = doc.get("latitude") if doc.get("latitude") not in ("", None) else None
            lng = doc.get("longitude") if doc.get("longitude") not in ("", None) else None
            
            if not lat or not lng:
                continue
            
            location = safe_geocode(lat, lng)
            
            rows.append({
                "Vehicle Number": vehicle_number,
                "DATE & TIME": doc.get('date_time').astimezone(IST).strftime('%d-%b-%Y %I:%M:%S %p'),
                "Latitude & Longitude": f'{round(float(lat), 4)}, {round(float(lng), 4)}',
                "LOCATION": location,
                "SPEED": doc.get('speed', '')
            })

        if not rows:
            return None
        
        return pd.DataFrame(rows)
    except Exception as e:
        print(e)
        return e

@reports_bp.route('/')
@jwt_required()
def index():
    print("[DEBUG] Accessing index endpoint")
    claims = get_jwt()
    user_roles = claims.get('roles', [])
    print(f"[DEBUG] User roles: {user_roles}")

    if 'admin' in user_roles:
        vehicles = list(db['vehicle_inventory'].find({}, {"LicensePlateNumber": 1, "_id": 0}))
        reports = []
        return render_template('allReport.html', vehicles=vehicles, reports=reports)
    if 'clientAdmin' in user_roles:
        userCompany = claims.get('company')
        userCompanyID = claims.get('company_id')
        vehicles = list(db['vehicle_inventory'].find({"CompanyName": userCompany}, {"LicensePlateNumber": 1, "_id": 0}))
        reports = []
        return render_template('allReport.html', vehicles=vehicles, reports=reports)
    else:
        userCompany = claims.get('company')
        userName = claims.get('username')
        vehicles = list(db['vehicle_inventory'].find({"CompanyName": userCompany}, {"LicensePlateNumber": 1, "_id": 0}))
        reports = []
        return render_template('allReport.html', vehicles=vehicles, reports=reports)
 
REPORT_PROCESSORS = {
    "stoppage": process_stoppage_report,
    "idle": process_idle_report,
    "ignition": process_ignition_report,
    "distance-speed-range": process_speed_report,
}   

def _build_report_sync(report_type, vehicle_number, date_filter, claims, on_progress=None):
    def report_progress(pct):
        try:
            if on_progress:
                on_progress(max(0, min(100, int(pct))))
        except Exception:
            pass
        
    try:
        report_progress(0)
        rows = []
        
        if vehicle_number == "all":
            vehicles = list(get_vehicle_data_for_claims(claims))

            imei_to_plate = {v["IMEI"]: v for v in vehicles if v.get("IMEI") and v.get("LicensePlateNumber")}
            imeis = list(imei_to_plate.keys())
            total = max(1, len(imeis))
            all_dfs = []

            if report_type not in report_configs:
                raise ValueError(f"Invalid report type: {report_type}")
            
            post_process = None
                    
            if report_type == "daily":
                for idx, imei in enumerate(imeis):
                    vdoc = imei_to_plate.get(imei, {})
                    df = process_daily_report(imei, vdoc, date_filter)
                    
                    if isinstance(df, Exception):
                        raise df
                    
                    if df is None or df.empty:
                        report_progress(((idx + 1) / total) * 100)
                        continue
                    # separator after first
                    if idx > 0:
                        sep_df = pd.DataFrame([{
                            "Vehicle Number": f"--- {vdoc.get('LicensePlateNumber','')} ---",
                            "Date": "", "First Ignition On": "", "Odometer Start": "",
                            "Start Location": "", "Last Ignition Off": "", "Odometer End": "",
                            "Stop Location": "", "Avg Speed": "", "Max Speed": "",
                            "Over Speed Count": "", "Running Time": "", "Overspeed Duration": "",
                            "Idle Time": "", "Stoppage Time": "", "Distance": "", "Total Way Points": ""
                        }])
                        all_dfs.append(sep_df)
                    all_dfs.append(df)
                    report_progress(((idx + 1) / total) * 100)
                if not all_dfs:
                    raise ValueError(f"No Data Found")
                final_df = pd.concat(all_dfs, ignore_index=True)
                desired_cols = [
                    "Vehicle Number","Date","First Ignition On","Odometer Start","Start Location",
                    "Last Ignition Off","Odometer End","Stop Location","Avg Speed","Max Speed",
                    "Over Speed Count","Running Time","Overspeed Duration","Idle Time",
                    "Stoppage Time","Distance","Total Way Points"
                ]
                existing = [c for c in desired_cols if c in final_df.columns]
                final_df = final_df[existing]
                data_records = final_df.fillna("").to_dict(orient="records")
                return data_records
            
            elif report_type == 'panic':
                for idx, imei in enumerate(imeis):
                    vehicle = imei_to_plate.get(imei, "")
                    
                    if vehicle:
                        license_plate = vehicle["LicensePlateNumber"]
                    else:
                        license_plate = ""
                        
                    dfs = process_panic_report(imei, license_plate, date_filter)
                    
                    if isinstance(dfs, Exception):
                        raise dfs
                    
                    if dfs is None or dfs.empty:
                        report_progress(((idx + 1) / total) * 100)
                        continue
                    
                    all_dfs.append(dfs)
                    report_progress(((idx + 1) / total) * 100)
            
            elif report_type == "odometer-daily-distance":
                config = report_configs[report_type]
                fields = config['fields']
                for idx, imei in enumerate(imeis):
                    vehicle = imei_to_plate.get(imei, "")
                    
                    if vehicle:
                        license_plate = vehicle["LicensePlateNumber"]
                    else:
                        license_plate = ""
                    
                    df = process_distance_report(imei, license_plate, date_filter)
                    
                    if isinstance(df, Exception):
                        raise df
                    
                    if df is None or df.empty:
                        report_progress(((idx + 1) / total) * 100)
                        continue
                    all_dfs.append(df)
                    report_progress(((idx + 1) / total) * 100)
                    
            elif report_type in ("stoppage", "idle", "ignition"):
                config = report_configs[report_type]
                fields = config['fields']
                for idx, imei in enumerate(imeis):
                    vehicle = imei_to_plate.get(imei, "")
                    
                    if vehicle:
                        license_plate = vehicle["LicensePlateNumber"]
                    else:
                        license_plate = ""
                    
                    func = REPORT_PROCESSORS.get(report_type)
                    
                    df = func(imei, license_plate, date_filter)
                    
                    if isinstance(df, Exception):
                        raise df

                    if df is None or not isinstance(df, pd.DataFrame) or df.empty:
                        report_progress(((idx + 1) / total) * 100)
                        continue
                    
                    if idx > 0:
                        if report_type != "ignition":
                            sep_dict= pd.DataFrame([{ 
                                    "Vehicle Number": f"--- {license_plate} ---",
                                    "FROM DATE & TIME": "",	
                                    "TO DATE & TIME": "",	
                                    "DURATION (min)": "",
                                    "LOCATION": ""
                                }])
                        else:
                            sep_dict = pd.DataFrame([{
                                    "Vehicle Number": f"--- {license_plate} ---",
                                    "START DATE & TIME": "",
                                    "START LOCATION": "",
                                    "STOP DATE & TIME": "",
                                    "STOP LOCATION": "",
                                    "DURATION (min)": "",
                                    "DISTANCE (km)": ""
                                }])
                        all_dfs.append(sep_dict)
                    all_dfs.append(df)
                    report_progress(((idx + 1) / total) * 100)
                    
            elif report_type == "distance-speed-range":
                config = report_configs[report_type]
                fields = config['fields']
                
                for idx, imei in enumerate(imeis):
                    vehicle = imei_to_plate.get(imei, "")
                    
                    if vehicle:
                        license_plate = vehicle["LicensePlateNumber"]
                    else:
                        license_plate = ""
                    
                    func = REPORT_PROCESSORS.get(report_type)
                    
                    df = func(imei, vehicle, date_filter)
                    
                    if isinstance(df, Exception):
                        raise df
                    
                    if not isinstance(df, pd.DataFrame) or df.empty:
                        report_progress(((idx + 1) / total) * 100)
                        continue
                    
                    if idx > 0:
                        sep_dict = pd.DataFrame([{
                                "Vehicle Number": f"--- {license_plate} ---",
                                "DATE & TIME": "",
                                "Latitude & Longitude": "",
                                "LOCATION": "",
                                "SPEED": "",
                            }])
                        all_dfs.append(sep_dict)
                    all_dfs.append(df)
                    report_progress(((idx + 1) / total) * 100)
            else:
                config = report_configs[report_type]
                fields = config['fields']
                post_process = config.get('post_process')

                projection = {field: 1 for field in fields + ["imei"]}
                
                docs = []
                
                for idx, imei in enumerate(imeis):
                    records = getData(imei, date_filter, projection)
                    print(f"[DEBUG] [process_df] Starting Location column block")
                    for record in records:
                        
                        lat = record.get("latitude") if record.get("latitude") not in ("", None) else None
                        lng = record.get("longitude") if record.get("longitude") not in ("", None) else None
                        
                        location = safe_geocode(lat, lng)
                        
                        record['Location'] = location
                        
                        docs.append(record)
                    report_progress((((idx + 1)/2) / total) * 100)
                    print(f"[DEBUG] [process_df] Location column block has finished executing")
                df = pd.DataFrame(docs)

                if not df.empty:
                    for idx, (imei, group) in enumerate(df.groupby("imei")):
                        vehicle = imei_to_plate.get(imei, "")

                        if vehicle:
                            license_plate = vehicle["LicensePlateNumber"]
                        else:
                            license_plate = ""

                        group = group.drop(columns=["imei"])

                        processed = process_df(group, license_plate, fields, (lambda d: post_process(d, license_plate)) if post_process else None)
                        
                        if isinstance(processed, Exception):
                            raise df
                        
                        print(report_type)
                        if processed is not None:
                            sep_dict = OrderedDict((col, "" ) for col in processed.columns)
                            sep_dict[processed.columns[0]] = f"--- {license_plate} ---"
                            all_dfs.append(pd.DataFrame([sep_dict]))
                            all_dfs.append(processed)
                        report_progress(((idx + 1) / total) * 100)

            if not all_dfs:
                raise ValueError(f"No Data Found")

            final_df = pd.concat(all_dfs, ignore_index=True)

            all_possible_columns = ['Vehicle Number']
            if report_type == 'odometer-daily-distance':
                all_possible_columns.extend(['Total Distance (km)', 'Start Odometer','Start Location', 
                                 'End Odometer', 'End Location'])
            elif report_type == 'stoppage' or report_type == 'idle':
                all_possible_columns.extend(['FROM DATE & TIME', 'TO DATE & TIME', 'DURATION (min)', 'LOCATION'])
            elif report_type == 'ignition':
                all_possible_columns.extend([
                    'START DATE & TIME', 'START LOCATION', 'STOP DATE & TIME', 'STOP LOCATION',
                    'DURATION (min)', 'DISTANCE (km)'
                ])
            elif report_type == 'distance-speed-range':
                all_possible_columns.extend(["DATE & TIME", "Latitude & Longitude", "LOCATION", "SPEED"])
            elif report_type == 'panic':
                all_possible_columns.extend(["Latitude & Longitude", "DATE & TIME", "LOCATION"])
            else:
                if report_type == 'daily-distance':
                    all_possible_columns.extend(['date_time', 'odometer', 'distance', 'latitude', 'longitude', 'Location', 'speed'])
                else:
                    all_possible_columns.extend(['date_time', 'latitude', 'longitude', 'Location', 'speed', 'Average Speed', 'Maximum Speed'])
                    if report_type == 'daily':
                        all_possible_columns.append('odometer')

            existing_columns = [col for col in all_possible_columns if col in final_df.columns]
            final_df = final_df[existing_columns]

            data_records = final_df.fillna("").to_dict(orient="records")
            ordered_data = [OrderedDict((col, row.get(col, "")) for col in existing_columns) for row in data_records]
            
            if 'speed' in existing_columns:
                ordered_data = add_speed_metrics(ordered_data)

            report_progress(100)
            return ordered_data

        # Single vehicle
        vehicle = db['vehicle_inventory'].find_one(
            {"LicensePlateNumber": vehicle_number}
        )
        if not vehicle:
            raise ValueError(f"Invalid Vehicle: {vehicle_number}")

        imei = vehicle["IMEI"]
        license_plate = vehicle["LicensePlateNumber"]

        if report_type not in report_configs:
            raise ValueError(f"Invalid report type: {report_type}")
        
        post_process = None
        
        if report_type == "daily":
            df = process_daily_report(imei, vehicle, date_filter)
            if isinstance(df, Exception):
                raise df
            
            if df is None or df.empty:
                raise ValueError(f"No Data Found")
            desired_cols = [
                "Vehicle Number","Date","First Ignition On","Odometer Start","Start Location",
                "Last Ignition Off","Odometer End","Stop Location","Avg Speed","Max Speed",
                "Over Speed Count","Running Time","Overspeed Duration","Idle Time",
                "Stoppage Time","Distance","Total Way Points"
            ]
            existing = [c for c in desired_cols if c in df.columns]
            df = df[existing]
            data_records = df.fillna("").to_dict(orient="records")
            return data_records
        elif report_type == 'panic':
            df = process_panic_report(imei, license_plate, date_filter)
            
            if isinstance(df, Exception):
                raise df
        elif report_type == "odometer-daily-distance":
            df = process_distance_report(imei, license_plate, date_filter)
            
            if isinstance(df, Exception):
                raise df
        elif report_type in ("stoppage", "idle", "ignition"):
            func = REPORT_PROCESSORS.get(report_type)
            df = func(imei, license_plate, date_filter)
            
            if isinstance(df, Exception):
                raise df
            
            if not isinstance(df, pd.DataFrame) or df.empty:
                raise ValueError(f"No Data Found")
        elif report_type == "distance-speed-range":
                config = report_configs[report_type]
                fields = config['fields']
                df = process_speed_report(imei, vehicle, date_filter)
                if isinstance(df, Exception):
                    raise df
        else:
            config = report_configs[report_type]
            fields = config['fields']
            post_process = config.get('post_process')
            
            projection = {field: 1 for field in fields}
            
            records = getData(imei, date_filter, projection)
            print(f"[DEBUG] [process_df] Starting Location column block")
            for record in records:
                
                lat = record.get("latitude") if record.get("latitude") not in ("", None) else None
                lng = record.get("longitude") if record.get("longitude") not in ("", None) else None
                
                location = safe_geocode(lat, lng)
                
                record['Location'] = location

            print(f"[DEBUG] [process_df] Location column block has finished executing")

            df = pd.DataFrame(records)
            df = process_df(df, license_plate, fields, (lambda d: post_process(d, license_plate)) if post_process else None)

        
        if df is None or df.empty:
            raise ValueError(f"No Data Found")

        # --- Keep this block as is for column order and JSON output ---
        all_possible_columns = ['Vehicle Number']
        if report_type == 'odometer-daily-distance':
            all_possible_columns.extend(['Total Distance (km)', 'Start Odometer','Start Location', 
                                 'End Odometer', 'End Location'])
        elif report_type == 'stoppage' or report_type == 'idle':
            all_possible_columns.extend(['FROM DATE & TIME', 'TO DATE & TIME', 'DURATION (min)', 'LOCATION'])
        elif report_type == 'ignition':
            all_possible_columns.extend([
                'START DATE & TIME', 'START LOCATION', 'STOP DATE & TIME', 'STOP LOCATION',
                'DURATION (min)', 'DISTANCE (km)'
            ])
        elif report_type == 'distance-speed-range':
            all_possible_columns.extend(["DATE & TIME", "Latitude & Longitude", "LOCATION", "SPEED"])
        elif report_type == 'panic':
            all_possible_columns.extend(["Latitude & Longitude", "DATE & TIME", "LOCATION"])
        else:
            if report_type == 'daily-distance':
                all_possible_columns.extend(['date_time', 'odometer', 'distance', 'latitude', 'longitude', 'Location', 'speed'])
            else:
                all_possible_columns.extend(['date_time', 'latitude', 'longitude', 'Location', 'speed'])
                if report_type == 'daily':
                    all_possible_columns.append('odometer')

        existing_columns = [col for col in all_possible_columns if col in df.columns]
        df = df[existing_columns]

        data_records = df.fillna("").to_dict(orient="records")
        ordered_data = [OrderedDict((col, row.get(col, "")) for col in existing_columns) for row in data_records]

        if 'speed' in existing_columns:
            ordered_data = add_speed_metrics(ordered_data)

        report_progress(100)
        return ordered_data

    except Exception as e:
        print(f"[DEBUG] _build_report_sync error: {e}")
        raise e

@celery_app.task(bind=True)
def generate_report_task(self, params):
    def bump(progress):
        try:
            _update_report(params["report_id"], {'progress': progress, 'status': 'IN_PROGRESS'})
        except Exception:
            pass
        self.update_state(state="STARTED", meta={"progress": progress})

    try:
        bump(5)
        report_type = params["report_type"]
        vehicle_number = params["vehicle_number"]
        claims = params["claims"]
        date_filter = params.get("date_filter") or {}
        user_id = params["user_id"]
        report_id = params["report_id"]
        
        def within(start, end):
            span = max(1, end - start)
            return lambda pct: bump(int(start + (span * (max(0, min(100, int(pct)))) / 100)))

        rows = _build_report_sync(report_type, vehicle_number, date_filter, claims, on_progress=within(5, 60))

        start_dt_utc, end_dt_utc = _extract_range(date_filter)
        base_vehicle = vehicle_number if vehicle_number != 'all' else 'ALL_VEHICLES'
        start_str = start_dt_utc.astimezone(IST).strftime('%d-%b-%Y_%I:%M:%S %p') if isinstance(start_dt_utc, datetime) else "NA"
        end_str = end_dt_utc.astimezone(IST).strftime('%d-%b-%Y_%I:%M:%S %p') if isinstance(end_dt_utc, datetime) else "NA"
        if start_str != "NA" or end_str != "NA":
            report_filename = f"{report_type}_report_{base_vehicle}_{start_str}_to_{end_str}.json"
        else:
            report_filename = f"{report_type}_report_{base_vehicle}.json"
        remote_path = f"reports/{user_id}/{report_filename}"

        payload_bytes = json.dumps({"data": rows}, ensure_ascii=False, default=str).encode('utf-8')
        size_bytes = len(payload_bytes)
        buf = BytesIO(payload_bytes); buf.seek(0)
        s3.upload_fileobj(buf, SPACE_NAME, remote_path)
        buf.close()
        bump(90)

        # 3) Mark success and store metadata
        _update_report(report_id, {
            'status': 'SUCCESS',
            'progress': 100,
            'generated_at': datetime.now(pytz.UTC),
            'filename': report_filename,
            'path': remote_path,
            'size': size_bytes,
            'range_start_utc': start_dt_utc,
            'range_end_utc': end_dt_utc
        })
        self.update_state(state="SUCCESS", meta={"rows": len(rows)})
        return {"rows": len(rows)}

    except Exception as e:
        try:
            _update_report(params.get("report_id"), {
                'status': 'FAILURE',
                'progress': 100,
                'generated_at': datetime.now(pytz.UTC),
                'error_message': str(e)[:500]
            })
        except Exception:
            pass
        raise

@reports_bp.route('/generate_report', methods=['POST'])
@jwt_required()
def generate_report_async():
    body = request.get_json() or {}
    report_type = body.get("reportType")
    vehicle_number = body.get("vehicleNumber")
    date_range = body.get("dateRange", "last24hours")
    from_date = body.get("fromDate")
    to_date = body.get("toDate")

    if not report_type or not vehicle_number:
        return jsonify({"success": False, "message": "Missing reportType or vehicleNumber"}), 400

    date_filter = get_date_range_filter(date_range, from_date, to_date)
    start_dt_utc, end_dt_utc = _extract_range(date_filter)

    claims = get_jwt()
    user_id = get_jwt_identity()

    doc = {
        'user_id': user_id,
        'report_name': report_type.replace('-', ' ').title() + ' Report',
        'report_type': report_type,
        'vehicle_number': vehicle_number,
        'status': 'IN_PROGRESS',
        'progress': 0,
        'created_at': datetime.now(pytz.UTC),
        'updated_at': datetime.now(pytz.UTC),
        'generated_at': None,
        'size': 0,
        'path': None,
        'filename': None,
        'range_start_utc': start_dt_utc,
        'range_end_utc': end_dt_utc,
        'task_id': None,
        'error_message': None
    }
    result = db['generated_reports'].insert_one(doc)
    report_id = str(result.inserted_id)

    task = generate_report_task.delay({
        "report_type": report_type,
        "vehicle_number": vehicle_number,
        "date_filter": date_filter,
        "claims": claims,
        "user_id": user_id,
        "report_id": report_id
    })
    
    _update_report(report_id, {'task_id': task.id})

    return jsonify({"success": True, "task_id": task.id, "report_id": report_id}), 202

@reports_bp.route('/report_status/<task_id>', methods=['GET'])
@jwt_required()
def report_status(task_id):
    async_res = generate_report_task.AsyncResult(task_id)
    state = async_res.state
    info = async_res.info or {}
    progress = 0
    rec = db['generated_reports'].find_one({'task_id': task_id, 'user_id': get_jwt_identity()}, {'progress': 1, 'status': 1, '_id': 0})
    if rec:
        progress = rec.get('progress', 0)
        if rec.get('status') == 'SUCCESS':
            state = "SUCCESS"
            progress = 100
        elif rec.get('status') == 'FAILURE':
            state = "FAILURE"
            progress = 100
    elif state in ("STARTED",):
        progress = info.get("progress", 10)
    elif state == "SUCCESS":
        progress = 100

    resp = {"state": state, "progress": progress}
    if state == "FAILURE":
        resp["error"] = str(info)
    return jsonify(resp)
    
@reports_bp.route('/get_recent_reports', methods=['GET'])
@jwt_required()
def get_recent_reports():
    try:
        date_range = request.args.get('range', 'today')
        now = datetime.now(timeZ.utc)
        if date_range == 'today':
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
            end_date = None
        elif date_range == 'last24hours':
            start_date = now - timedelta(hours=24); end_date = None
        elif date_range == 'yesterday':
            start_date = (now - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
            end_date = start_date + timedelta(hours=24)
        elif date_range == 'last7days':
            start_date = now - timedelta(days=7); end_date = None
        elif date_range == 'last30days':
            start_date = now - timedelta(days=30); end_date = None
        else:
            start_date = now - timedelta(days=1); end_date = None

        q = {'user_id': get_jwt_identity(), 'created_at': {'$gte': start_date}}
        if end_date:
            q['created_at']['$lt'] = end_date

        reports = list(db['generated_reports'].find(
            q,
            {
                '_id': 1, 'report_name': 1, 'report_type': 1, 'vehicle_number': 1,
                'size': 1, 'generated_at': 1, 'created_at': 1, 'status': 1, 'progress': 1,
                'range_start_utc': 1, 'range_end_utc': 1, 'task_id': 1, 'error_message': 1
            }
        ).sort([('updated_at', -1), ('created_at', -1)]).limit(50))

        return jsonify({
            'success': True,
            'reports': [{
                '_id': str(r['_id']),
                'report_name': r.get('report_name', ''),
                'report_type': r.get('report_type', ''),
                'vehicle_number': r.get('vehicle_number', ''),
                'size': r.get('size', 0),
                'generated_at': r.get('generated_at').isoformat() if r.get('generated_at') else None,
                'created_at': r.get('created_at').isoformat() if r.get('created_at') else None,
                'status': r.get('status', 'IN_PROGRESS'),
                'progress': r.get('progress', 0),
                'range_start_utc': r.get('range_start_utc'),
                'range_end_utc': r.get('range_end_utc'),
                'task_id': r.get('task_id'),
                'error_message': r.get('error_message')
            } for r in reports]
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    
@reports_bp.route('/download_report/<report_id>', methods=['GET'])
@jwt_required()
def download_report(report_id):
    try:
        report = db['generated_reports'].find_one({
            '_id': ObjectId(report_id),
            'user_id': get_jwt_identity()
        })
        
        if not report:
            return jsonify({'success': False, 'message': 'Report not found'}), 404

        file_path = report['path'] 

        output = BytesIO()
        s3.download_fileobj(SPACE_NAME, file_path, output)
        output.seek(0)

        output.seek(0)
        json_data = json.load(output)
        data = json_data.get("data", [])

        df = pd.DataFrame(data)
        excel_buffer = BytesIO()
        with pd.ExcelWriter(excel_buffer, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Report')
        excel_buffer.seek(0)

        xlsx_name = os.path.splitext(report['filename'])[0] + '.xlsx'

        return send_file(
            excel_buffer,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            as_attachment=True,
            download_name=xlsx_name
        )
    except Exception as e:
        print(f"[DEBUG] Error sending file for download, {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    
@reports_bp.route('/view_report/<report_id>', methods=['GET'])
@jwt_required()
def view_report(report_id):
    try:
        meta = db['generated_reports'].find_one({
            '_id': ObjectId(report_id),
            'user_id': get_jwt_identity()
        })
        if not meta:
            return jsonify({"success": False, "message": "Report not found"}), 404

        buf = BytesIO()
        s3.download_fileobj(SPACE_NAME, meta['path'], buf)
        buf.seek(0)
        try:
            payload = json.load(buf)
        except Exception:
            return jsonify({"success": False, "message": "Corrupt report file"}), 500
        rows = payload.get("data", [])
        return jsonify({
            "success": True,
            "metadata": {
                "report_name": meta['report_name'],
                "generated_at": meta['generated_at'].isoformat(),
                "vehicle_number": meta.get('vehicle_number', ''),
                "size": meta.get('size', 0),
                "report_type": meta.get('report_type')
            },
            "data": rows
        })
    except Exception as e:
        print("[DEBUG] view_report error:", e)
        return jsonify({"success": False, "message": str(e)}), 500