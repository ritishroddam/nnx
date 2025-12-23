#!/bin/bash
set -e

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: ./deploy_app.sh <git_repo_ssh_url> <project_folder>"
  exit 1
fi

REPO_URL="$1"
APP_DIR="$2"

echo "🚀 Deploying CordonNX"
echo "Repo: $REPO_URL"
echo "Dir:  $APP_DIR"

# Clone or pull repo
if [ ! -d "$APP_DIR" ]; then
    echo "📥 Cloning repository..."
    git clone "$REPO_URL" "$APP_DIR"
else
    echo "📂 Pulling latest changes..."
    cd "$APP_DIR"
    git pull
    cd ..
fi

cd "$APP_DIR"

# Create venv if missing
if [ ! -d "venv" ]; then
    echo "🐍 Creating Python virtual env..."
    python3 -m venv venv
fi

source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Stop existing app processes
echo "🛑 Checking for existing running processes..."

echo "🔻 Killing Gunicorn..."
pkill -f "gunicorn" 2>/dev/null || true

echo "🔻 Killing Celery..."
pkill -f "celery" 2>/dev/null || true

# Kill old tmux session
if tmux has-session -t cordonnx 2>/dev/null; then
    echo "🔻 Killing old tmux session..."
    tmux kill-session -t cordonnx
else
    echo "ℹ️ No old tmux session."
fi

# Start new session
echo "🚀 Starting new tmux session..."
tmux new -d -s cordonnx

# Window 0 → Gunicorn
tmux send-keys -t cordonnx:0 "cd $APP_DIR" C-m
tmux send-keys -t cordonnx:0 "source venv/bin/activate" C-m
tmux send-keys -t cordonnx:0 "CELERY_BROKER_URL=redis://localhost:6379/0 CELERY_RESULT_BACKEND=redis://localhost:6379/0 exec ./venv/bin/gunicorn run:app -k eventlet -w 1 --worker-connections 1000 --timeout 180 --bind 0.0.0.0:5000" C-m

# Create window 1 for Celery
tmux new-window -t cordonnx

# Window 1 → Celery
tmux send-keys -t cordonnx:1 "cd $APP_DIR" C-m
tmux send-keys -t cordonnx:1 "source venv/bin/activate" C-m
tmux send-keys -t cordonnx:1 "CELERY_BROKER_URL=redis://localhost:6379/0 CELERY_RESULT_BACKEND=redis://localhost:6379/0 celery -A app.celery_app.celery worker -P eventlet -c 200 -l info" C-m

echo "🎉 Deployment complete!"