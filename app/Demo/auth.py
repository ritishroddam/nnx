from flask import Flask, render_template, request, redirect, url_for, session, flash
from pymongo import MongoClient
from bson.objectid import ObjectId
import bcrypt
from flask import jsonify
import os

app = Flask(__name__)
app.secret_key = 'your_secret_key'  # Replace with a real secret key

# MongoDB connection
client = MongoClient("mongodb+srv://doadmin:4T81NSqj572g3o9f@db-mongodb-blr1-27716-c2bd0cae.mongo.ondigitalocean.com/admin?tls=true&authSource=admin")
db = client['CordonEV']  # Database name
collection = db['authentications']  # Collection name

# Route for the home page
@app.route('/')
def index():
    if 'username' in session:
        if session.get('role') == 'super_admin':
            return redirect(url_for('super_admin_dashboard'))
        elif session.get('role') == 'admin':
            return redirect(url_for('admin_dashboard'))
        else:
            return redirect(url_for('customer_dashboard'))
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password'].encode('utf-8')
        
        user = collection.find_one({"username": username})
        
        if user:
            hashed_password = user['password'].encode('utf-8')
            
            if bcrypt.checkpw(password, hashed_password):
                session['username'] = username
                session['role'] = user.get('role', 'customer')
                
                # Fetch company details and store them in session
                session['latitude'] = user.get('latitude', '13.02071225132524')
                session['longitude'] = user.get('longitude', '77.64785935654147')
                session['company_name'] = user.get('company_name', 'Cordon Telematics')
                session['address'] = user.get('address', '3rd and 4th Floor, 24/1, 100 Feet Rd, HRBR Layout 1st Block, Balaji Layout, Subbaiahnapalya, Banaswadi, Bengaluru, Karnataka 560043')
                session['company_image'] = user.get('company_image', None)

                # Debug prints to check if session data is correctly stored
                print("Company Name:", session['company_name'])
                print("Company Address:", session['address'])
                print("Company Image:", session['company_image'])

                # Return JSON response if AJAX request
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return jsonify({
                        'status': 'success',
                        'latitude': session['latitude'],
                        'longitude': session['longitude'],
                        'company_name': session['company_name'],
                        'address': session['address'],
                        'company_image': session['company_image']
                    })
                
                # Redirect based on role
                if session['role'] == 'super_admin':
                    return redirect(url_for('super_admin_dashboard'))
                elif session['role'] == 'admin':
                    return redirect(url_for('admin_dashboard'))
                else:
                    return redirect(url_for('customer_dashboard'))
            else:
                flash("Invalid username or password")
        else:
            flash("Invalid username or password")
    
    return render_template('login.html')

@app.route('/super_admin/dashboard')
def super_admin_dashboard():
    if 'username' not in session or session.get('role') != 'super_admin':
        return redirect(url_for('login'))
    return render_template('super_admin_dashboard.html')

@app.route('/admin/dashboard')
def admin_dashboard():
    if 'username' not in session or session.get('role') not in ['admin', 'super_admin']:
        return redirect(url_for('login'))
    users = collection.find()  # Fetch all users
    return render_template('admin_dashboard.html', users=users)

@app.route('/admin/users')
def admin_users():
    if 'username' not in session or session.get('role') not in ['admin', 'super_admin']:
        return redirect(url_for('login'))

    users = list(collection.find())  # Fetch users and convert to list

    return render_template('Users.html', users=users)

@app.route('/customer_dashboard')
def customer_dashboard():
    if 'username' not in session or session.get('role') not in ['customer', 'admin', 'super_admin']:
        return redirect(url_for('login'))
    return render_template('customer_dashboard.html')

@app.route('/add_user', methods=['GET', 'POST'])
def add_user():
    if 'username' not in session or session.get('role') not in ['admin', 'super_admin']:
        return redirect(url_for('login'))
    
    if request.method == 'POST':
        username = request.form['username']
        password = bcrypt.hashpw(request.form['password'].encode('utf-8'), bcrypt.gensalt())
        role = request.form.get('role', 'customer')  # Default role is 'customer'
        latitude = request.form.get('latitude', '13.01409')
        longitude = request.form.get('longitude', '77.64850')
        company_name = request.form.get('company_name', 'Cordon Telematics')
        address = request.form.get('address', '3rd and 4th Floor, 24/1, 100 Feet Rd, HRBR Layout...')

        # Handle file upload for company image
        company_image = None
        if 'company_image' in request.files:
            image_file = request.files['company_image']
            if image_file.filename != '':
                image_file.save(f'static/uploads/{image_file.filename}')
                company_image = f'static/uploads/{image_file.filename}'
        
        collection.insert_one({
            'username': username,
            'password': password.decode(),
            'role': role,
            'latitude': latitude,
            'longitude': longitude,
            'company_name': company_name,
            'address': address,
            'company_image': company_image
        })
        
        flash('User added successfully')
        return redirect(url_for('admin_dashboard'))
    
    return render_template('user_form.html', action='Add')

@app.route('/edit_user/<user_id>', methods=['GET', 'POST'])
def edit_user(user_id):
    if 'username' not in session or session.get('role') not in ['admin', 'super_admin']:
        return redirect(url_for('login'))
    user = collection.find_one({'_id': ObjectId(user_id)})
    if request.method == 'POST':
        username = request.form['username']
        password = bcrypt.hashpw(request.form['password'].encode('utf-8'), bcrypt.gensalt())
        role = request.form.get('role', 'customer')  # Default role is 'customer'
        collection.update_one({'_id': ObjectId(user_id)}, {'$set': {'username': username, 'password': password.decode(), 'role': role}})
        flash('User updated successfully')
        return redirect(url_for('admin_dashboard'))
    return render_template('user_form.html', user=user, action='Edit')

@app.route('/logout')
def logout():
    session.pop('username', None)
    session.pop('role', None)
    return redirect(url_for('index'))

@app.route('/atlanta')
def atlanta():
    return redirect("http://64.227.137.175:8001")

@app.route('/atlantaLive')
def atlantaLive():
    return redirect("http://64.227.137.175:8002")

@app.route('/device_inventory')
def device_inventory():
    return redirect("http://64.227.137.175:8003")  # Assuming 'naya/app.py' runs on port 5001

@app.route('/sim_inventory')
def sim_inventory():
    return redirect("http://64.227.137.175:8004")  # Assuming 'nayasim/sim.py' runs on port 5002

@app.route('/employees_db')
def employees_db():
    return redirect("http://64.227.137.175:8005")  # Assuming 'nayasim/emp.py' runs on port 5003

@app.route('/vehicle_inventory')
def vehicle_inventory():
    return redirect("http://64.227.137.175:8006")  # Assuming 'nayasim/vehicle.py' runs on port 5003

@app.route('/customer_list')
def customer_list():
    return redirect("http://64.227.137.175:8007")  # Assuming 'nayasim/comp.py' runs on port 5003

@app.route('/users')
def users():
    return render_template('Users.html')

if __name__ == '__main__':
    # app.run(host='64.227.137.175',port=8010, debug=True)
    app.run(port=5000, debug=True)
