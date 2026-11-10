import os
os.environ.setdefault("KERAS_HOME", os.path.join(os.path.dirname(__file__), ".keras"))
os.environ.setdefault("MPLCONFIGDIR", os.path.join(os.path.dirname(__file__), ".matplotlib"))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import users, missions, attempts, eye_tracking, auth, reports
import models

# Initialize the database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="MathVerse AI API",
    description="Backend API for the AI-Powered Gamified Mathematics Learning Platform",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(missions.router)
app.include_router(attempts.router)
app.include_router(eye_tracking.router)
app.include_router(reports.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to the MathVerse AI Backend Services"}
