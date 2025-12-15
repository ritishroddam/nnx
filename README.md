# CordonNX Platform

CordonNX is a Flask-based fleet telematics platform that ingests AIS-140/ATLANTA feeds, renders live location dashboards, manages inventories, and generates operational reports. The stack combines Flask blueprints, Celery workers, Redis, MongoDB, Google Maps APIs, and Socket.IO for real-time updates.

## Repository layout

- [`run.py`](run.py) – entry point that bootstraps the Flask app.
- [`app/__init__.py`](app/__init__.py) – application factory registering all blueprints (Vehicle, Dashboard, Inventory, Reports, etc.).
- [`app/Vehicle`](app/Vehicle) – live-map views, sharing links, card/table UI, and backend aggregation.
- [`app/Dashboard`](app/Dashboard) – admin dashboard templates, JS, and API routes (see [`app/Dashboard/DashboardBackend.py`](app/Dashboard/DashboardBackend.py)).
- [`app/DeviceInvy`](app/DeviceInvy) / [`app/SimInvy`](app/SimInvy) / [`app/VehicleDetails`](app/VehicleDetails) – inventory CRUD flows and bulk uploads.
- [`app/Reports`](app/Reports) – report builders, Celery tasks, DigitalOcean Spaces uploads.
- [`app/celery_app.py`](app/celery_app.py) – Celery configuration used by asynchronous tasks.
- [`serverSetup Files`](serverSetup%20Files/README.md) – production deployment scripts and detailed infrastructure guide.

## Prerequisites

- Python ≥ 3.12 with `venv`
- MongoDB instance (connection configured in [`config.py`](config.py))
- Redis (used as Celery broker/result backend)
- Google Maps API key for geocoding and JS maps
- Node-free frontend (plain JS/CSS delivered via Flask static assets)

## Local setup

```bash
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

Copy or export environment variables expected by [`config.py`](config.py) (DB URI, GMAPS key, JWT secret, Spaces credentials, etc.). For development you can extend the `DevelopmentConfig` class or set `FLASK_ENV=development`.

## Running services

### Flask web server
```bash
source venv/bin/activate
python run.py
```

### Celery worker
```bash
source venv/bin/activate
CELERY_BROKER_URL=redis://localhost:6379/0 \
CELERY_RESULT_BACKEND=redis://localhost:6379/0 \
celery -A app.celery_app.celery worker -l info
```

### Optional Socket.IO relay
If you need the standalone relay/server from [`app/map_server.py`](app/map_server.py), run it with the same virtualenv and configured SSL certificates.

## Key configuration notes

- JWT/cookie behavior is centralized in [`app/auth.py`](app/auth.py) and [`app/templates/base.html`](app/templates/base.html), which also injects user/company metadata for frontend scripts such as [`app/static/js/script.js`](app/static/js/script.js).
- Company-specific speed limits come from [`app/companyConfig/companyConfig.py`](app/companyConfig/companyConfig.py) and are surfaced in vehicle uploads.
- Bulk upload validators across inventories (e.g., [`app/VehicleDetails/vehicleDetails.py`](app/VehicleDetails/vehicleDetails.py), [`app/DeviceInvy/DeviceBackend.py`](app/DeviceInvy/DeviceBackend.py)) require strict column headers; see each template for expected spreadsheet schemas.

## Reports & background tasks

Report generation lives in [`app/Reports/allReports.py`](app/Reports/allReports.py) and `reportsHelper.py` and relies on Celery plus DigitalOcean Spaces. Ensure Spaces credentials are present before queueing large exports via the UI (`/reports/page`).

## Deployment

A full production guide (Nginx, SSL, Redis via Docker, Gunicorn/Eventlet, Celery workers, tmux scripts) is in [serverSetup Files/README.md](serverSetup%20Files/README.md). Helper scripts:

- [`serverSetup Files/setup_server.sh`](serverSetup%20Files/setup_server.sh) – base server provisioning.
- [`serverSetup Files/deploy_app.sh`](serverSetup%20Files/deploy_app.sh) – clone/pull + dependency install.
- [`serverSetup Files/start_services.sh`](serverSetup%20Files/start_services.sh) – tmux-based process launcher.

## Contributing

1. Create a feature branch.
2. Keep linting/formatting consistent with existing modules.
3. Add/adjust relevant templates (`app/.../templates`) and static assets.
4. Open a PR with screenshots or reproduction steps for UI-heavy changes.

## Troubleshooting

- Flask/Celery errors: check tmux panes or logs referenced in the deployment guide.
- Redis connection issues: ensure the Docker container/service is running (`docker start redis` or `systemctl status redis-server`).
- Google Maps quota/errors: validate the API key configured in [`config.py`](config.py) and Google Cloud console.