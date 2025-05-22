# Example Flask endpoint
from flask import Flask, request, jsonify, abort, render_template
import time, jwt

SECRET = "your-very-secret-key"
app = Flask(__name__)

@app.route('/api/share-location', methods=['POST'])
def share_location():
    data = request.json
    imei = data['imei']
    expiry = int(data['expiry'])  # in minutes
    exp_time = int(time.time()) + expiry * 60
    token = jwt.encode({'imei': imei, 'exp': exp_time}, SECRET, algorithm='HS256')
    link = f"https://yourdomain.com/share/{token}"
    return jsonify({'link': link})

@app.route('/share/<token>')
def shared_location(token):
    try:
        payload = jwt.decode(token, SECRET, algorithms=['HS256'])
        imei = payload['imei']
        # Render a page that shows only this vehicle's live location
        return render_template('shared_map.html', imei=imei, token=token)
    except jwt.ExpiredSignatureError:
        return "Link Expired", 403
    except Exception:
        abort(404)