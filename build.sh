#!/bin/bash
# Build script for Render

echo "Installing Python dependencies..."
pip install -r requirements.txt

echo "Installing Node.js dependencies..."
cd frontend
npm install

echo "Building frontend..."
npm run build

echo "Build complete!"
echo "Current directory:"
pwd
echo "Listing dist directory:"
ls -R dist
cd ..
echo "Listing frontend directory from root:"
ls -R frontend
