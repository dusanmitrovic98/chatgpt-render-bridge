#!/bin/bash

echo "🚀 Starting Render Automation..."

# 1. Start Xvfb (Virtual Monitor)
export DISPLAY=:99
Xvfb :99 -screen 0 1280x1024x24 &
sleep 2

# 2. Start Python Server (Background)
python server_openai.py &
sleep 2

# 3. Start Chromium (Headless + Extension + PROXY)
# NOTE: Replace the --proxy-server value with your real proxy!
echo "👻 Launching Chromium..."

chromium \
  --no-sandbox \
  --disable-gpu \
  --disable-dev-shm-usage \
  --renderer-process-limit=2 \
  --user-data-dir="/tmp/render_profile" \
  --load-extension="/app/my-extension" \
  --proxy-server="http://user:pass@host:port" \
  "https://chatgpt.com/?new=$(date +%s)"