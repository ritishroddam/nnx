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
            'LicensePlateNumber': vehicleInfo.get('LicensePlateNumber'),
            'date_time': utc_dt,
            'location': data.get('address'),
        }

            