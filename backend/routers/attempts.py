import json
from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional

import models, schemas
from database import get_db
from routers.eye_tracking import get_user_latest_telemetry, get_user_eye_history, record_question_attempt

router = APIRouter(
    prefix="/attempts",
    tags=["attempts"],
)

BOSS_TOPICS = {
    'goblin': "solving linear equations",
    'doc-ock': "calculating area and perimeter",
    'mysterio': "number sequences and patterns",
    'venom': "percentages and fractions",
    'lizard': "radicals and exponents",
    'kingpin': "ratios and proportions"
}

BOSS_NAMES = {
    'goblin': "Green Goblin",
    'doc-ock': "Doctor Octopus",
    'mysterio': "Mysterio",
    'venom': "Venom",
    'lizard': "The Lizard",
    'kingpin': "Kingpin"
}

def analyze_behavior(attempt_id: int, user_id: int = 1, score: int = 10, time_taken: int = 15, boss_id: str = "goblin"):
    print(f"[AI] Running LSTM temporal analysis on attempt {attempt_id} for user {user_id}...")
    try:
        from ml.attention_model import predict_risk
        from services.rag_tutor import generate_dynamic_question, generate_gwen_hint
        
        # 1. Fetch live telemetry from the eye tracking module
        telemetry = get_user_latest_telemetry(user_id)
        cognitive_state = telemetry.get("attention_state", "Focused")
        metrics = telemetry.get("metrics", {})
        
        # 2. Formulate current attempt feature record
        current_record = {
            "correct": 1 if score > 0 else 0,
            "response_time_s": float(time_taken),
            "attention_state_eye": cognitive_state,
            "eye_blink_rate": metrics.get("blink_rate", 18.0),
            "eye_pupil_dilation": metrics.get("pupil_dilation", 5.0),
            "eye_fixation_duration": metrics.get("fixation_duration", 350.0),
            "eye_saccade_rate": metrics.get("saccade_rate", 1.8),
            "eye_gaze_stability": metrics.get("gaze_stability", 0.90)
        }
        
        # 3. Retrieve historical question attempts
        history = get_user_eye_history(user_id)
        full_history = history + [current_record]
        
        # 4. Predict probability using pre-trained Knowledge Tracing LSTM
        probability = float(predict_risk(full_history))

        # 5. Record this completed attempt in the student's telemetry history
        record_question_attempt(user_id, current_record)
        
        # 6. Adaptive difficulty calibration based on both mastery probability & cognitive state
        if probability < 0.45 or cognitive_state in ["Drifting", "Overwhelmed"]:
            difficulty = "easy"
        elif probability > 0.75 and cognitive_state == "Focused":
            difficulty = "hard"
        else:
            difficulty = "medium"
            
        topic = BOSS_TOPICS.get(boss_id, "solving linear equations")
        villain = BOSS_NAMES.get(boss_id, "Green Goblin")

        # 6. RAG-grounded dynamic question generation
        question_json = generate_dynamic_question(villain, topic, difficulty)

        try:
            clean_json = question_json.strip()
            if clean_json.startswith("```json"): clean_json = clean_json[7:]
            if clean_json.endswith("```"): clean_json = clean_json[:-3]
            question_data = json.loads(clean_json.strip())
            actual_question_text = question_data.get("question", topic)
        except Exception as e:
            print(f"[AI] Failed to parse JSON: {e}")
            question_data = {}
            actual_question_text = topic

        # 7. Spider-Gwen adaptive hint grounded in curriculum + cognitive state
        hint = generate_gwen_hint(villain, actual_question_text, cognitive_state)
        return question_data, hint, cognitive_state, probability
            
    except Exception as e:
        print(f"[AI] LSTM or LLM inference failed: {e}")
        return {}, "Gwen: Comms are down, trust your spider-sense!", "Focused", 0.70

