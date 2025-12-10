# import socket
# from app import create_app, socketio
# import os
# import eventlet
# import ssl

# app = create_app()

# if __name__ == '__main__':
    
#     eventlet.wsgi.server(
#         eventlet.listen(('0.0.0.0', 5000)), 
#         app,
#         socket_timeout = 600
#     )

import eventlet
eventlet.monkey_patch()

from app import create_app, socketio

app = create_app()

if __name__ == "__main__":
    if __name__ == "__main__":
        socketio.run(
            app,
            host="0.0.0.0",
            port=5000,
            allow_unsafe_werkzeug=False,
            socket_timeout=600,  # seconds
        )