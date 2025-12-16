#!/bin/bash

echo "🚀 Starting Render Automation (Low RAM Mode)..."

# 1. Start Xvfb (Virtual Monitor)
# Lower resolution = Less RAM usage for video buffer
export DISPLAY=:99
Xvfb :99 -screen 0 1024x768x16 &
sleep 2

# 2. Start Python Server (Background)
python server_openai.py &
sleep 2

# 3. Start Chromium (THE DIET VERSION)
echo "👻 Launching Chromium..."

# FLAGS EXPLAINED:
# --renderer-process-limit=1: Forces Chrome to use FEWER processes (Saves ~100MB)
# --disable-site-isolation-trials: Disables security sandbox (Saves ~50MB)
# --disable-extensions-except: Only load OUR extension, nothing else.
# --disable-dev-shm-usage: Prevents crash in Docker
# --no-zygote: Reduces process startup overhead

chromium \
  --no-sandbox \
  --disable-gpu \
  --disable-software-rasterizer \
  --disable-dev-shm-usage \
  --disable-background-networking \
  --disable-default-apps \
  --disable-extensions-except="/app/my-extension" \
  --load-extension="/app/my-extension" \
  --renderer-process-limit=1 \
  --disable-site-isolation-trials \
  --no-zygote \
  --single-process \
  --user-data-dir="/tmp/render_profile" \
  "https://chatgpt.com/?new=$(date +%s)"