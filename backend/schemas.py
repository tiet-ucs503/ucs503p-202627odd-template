from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime

# Users & Auth
class UserBase(BaseModel):
    name: str
    role: str = "student" # student, teacher, parent
    email: Optional[EmailStr] = None

class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "student"
    student_code: Optional[str] = None # For parents/teachers linking a student on sign-up
    student_email: Optional[EmailStr] = None # Student email provided by parent/teacher

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserCreate(UserBase):
    password_hash: Optional[str] = None

class User(UserBase):
    userId: int
    points: int = 0
    level: int = 1
    student_code: Optional[str] = None
    linked_student_id: Optional[int] = None
    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: User

# Missions
class MissionBase(BaseModel):
    missionId: str
    topic: str
    difficulty: int

class Mission(MissionBase):
    class Config:
        from_attributes = True

# Questions
class QuestionBase(BaseModel):
    text: str
    difficulty: int

class Question(QuestionBase):
    questionId: int
    missionId: str
    class Config:
        from_attributes = True

# Topic Mastery
class TopicMasteryBase(BaseModel):
    topic: str
    masteryLevel: float

class TopicMastery(TopicMasteryBase):
    masteryId: int
    userId: int
    class Config:
        from_attributes = True

# Attempts
class MissionAttemptBase(BaseModel):
    score: int
    timeTaken: int
    hintUsed: bool
    bossId: Optional[str] = "goblin"
    villain: Optional[str] = "Green Goblin"
    cognitiveState: Optional[str] = "Focused"

class MissionAttemptCreate(MissionAttemptBase):
    pass

class MissionAttempt(MissionAttemptBase):
    attemptId: int
    userId: int
    timestamp: datetime
    class Config:
        from_attributes = True

class MissionAttemptResponse(BaseModel):
    attempt: MissionAttempt
    next_question: Optional[dict] = None
    gwen_hint: Optional[str] = None
    cognitive_state: Optional[str] = "Focused"
    predicted_probability: Optional[float] = None

# Hint History
class HintHistoryBase(BaseModel):
    hintText: str

class HintHistory(HintHistoryBase):
    hintId: int
    attemptId: int
    timestamp: datetime
    class Config:
        from_attributes = True

# Learning Reports & Analytics
class LinkStudentRequest(BaseModel):
    student_code_or_id: str

class TopicMasteryItem(BaseModel):
    topic: str
    mastery_percent: int
    status: str # "Mastered" | "Proficient" | "Needs Practice"

class CognitiveProfile(BaseModel):
    focused_rate: int
    drifting_rate: int
    impulsive_rate: int
    overwhelmed_rate: int
    avg_blink_rate: float
    avg_gaze_stability: int
    cognitive_load_index: str # "Optimal" | "Moderate" | "Elevated"

class StudentAnalyticsResponse(BaseModel):
    student_id: int
    student_name: str
    student_code: str
    role: str
    points: int
    level: int
    total_missions_cleared: int
    total_questions_attempted: int
    accuracy_percentage: int
    total_time_minutes: int
    cognitive_profile: CognitiveProfile
    topic_mastery: List[TopicMasteryItem]
    recent_attempts: List[Dict[str, Any]]
    badges: List[str]
    ai_guardian_summary: str
    guardian_recommendation: str

class LearningReport(BaseModel):
    reportId: int
    userId: int
    totalScore: int
    badges: str
    aiSummary: Optional[str] = None
    focusPercentage: float
    averageAccuracy: float
    generatedAt: datetime
    class Config:
        from_attributes = True

class Badge(BaseModel):
    badgeId: int
    criteria: str
    class Config:
        from_attributes = True
