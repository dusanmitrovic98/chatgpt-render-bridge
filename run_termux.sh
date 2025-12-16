#!/bin/bash

# --- CONFIGURATION ---
EXT_PATH="$(pwd)/my-extension"
PROFILE_DIR="/root/gpt_profile"

# 1. CLEANUP
echo "🧹 Cleaning up old processes..."
pkill -f server_openai.py
pkill -f chromium
pkill -f Xvfb

# 2. START VIRTUAL SCREEN
echo "📺 Starting Virtual Monitor (Xvfb)..."
# Set TMPDIR to fix the "--shm-helper" error on Termux
export TMPDIR=/tmp
export DBUS_SESSION_BUS_ADDRESS=/dev/null

Xvfb :99 -screen 0 1024x768x24 &
export DISPLAY=:99
sleep 2

# 3. START PYTHON SERVER
echo "🚀 Starting OpenAI Bridge Server..."
python3 server_openai.py > server.log 2>&1 &
SERVER_PID=$!
sleep 2

# 4. START CHROMIUM
echo "👻 Starting Headless Browser..."
# Flags optimized for Termux/Proot environment
chromium \
  --no-sandbox \
  --disable-gpu \
  --disable-software-rasterizer \
  --disable-dev-shm-usage \
  --disable-breakpad \
  --user-data-dir="$PROFILE_DIR" \
  --load-extension="$EXT_PATH" \
  "https://chatgpt.com/?new=$(date +%s)" > browser.log 2>&1 &

echo "✅ System Online!"
echo "   Server PID: $SERVER_PID"
echo "   Logs: tail -f server.log"
echo "   Browser Logs: tail -f browser.log"