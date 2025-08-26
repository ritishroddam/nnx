
from datetime import datetime, timezone, timedelta
from app.geocoding import geocodeInternal

def _convert_date_time_emit(date):
    if not date:
        now = datetime.now(timezone(timedelta(hours=5, minutes=30)))
        return now.strftime("%d%m%y"), now.strftime("%H%M%S")
    # Convert UTC datetime to IST (UTC+5:30)
    ist = date.astimezone(timezone(timedelta(hours=5, minutes=30)))
    return ist.strftime("%d%m%y"), ist.strftime("%H%M%S")

async def atlantaAis140ToFront(parsedData):
    date, time = _convert_date_time_emit(parsedData.get("timestamp"))

    address = await geocodeInternal(parsedData.get("gps", {}).get("lat"), parsedData.get("gps", {}).get("lon"))
    json_data = {
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
        "date_time": parsedData.get("timestamp"),
    }
    return json_data