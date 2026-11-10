from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
import random

import models, schemas
from database import get_db

router = APIRouter(
    prefix="/missions",
    tags=["missions"],
)

def trigger_rag_tutor_async(mission_id: str):
    import sys
    import os
    sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'services'))
    try:
        from services.rag_tutor import generate_mission_briefing
        generate_mission_briefing(mission_id)
    except Exception as e:
        print(f"[AI] RAG Tutor integration failed: {e}")

@router.get("/", response_model=List[schemas.Mission])
def list_missions(db: Session = Depends(get_db)):
    return db.query(models.Mission).all()

@router.get("/{mission_id}", response_model=schemas.Mission)
def get_mission(mission_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    db_mission = db.query(models.Mission).filter(models.Mission.missionId == mission_id).first()
    if db_mission is None:
        raise HTTPException(status_code=404, detail="Mission not found")
    
    # Asynchronously invoke AI layer as described in architecture
    background_tasks.add_task(trigger_rag_tutor_async, mission_id)
    return db_mission

@router.get("/{mission_id}/questions", response_model=List[schemas.Question])
def get_mission_questions(mission_id: str, db: Session = Depends(get_db)):
    questions = db.query(models.Question).filter(models.Question.missionId == mission_id).all()
    return questions
