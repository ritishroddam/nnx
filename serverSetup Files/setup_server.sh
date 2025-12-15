#!/bin/bash
set -e

echo "🔧 Updating server..."
sudo apt update && sudo apt upgrade -y

echo "🌐 Installing Nginx..."
sudo apt install nginx -y
sudo ufw allow 'Nginx Full'
sudo ufw allow ssh
sudo ufw enable

echo "🧱 Installing Redis server (host-based)..."
sudo apt install redis-server -y
sudo systemctl enable redis-server
sudo systemctl start redis-server

echo "📦 Installing Python + git..."
sudo apt install python3.12-venv git curl -y

echo "🔐 Installing Certbot..."
sudo apt install certbot python3-certbot-nginx -y

echo "Setup complete."
