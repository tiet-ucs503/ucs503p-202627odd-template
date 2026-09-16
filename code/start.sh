#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "🏋️  Starting Squat Form Analyzer..."
echo "----------------------------------------"

# Clean up child processes on Ctrl+C or termination
trap 'echo -e "\n🛑 Shutting down servers..."; kill $(jobs -p) 2>/dev/null' EXIT INT TERM

# 1. Start FastAPI backend (port 8000)
echo "▶ Starting backend server at http://127.0.0.1:8000"
(cd backend && .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload) &

# 2. Start Vite React frontend (port 5173)
echo "▶ Starting frontend website at http://localhost:5173"
npm --workspace frontend run dev &

echo "----------------------------------------"
echo "✨ App running at http://localhost:5173"
echo "✨ API docs available at http://127.0.0.1:8000/docs"
echo "Press Ctrl+C to stop both servers."
echo "----------------------------------------"

wait
