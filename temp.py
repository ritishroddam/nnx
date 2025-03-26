import socketio

HOST = '64.227.137.175'  # Remote server IP
PORT = 8555

# Connect to the server
sio = socketio.Client(logger=True, engineio_logger=True)  # Enable logging for debugging

@sio.on('vehicle_update')
def on_vehicle_update(data):
    print("Received vehicle_update:", data)

@sio.on('test_event')
def on_test_event(data):
    print("Received test_event:", data)

# Construct the URL and connect
url = f"http://{HOST}:{PORT}"  # Use http:// or ws:// depending on your server setup
sio.connect(url, transports=['websocket'])  # Force WebSocket transport

# Keep the client running
sio.wait()