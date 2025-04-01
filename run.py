from app import create_app, socketio
import os
import eventlet
import ssl

app = create_app()

if __name__ == '__main__':
    # Ensure the cert directory exists
    os.makedirs('cert', exist_ok=True)
    
    # Check if certificates exist, if not generate them
    cert_path = 'cert/cert.pem'
    key_path = 'cert/key.pem'
    
    if not os.path.exists(cert_path) or not os.path.exists(key_path):
        print("Generating self-signed certificates...")
        os.system(f'openssl req -x509 -newkey rsa:4096 -nodes -out {cert_path} -keyout {key_path} -days 365 -subj "/CN=localhost"')
    
    # Configure SSL for Eventlet
    ssl_context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
    ssl_context.load_cert_chain(certfile=cert_path, keyfile=key_path)
    
    # Wrap the Eventlet socket with SSL
    wrapped_socket = eventlet.wrap_ssl(
        eventlet.listen(('0.0.0.0', 5000)),
        certfile=cert_path,
        keyfile=key_path,
        server_side=True
    )
    
    # Run the app with Eventlet and SSL
    eventlet.wsgi.server(wrapped_socket, app)