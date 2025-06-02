from app import create_app
from app.celery_worker import make_celery
from app.Vehicle.VehicleBackend import getVehicleStatus

flask_app = create_app()
celery = make_celery(flask_app)

@celery.task()
def get_vehicle_status_task(imei_list):
    return getVehicleStatus(imei_list)