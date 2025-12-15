#!/bin/bash
set -e

echo "🔄 Starting Redis..."
sudo systemctl start redis-server

echo "🧹 Killing old tmux session..."
tmux kill-session -t cordonnx 2>/dev/null || true

echo "🚀 Starting new tmux session..."
tmux new -d -s cordonnx

# Gunicorn in window 0
tmux send-keys -t cordonnx:0 "source venv/bin/activate" C-m
tmux send-keys -t cordonnx:0 "CELERY_BROKER_URL=redis://localhost:6379/0 CELERY_RESULT_BACKEND=redis://localhost:6379/0 exec ./venv/bin/gunicorn run:app -k eventlet -w 1 --worker-connections 1000 --bind 0.0.0.0:5000" C-m

# Celery in window 1
tmux new-window -t cordonnx
tmux send-keys -t cordonnx:1 "source venv/bin/activate" C-m
tmux send-keys -t cordonnx:1 "CELERY_BROKER_URL=redis://localhost:6379/0 CELERY_RESULT_BACKEND=redis://localhost:6379/0 celery -A app.celery_app.celery worker -l info" C-m

echo "🎉 Services started!"
