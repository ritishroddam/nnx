from flask import Flask, render_template, Blueprint

reports_bp = Blueprint('Reports', __name__, static_folder='static', template_folder='templates')


@reports_bp.route('/')
def index():
    return render_template('allReport.html')
