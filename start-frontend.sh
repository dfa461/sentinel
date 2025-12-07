#!/bin/bash

echo "🚀 Starting Sentinel Frontend..."
echo ""

# Navigate to frontend directory
cd frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the dev server
echo "✨ Starting Vite dev server..."
echo ""
npm run dev
