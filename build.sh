#!/usr/bin/env bash
# Exit on error
set -e

# Install Python dependencies
pip install -r requirements.txt

# Build Frontend
cd frontend
# Ensure we install ALL dependencies including devDependencies (where vite is)
npm install --include=dev

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
