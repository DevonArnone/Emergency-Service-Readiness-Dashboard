#!/bin/bash
# Start server directly with visible output - no background

cd "$(dirname "$0")"

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Kill any existing processes
pkill -f "uvicorn app.main:app" 2>/dev/null
sleep 1

# Start the server (this will block - that's normal!)
echo "🚀 Starting backend server..."
echo "📍 API: http://localhost:8000"
echo "📍 Docs: http://localhost:8000/docs"
echo "📍 Health: http://localhost:8000/health"
echo ""
echo "Server is running. Press Ctrl+C to stop."
echo ""

# Run directly (not in background) so you can see output
exec uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

