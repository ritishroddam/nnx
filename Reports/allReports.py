from flask import Flask, render_template, Blueprint
from Reports.SpeedReport.speed import speed_bp

reports_bp = Blueprint('Reports', __name__, static_folder='static', template_folder='templates')

reports_bp.register_blueprint(speed_bp, url_prefix='/speed')

@reports_bp.route('/')
def index():
    return render_template('allReport.html')