@router.get("/start/{boss_id}")
def get_initial_question(boss_id: str, user_id: int = 1):
    """Generates the very first AI question for a mission without needing a prior attempt."""
    from services.rag_tutor import generate_dynamic_question, generate_gwen_hint
    from ml.attention_model import predict_risk
    
    # Calculate real initial probability from user's history
    history = get_user_eye_history(user_id)
    initial_prob = predict_risk(history) if history else 0.68
    
    topic = BOSS_TOPICS.get(boss_id, "solving linear equations")
    villain = BOSS_NAMES.get(boss_id, "Green Goblin")
    
    question_json = generate_dynamic_question(villain, topic, "medium")
    
    try:
        clean_json = question_json.strip()
        if clean_json.startswith("```json"): clean_json = clean_json[7:]
        if clean_json.endswith("```"): clean_json = clean_json[:-3]
        question_data = json.loads(clean_json.strip())
        actual_q = question_data.get("question", topic)
    except Exception as e:
        print(f"[AI] Failed to parse JSON: {e}")
        question_data = {}
        actual_q = topic
        
    initial_hint = generate_gwen_hint(villain, actual_q, "Focused")
    return {
        "next_question": question_data, 
        "gwen_hint": initial_hint,
        "cognitive_state": "Focused",
        "predicted_probability": round(float(initial_prob), 3)
    }

@router.post("/", response_model=schemas.MissionAttemptResponse)
def submit_attempt(attempt: schemas.MissionAttemptCreate, user_id: int = 1, db: Session = Depends(get_db)):
    boss_id = attempt.bossId or "goblin"
    villain_name = BOSS_NAMES.get(boss_id, "Green Goblin")

    question_data, gwen_hint, cognitive_state, probability = analyze_behavior(
        attempt_id=0,
        user_id=user_id,
        score=attempt.score,
        time_taken=attempt.timeTaken,
        boss_id=boss_id
    )

    db_attempt = models.MissionAttempt(
        userId=user_id,
        villain=villain_name,
        score=attempt.score,
        timeTaken=attempt.timeTaken,
        hintUsed=attempt.hintUsed,
        cognitiveState=cognitive_state
    )
    db.add(db_attempt)
    
    user = db.query(models.User).filter(models.User.userId == user_id).first()
    if not user:
        user = models.User(
            userId=user_id,
            name="Spider-Cadet",
            role="student",
            points=max(0, attempt.score),
            level=1
        )
        db.add(user)
    elif attempt.score > 0:
        user.points = (user.points or 0) + attempt.score

    # Dynamically update Topic Mastery for this student
    topic = BOSS_TOPICS.get(boss_id, "solving linear equations")
    mastery = db.query(models.TopicMastery).filter(
        models.TopicMastery.userId == user_id,
        models.TopicMastery.topic == topic
    ).first()
    if not mastery:
        init_level = 0.50 if attempt.score > 0 else 0.30
        mastery = models.TopicMastery(userId=user_id, topic=topic, masteryLevel=init_level)
        db.add(mastery)
    else:
        if attempt.score > 0:
            mastery.masteryLevel = min(1.0, round(mastery.masteryLevel + 0.08, 2))
        else:
            mastery.masteryLevel = max(0.10, round(mastery.masteryLevel - 0.04, 2))

    db.commit()
    db.refresh(db_attempt)
    
    return schemas.MissionAttemptResponse(
        attempt=db_attempt,
        next_question=question_data,
        gwen_hint=gwen_hint,
        cognitive_state=cognitive_state,
        predicted_probability=probability
    )

@router.post("/victory")
def record_victory(user_id: int, boss_id: str, bonus_points: int = 500, db: Session = Depends(get_db)):
    """Records boss defeat victory, updates level, points, and advances mastery."""
    villain_name = BOSS_NAMES.get(boss_id, "Green Goblin")
    
    db_attempt = models.MissionAttempt(
        userId=user_id,
        villain=villain_name,
        score=bonus_points,
        timeTaken=45,
        hintUsed=False,
        cognitiveState="Focused"
    )
    db.add(db_attempt)
    
    user = db.query(models.User).filter(models.User.userId == user_id).first()
    if user:
        user.points = (user.points or 0) + bonus_points
        cleared_villains = db.query(models.MissionAttempt.villain).filter(
            models.MissionAttempt.userId == user_id,
            models.MissionAttempt.score > 0
        ).distinct().count()
        user.level = max(user.level or 1, cleared_villains + 1)
        
    topic = BOSS_TOPICS.get(boss_id, "solving linear equations")
    mastery = db.query(models.TopicMastery).filter(
        models.TopicMastery.userId == user_id,
        models.TopicMastery.topic == topic
    ).first()
    if not mastery:
        mastery = models.TopicMastery(userId=user_id, topic=topic, masteryLevel=0.90)
        db.add(mastery)
    else:
        mastery.masteryLevel = min(1.0, round(mastery.masteryLevel + 0.15, 2))
        
    db.commit()
    return {
        "status": "victory recorded",
        "points": user.points if user else 0,
        "level": user.level if user else 1
    }
