from pymongo import MongoClient
import threading
import socketserver
import time  
from app0011 import C_TS_VLT_APP_0011

# Connect to MongoDB
client = MongoClient('mongodb+srv://doadmin:4sEK57130lRk9C6L@db-mongodb-blr1-19677-8a3b7549.mongo.ondigitalocean.com/admin?tls=true&authSource=admin')
db = client['nnx']
collection = db['atlanta']

class C_TS_VLT_APP_0011(socketserver.BaseRequestHandler):
    def handle(self):
        # Implement handling of incoming requests here
        pass

class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args)
        self.shutdown_event = kwargs["server_shutdown_event"]
        ip, port = self.server_address

    def server_close(self):
        return super().server_close()

    def handle(self, request, client_address):
        parser = C_TS_VLT_APP_0011(request)
        response = parser.process(parser.read())
        
        # Store parsed data in MongoDB
        collection.insert_one({"data": response.decode('utf-8')})

if __name__ == "__main__":
    host = "64.227.137.175"
    port = 8000
    server_shutdown = threading.Event()

    server = ThreadedTCPServer((host, port),
                               server_shutdown_event=server_shutdown)
    with server:
        ip, port = server.server_address
        server_thread = threading.Thread(target=server.serve_forever)
        server_thread.daemon = True
        server_thread.start()
        print(f"Starting TCP Server @ IP: {host} port: {port}")

        try:
            while True:
                time.sleep(5)
        except KeyboardInterrupt:
            print(f"Shutting down TCP Server @ IP: {host} port: {port}")
            server_shutdown.set()  # trigger event to stop child threads
            server.shutdown()
