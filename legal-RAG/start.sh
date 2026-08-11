#!/bin/bash

# Start Python service in the background
echo "Starting Python PDF service on port 8000..."
cd python-service
python main.py &
PYTHON_PID=$!

# Wait for Python service to be ready
echo "Waiting for Python service to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo "Python service is ready!"
        break
    fi
    echo "Waiting for Python service... ($i/30)"
    sleep 1
done

# Start Next.js application
echo "Starting Next.js application on port $PORT..."
cd /app
export PYTHON_SERVICE_URL=http://localhost:8000
node_modules/.bin/next start -p ${PORT:-3000}

# If Next.js exits, kill Python service
kill $PYTHON_PID