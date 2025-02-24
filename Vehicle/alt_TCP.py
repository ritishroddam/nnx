from pymongo import MongoClient
import threading
import socketserver
import time  

# Connect to MongoDB
client = MongoClient('mongodb+srv://doadmin:4sEK57130lRk9C6L@db-mongodb-blr1-19677-8a3b7549.mongo.ondigitalocean.com/admin?tls=true&authSource=admin')
db = client['nnx']
collection = db['atlanta']

# TCP Handler to Process Incoming Data
class MyTCPHandler(socketserver.BaseRequestHandler):
    def handle(self):
        try:
            data = self.request.recv(4096).strip()  # Receive data from the device
            if not data:
                return

            print(f"Received Data: {data}")

            # Decode and store in MongoDB
            try:
                json_data = {"raw_data": data.decode('utf-8'), "timestamp": time.time()}
                collection.insert_one(json_data)
                print("Data saved to MongoDB.")
            except Exception as db_error:
                print(f"Error saving to MongoDB: {db_error}")

        except Exception as e:
            print(f"Error handling request: {e}")

# Multi-threaded TCP Server
class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True

if __name__ == "__main__":
    host = "0.0.0.0"  # Listen on all network interfaces
    port = 8800
    server_shutdown = threading.Event()

    with ThreadedTCPServer((host, port), MyTCPHandler) as server:
        ip, port = server.server_address
        server_thread = threading.Thread(target=server.serve_forever)
        server_thread.daemon = True
        server_thread.start()
        print(f"✅ TCP Server Running on {ip}:{port}")

        try:
            while True:
                time.sleep(5)  # Keep main thread alive
        except KeyboardInterrupt:
            print("❌ Shutting down TCP Server")
            server.shutdown()
            server.server_close()
