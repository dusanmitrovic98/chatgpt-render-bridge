#!/bin/bash

echo "🚀 Starting Render Automation (Stable Mode)..."

# 1. Start Xvfb
# Using 16-bit color depth to save RAM
export DISPLAY=:99
Xvfb :99 -screen 0 1024x768x16 &
sleep 2

# 2. Start Python Server
python server_openai.py &
sleep 2

# 3. Start Chromium
echo "👻 Launching Chromium..."

chromium \
  --no-sandbox \
  --disable-gpu \
  --disable-software-rasterizer \
  --disable-dev-shm-usage \
  --disable-background-networking \
  --disable-default-apps \
  --disable-extensions-except="/app/my-extension" \
  --load-extension="/app/my-extension" \
  --renderer-process-limit=2 \
  --disable-site-isolation-trials \
  --user-data-dir="/tmp/render_profile" \
  "https://chatgpt.com/?new=$(date +%s)"