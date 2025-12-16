#!/bin/bash

echo "📦 Updating Repositories..."
apt-get update -y
apt-get upgrade -y

echo "🔧 Installing Prerequisites..."
# Software-properties-common is needed for add-apt-repository
apt-get install -y software-properties-common wget git nano

echo "🔓 Adding Chromium PPA (Non-Snap)..."
# We need this because standard Ubuntu Chromium tries to use Snap, which fails on phones
add-apt-repository ppa:xtradeb/apps -y
apt-get update -y

echo "⬇️ Installing Chromium, Xvfb, and Python..."
# Install the browser, the virtual screen, and python tools
apt-get install -y chromium xvfb python3 python3-pip

echo "🐍 Installing Python Libraries..."
# Install Flask for the server
pip3 install flask flask_cors

echo "✅ Setup Complete!"
echo "You can now run ./run_termux.sh"