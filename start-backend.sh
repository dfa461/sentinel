#!/bin/bash

echo "🚀 Starting Sentinel Backend..."
echo ""

# Navigate to backend directory
cd frontend/backend

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📥 Installing dependencies..."
pip install -r requirements.txt --quiet

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found!"
    echo "📝 Creating .env from .env.example..."
    cp .env.example .env
    echo ""
    echo "⚠️  Please edit frontend/backend/.env and add your Grok API key!"
    echo ""
fi

# Start the server
echo "✨ Starting FastAPI server on http://localhost:8000"
echo ""
python -m uvicorn app.main:app --reload --port 8000
