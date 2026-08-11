# Multi-stage Dockerfile for Legal Ingest (Next.js + Python Service)
# This Dockerfile builds both the Next.js frontend and the Python PDF service
# and runs them together in a single container for Cloud Run deployment

# ============================================
# Stage 1: Build Next.js Application
# ============================================
FROM node:20-slim AS nextjs-builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci && \
    npm cache clean --force

# Copy source files
COPY . .

# Build Next.js application
RUN npm run build

# ============================================
# Stage 2: Python Service Base
# ============================================
FROM python:3.11-slim AS python-base

WORKDIR /python-service

# Install Python dependencies
COPY python-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Python service code
COPY python-service/ .

# ============================================
# Stage 3: Final Runtime Image
# ============================================
FROM python:3.11-slim

# Install Node.js in the Python image
RUN apt-get update && \
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy Next.js build from builder stage
COPY --from=nextjs-builder /app/.next ./.next
COPY --from=nextjs-builder /app/node_modules ./node_modules
COPY --from=nextjs-builder /app/package*.json ./
COPY --from=nextjs-builder /app/public ./public
COPY --from=nextjs-builder /app/next.config.ts ./

# Copy Python service from python-base stage
WORKDIR /python-service
COPY --from=python-base /python-service .
COPY --from=python-base /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages

# Create startup script that runs both services
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Set environment variable for internal Python service
ENV PYTHON_SERVICE_URL=http://localhost:8000

# Expose port (Cloud Run will set the PORT env variable)
ENV PORT=8080
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8080}/ || exit 1

# Start both services
CMD ["/start.sh"]
