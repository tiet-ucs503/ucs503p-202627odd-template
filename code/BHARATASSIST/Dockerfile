# ============================================================
# BharatAssist Dockerfile
# Optimized for Python 3.11 with PyTorch & ChromaDB support
# ============================================================

FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=7860 \
    HOST=0.0.0.0

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY . /app/

EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT:-7860}/ || exit 1

CMD ["sh", "-c", "gunicorn app:app --bind 0.0.0.0:${PORT:-7860} --workers 1 --threads 4 --timeout 180"]
