FROM python:3.11-slim
WORKDIR /app
COPY requirements.lock pyproject.toml alembic.ini ./
COPY app ./app
COPY migrations ./migrations
RUN pip install --no-cache-dir -r requirements.lock && pip install --no-cache-dir --no-deps .
ENV PYTHONPATH=/app
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
