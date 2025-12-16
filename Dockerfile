FROM python:3.10-slim

# Install Chromium, Xvfb, and deps
RUN apt-get update && apt-get install -y \
    chromium \
    xvfb \
    procps \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy files
COPY . .

# Environment variables for Chromium
ENV DISPLAY=:99
ENV PYTHONUNBUFFERED=1

# Create the startup script dynamically
RUN echo '#!/bin/bash\n\
rm -f /tmp/.X99-lock\n\
Xvfb :99 -screen 0 1280x1024x24 &\n\
sleep 2\n\
python server_openai.py &\n\
sleep 2\n\
chromium --no-sandbox --disable-gpu --disable-dev-shm-usage --user-data-dir="/data/profile" --load-extension="/app/my-extension" "https://chatgpt.com/?new=$(date +%s)"\n\
' > start.sh && chmod +x start.sh

CMD ["./start.sh"]