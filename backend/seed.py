import os
import sys
from datetime import datetime, timedelta
from database import SessionLocal, engine, Base
import models
from auth_utils import hash_password

# Recreate all tables cleanly
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

db = SessionLocal()

print("[Seed] Creating demo users...")
# 1. Student: Peter Parker
student = models.User(
    name="Peter Parker",
    email="peter@mathverse.edu",
    password_hash=hash_password("password123"),
    role="student",
    points=850,
    level=3,
    student_code="SPIDER-2026"
)
db.add(student)
db.commit()
db.refresh(student)

# 2. Parent: Aunt May
parent = models.User(
    name="Aunt May",
    email="may@mathverse.edu",
    password_hash=hash_password("password123"),
    role="parent",
    points=0,
    level=1,
    linked_student_id=student.userId
)
db.add(parent)

# 3. Teacher: Prof. Curt Connors
teacher = models.User(
    name="Prof. Curt Connors",
    email="connors@mathverse.edu",
    password_hash=hash_password("password123"),
    role="teacher",
    points=0,
    level=1,
    linked_student_id=student.userId
)
db.add(teacher)
db.commit()

print("[Seed] Creating missions...")
missions = [
    models.Mission(missionId="goblin", topic="solving linear equations", difficulty=1),
    models.Mission(missionId="doc-ock", topic="calculating area and perimeter", difficulty=2),
    models.Mission(missionId="mysterio", topic="number sequences and patterns", difficulty=3),
    models.Mission(missionId="venom", topic="percentages and fractions", difficulty=4),
    models.Mission(missionId="lizard", topic="radicals and exponents", difficulty=5),
    models.Mission(missionId="kingpin", topic="ratios and proportions", difficulty=6),
]
db.add_all(missions)

print("[Seed] Creating curriculum topic mastery for student...")
masteries = [
    models.TopicMastery(userId=student.userId, topic="solving linear equations", masteryLevel=0.92),
    models.TopicMastery(userId=student.userId, topic="calculating area and perimeter", masteryLevel=0.78),
    models.TopicMastery(userId=student.userId, topic="number sequences and patterns", masteryLevel=0.85),
    models.TopicMastery(userId=student.userId, topic="percentages and fractions", masteryLevel=0.64),
    models.TopicMastery(userId=student.userId, topic="radicals and exponents", masteryLevel=0.45),
    models.TopicMastery(userId=student.userId, topic="ratios and proportions", masteryLevel=0.52),
]
db.add_all(masteries)

print("[Seed] Creating historical mission attempts...")
now = datetime.utcnow()
attempts = [
    models.MissionAttempt(
        userId=student.userId,
        villain="Green Goblin",
        score=10,
        timeTaken=14,
        hintUsed=False,
        cognitiveState="Focused",
        timestamp=now - timedelta(days=3, hours=4)
    ),
    models.MissionAttempt(
        userId=student.userId,
        villain="Green Goblin",
        score=10,
        timeTaken=18,
        hintUsed=False,
        cognitiveState="Focused",
        timestamp=now - timedelta(days=3, hours=2)
    ),
    models.MissionAttempt(
        userId=student.userId,
        villain="Doctor Octopus",
        score=10,
        timeTaken=32,
        hintUsed=True,
        cognitiveState="Overwhelmed",
        timestamp=now - timedelta(days=2, hours=5)
    ),
    models.MissionAttempt(
        userId=student.userId,
        villain="Doctor Octopus",
        score=10,
        timeTaken=21,
        hintUsed=False,
        cognitiveState="Focused",
        timestamp=now - timedelta(days=2, hours=3)
    ),
    models.MissionAttempt(
        userId=student.userId,
        villain="Mysterio",
        score=10,
        timeTaken=16,
        hintUsed=False,
        cognitiveState="Focused",
        timestamp=now - timedelta(days=1, hours=6)
    ),
    models.MissionAttempt(
        userId=student.userId,
        villain="Venom",
        score=0,
        timeTaken=41,
        hintUsed=True,
        cognitiveState="Drifting",
        timestamp=now - timedelta(hours=8)
    ),
    models.MissionAttempt(
        userId=student.userId,
        villain="Venom",
        score=10,
        timeTaken=20,
        hintUsed=False,
        cognitiveState="Focused",
        timestamp=now - timedelta(hours=2)
    ),
]
db.add_all(attempts)

db.commit()
db.close()
print("[OK] MathVerse database successfully re-seeded with Student, Parent, and Teacher accounts!")
