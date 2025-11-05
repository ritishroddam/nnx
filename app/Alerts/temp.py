geofence = {
    'geofenceName': geofence['name'],


}

idle = {
                'alertMessage': idleTime,


}

speed =             {
                'speed': data.get('speed'),


            }

general = {
            'imei': data.get('imei'),
            'LicensePlateNumber': vehicleInfo.get('LicensePlateNumber'),
            'date_time': utc_dt,
            'latitude': data.get('latitude'),
            'longitude': data.get('longitude'),
            'location': data.get('address'),
        }

            