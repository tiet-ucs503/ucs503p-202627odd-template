# ============================================================
# BharatAssist Dockerfile
# Optimized for Python 3.11 with PyTorch & ChromaDB support
# ============================================================

FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=5000 \
    HOST=0.0.0.0

WORKDIR /app

# Install system dependencies (build tools, curl for health checks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . /app/

# Expose port (default 5000)
EXPOSE 5000

# Healthcheck to verify the web service is responsive
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT}/ || exit 1

# Start application via Gunicorn with 1 worker and 4 threads (optimized for PyTorch + ChromaDB memory)
CMD ["sh", "-c", "gunicorn app:app --bind 0.0.0.0:${PORT} --workers 1 --threads 4 --timeout 180"]
