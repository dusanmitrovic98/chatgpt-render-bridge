FROM python:3.10-slim

# 1. Install Chrome & Xvfb
RUN apt-get update && apt-get install -y \
    chromium \
    xvfb \
    procps \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 2. Install Python Deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 3. Copy Code
COPY . .

# 4. Environment
ENV DISPLAY=:99
ENV PYTHONUNBUFFERED=1

# 5. Startup Script (Stateless)
# We use /tmp/chrome_profile so it wipes every time
RUN echo '#!/bin/bash\n\
rm -f /tmp/.X99-lock\n\
Xvfb :99 -screen 0 1280x1024x24 &\n\
sleep 2\n\
python server_openai.py &\n\
sleep 2\n\
echo "👻 Starting Stateless Chromium..."\n\
chromium --no-sandbox --disable-gpu --disable-dev-shm-usage --user-data-dir="/tmp/chrome_profile" --load-extension="/app/my-extension" "https://chatgpt.com/?new=$(date +%s)"\n\
' > start.sh && chmod +x start.sh

CMD ["./start.sh"]