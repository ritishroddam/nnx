
# 🚀 CordonNX — Full Server Setup & Deployment Guide  
This document provides a **complete, detailed, production‑grade guide** for preparing a new Ubuntu server and deploying the CordonNX platform.  
It includes:

- Full Nginx setup (HTTP + HTTPS + WebSocket support)  
- Certbot SSL configuration  
- Redis installation (Docker)  
- Python virtual environment setup  
- Gunicorn + Eventlet setup  
- Celery worker setup  
- tmux process management  
- Deployment automation scripts  
- Post‑reboot startup instructions  
- Troubleshooting section  

---

# 1. Update & Prepare Server

```bash
sudo apt update
sudo apt upgrade -y
sudo reboot
```

---

# 2. Install Nginx

```bash
sudo apt install nginx -y
sudo systemctl status nginx
```

Enable firewall:

```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow ssh
sudo ufw enable
```

---

# 3. Create Initial HTTP Nginx Config

```bash
sudo nano /etc/nginx/sites-available/<your_domain>
```

Paste:

```
server {
    listen 80;
    server_name <your_domain> www.<your_domain>;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable config:

```bash
sudo ln -s /etc/nginx/sites-available/<your_domain> /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

---

# 4. Install Certbot & Enable SSL

```bash
sudo apt install python3-certbot-nginx certbot -y
sudo certbot --nginx -d <your_domain> -d www.<your_domain>
```

---

# 5. Replace Nginx Config With Full HTTPS Version

```bash
sudo nano /etc/nginx/sites-available/<your_domain>
```

Paste **the full HTTPS + WebSocket configuration**:

```
# HTTPS SERVER BLOCK
server {
    server_name <your_domain> www.<your_domain>;

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/<your_domain>/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/<your_domain>/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_connect_timeout 180s;
        proxy_send_timeout    180s;
        proxy_read_timeout    180s;
    }
}

# HTTP REDIRECT BLOCK
server {
    if ($host = www.<your_domain>) {
        return 301 https://$host$request_uri;
    }

    if ($host = <your_domain>) {
        return 301 https://$host$request_uri;
    }

    listen 80;
    server_name <your_domain> www.<your_domain>;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_connect_timeout 180s;
        proxy_send_timeout    180s;
        proxy_read_timeout    180s;
    }
}
```

Test & reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

# 6. Install Docker & Redis

Install Docker:

```bash
sudo apt install docker.io -y
docker --version
```

Start Redis **once**:

```bash
docker run -p 6379:6379 --name redis -d redis:7-alpine
```

Later (after reboot), simply:

```bash
docker start redis
```

---

# 7. Add SSH Key to GitHub

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
cat ~/.ssh/id_ed25519.pub
```

Add to GitHub → *SSH Keys*.

---

# 8. Clone Application

```bash
git clone git@github.com:<your_account>/<your_repo>.git <project_folder>
cd <project_folder>
```

---

# 9. Setup Python Venv

```bash
sudo apt install python3.12-venv -y
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

---

# 10. Run Application Using tmux

Start tmux:

```bash
tmux new -s cordonnx
```

---

## ⭐ Pane 1 — Start Gunicorn Web Server  
(Inline ENV required due to `exec` replacing shell)

```bash
source venv/bin/activate

CELERY_BROKER_URL=redis://localhost:6379/0 CELERY_RESULT_BACKEND=redis://localhost:6379/0 exec ./venv/bin/gunicorn run:app     -k eventlet -w 1 --worker-connections 1000     --bind 0.0.0.0:5000
```

---

## ⭐ Pane 2 — Start Celery Worker

```bash
source venv/bin/activate

CELERY_BROKER_URL=redis://localhost:6379/0 CELERY_RESULT_BACKEND=redis://localhost:6379/0 celery -A app.celery_app.celery worker -l info
```

---

# 11. After Reboot — Start Services

```bash
docker start redis
tmux new -s cordonnx
```

Re-run the pane commands.

---

# 12. Troubleshooting

### Redis container name in use
```
docker start redis
```

### Nginx fails reload
```
sudo nginx -t
```

### Gunicorn fails
Check logs inside tmux.

---

# 13. Deployment Scripts  

Provided in:  
- `setup_server.sh`  
- `deploy_app.sh`  
- `start_services.sh`  

See included files in release ZIP.

---

# End of Full Guide
