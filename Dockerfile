# Use a lightweight Python base
FROM python:3.10-slim

# 1. Install System Dependencies (Chromium, Xvfb, etc.)
RUN apt-get update && apt-get install -y \
    chromium \
    xvfb \
    x11-utils \
    procps \
    && rm -rf /var/lib/apt/lists/*

# 2. Set working directory
WORKDIR /app

# 3. Copy files
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .

# 4. Make the start script executable
RUN chmod +x start.sh

# 5. Expose the port (Render uses standard 10000 usually, or we configure env)
EXPOSE 5000

# 6. Run the script
CMD ["./start.sh"]