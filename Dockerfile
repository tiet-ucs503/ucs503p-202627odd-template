# ============================================================
# BharatAssist Root Dockerfile
# ============================================================

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=7860 \
    HOST=0.0.0.0

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY code/BHARATASSIST/requirements.txt /app/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY . /app/

EXPOSE 7860

CMD ["sh", "-c", "gunicorn --chdir code/BHARATASSIST app:app --bind 0.0.0.0:${PORT:-7860} --workers 1 --threads 4 --timeout 180"]
