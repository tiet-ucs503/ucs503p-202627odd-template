"""Request and response shapes. Requests reject unknown fields (extra="forbid")."""
from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

Role = Literal["student", "parent", "teacher"]


class _Request(BaseModel):
    model_config = ConfigDict(extra="forbid")


# ── Auth ─────────────────────────────────────────────────────────────────────
class RegisterRequest(_Request):
    name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)  # bcrypt reads at most 72 bytes
    role: Role


class LoginRequest(_Request):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    role: Role
    points: int
    level: int
    link_code: Optional[str] = None
    is_demo: bool


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ── Game ─────────────────────────────────────────────────────────────────────
class ProgressOut(BaseModel):
    points: int
    level: int
    unlocked_bosses: List[str]
    missions_won: int
    link_code: Optional[str] = None


class QuestionOut(BaseModel):
    """What the student sees. The correct answer is deliberately absent."""

    attempt_id: int
    text: str
    options: List[str]
    topic: str
    difficulty: str


class SessionState(BaseModel):
    id: int
    boss_id: str
    status: Literal["active", "victory", "defeat", "abandoned"]
    correct_count: int
    wrong_count: int
    streak: int
    questions_to_win: int
    max_wrong: int
    points_awarded: int


class StartSessionRequest(_Request):
    boss_id: str


class StartSessionResponse(BaseModel):
    session: SessionState
    question: QuestionOut


class AttentionSummary(_Request):
    """Numbers computed in the browser. Images and video are never accepted."""

    face_present_pct: float = Field(ge=0, le=100)
    on_screen_pct: float = Field(ge=0, le=100)
    blink_rate_per_min: Optional[float] = Field(default=None, ge=0, le=200)
    sample_seconds: float = Field(ge=0, le=3600)


class AnswerRequest(_Request):
    selected_index: Optional[int] = Field(default=None, ge=0, le=3)  # null = ran out of time
    response_time_ms: int = Field(ge=0, le=3_600_000)
    hint_used: bool = False
    attention: Optional[AttentionSummary] = None  # null = camera not used


class AnswerResponse(BaseModel):
    correct: bool
    correct_index: int
    points_awarded: int
    bonus_points: int
    mastery: float
    session_status: str
    session: SessionState
    progress: ProgressOut
    next_question: Optional[QuestionOut] = None


class HintOut(BaseModel):
    hint: str


# ── Guardians ────────────────────────────────────────────────────────────────
class LinkRequest(_Request):
    link_code: str = Field(min_length=4, max_length=32)


class LinkedStudent(BaseModel):
    id: int
    name: str
    level: int
    points: int
    is_demo: bool


# ── Reports ──────────────────────────────────────────────────────────────────
class TopicMasteryOut(BaseModel):
    topic: str
    label: str
    mastery_pct: Optional[int] = None  # None = topic not started
    questions_answered: int


class RecentAttemptOut(BaseModel):
    id: int
    boss_name: str
    topic_label: str
    is_correct: bool
    response_time_s: float
    hint_used: bool
    points_awarded: int
    answered_at: datetime
    attention_label: Optional[str] = None  # None = not measured


class AttentionOut(BaseModel):
    measured_questions: int
    total_questions: int
    avg_on_screen_pct: Optional[int] = None  # None when nothing was measured


class StudentReport(BaseModel):
    student_id: int
    student_name: str
    is_demo: bool
    points: int
    level: int
    questions_answered: int
    correct_answers: int
    accuracy_pct: Optional[int] = None  # None when no questions answered
    practice_minutes: int
    missions_played: int
    missions_won: int
    bosses_defeated: int
    total_bosses: int
    topic_mastery: List[TopicMasteryOut]
    recent_attempts: List[RecentAttemptOut]
    attention: AttentionOut
