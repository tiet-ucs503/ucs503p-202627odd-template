from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from database import Base


def utcnow() -> datetime:
    # Stored as naive UTC; SQLite has no timezone type.
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)  # student | parent | teacher
    points = Column(Integer, nullable=False, default=0)
    level = Column(Integer, nullable=False, default=1)
    # Students only: the code a parent or teacher must enter to link to this child.
    link_code = Column(String, unique=True, index=True, nullable=True)
    # Demo accounts hold synthetic data and can never be linked with real accounts.
    is_demo = Column(Boolean, nullable=False, default=False)
    # Set once the account has signed in with Google: Google's permanent account id.
    google_sub = Column(String, unique=True, index=True, nullable=True)
    # False only for a password sign-up whose email has not been confirmed yet.
    # Google and demo accounts, and accounts made before verification existed, are True.
    email_verified = Column(Boolean, nullable=False, default=True)
    # The pending 6-digit code, stored only as a keyed hash (services/verification.py).
    verify_code_hash = Column(String, nullable=True)
    verify_expires_at = Column(DateTime, nullable=True)
    verify_sent_at = Column(DateTime, nullable=True)
    verify_attempts = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=utcnow)


class GuardianLink(Base):
    """A parent or teacher who may view one student's reports. Many-to-many."""

    __tablename__ = "guardian_links"
    __table_args__ = (UniqueConstraint("guardian_id", "student_id"),)

    id = Column(Integer, primary_key=True)
    guardian_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=utcnow)


class PlaySession(Base):
    """One boss battle: a run of questions that ends in victory, defeat or abandonment."""

    __tablename__ = "play_sessions"

    id = Column(Integer, primary_key=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    boss_id = Column(String, nullable=False)
    topic = Column(String, nullable=False)
    status = Column(String, nullable=False, default="active")  # active|victory|defeat|abandoned
    correct_count = Column(Integer, nullable=False, default=0)
    wrong_count = Column(Integer, nullable=False, default=0)
    streak = Column(Integer, nullable=False, default=0)
    points_awarded = Column(Integer, nullable=False, default=0)
    started_at = Column(DateTime, nullable=False, default=utcnow)
    ended_at = Column(DateTime, nullable=True)

    attempts = relationship("Attempt", back_populates="session")


class Attempt(Base):
    """One question served to a student. Created when served, completed when answered."""

    __tablename__ = "attempts"

    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey("play_sessions.id"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    topic = Column(String, nullable=False)
    difficulty = Column(String, nullable=False, default="medium")

    question_text = Column(Text, nullable=False)
    options_json = Column(Text, nullable=False)
    correct_index = Column(Integer, nullable=False)  # never sent to the client before answering
    hint_text = Column(Text, nullable=False, default="")

    selected_index = Column(Integer, nullable=True)  # NULL = unanswered or timed out
    is_correct = Column(Boolean, nullable=True)  # NULL until answered
    response_time_ms = Column(Integer, nullable=True)
    hint_used = Column(Boolean, nullable=False, default=False)
    points_awarded = Column(Integer, nullable=False, default=0)
    mastery_before = Column(Float, nullable=True)
    mastery_after = Column(Float, nullable=True)

    # Optional attention estimate. NULL means "not measured" (camera off or
    # unavailable). It is stored and reported, and never read by anything academic.
    face_present_pct = Column(Float, nullable=True)
    on_screen_pct = Column(Float, nullable=True)
    blink_rate_per_min = Column(Float, nullable=True)
    attention_score = Column(Float, nullable=True)
    attention_label = Column(String, nullable=True)

    served_at = Column(DateTime, nullable=False, default=utcnow)
    answered_at = Column(DateTime, nullable=True)

    session = relationship("PlaySession", back_populates="attempts")


class TopicMastery(Base):
    __tablename__ = "topic_mastery"
    __table_args__ = (UniqueConstraint("student_id", "topic"),)

    id = Column(Integer, primary_key=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    topic = Column(String, nullable=False)
    p_mastery = Column(Float, nullable=False)
    attempts_count = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)
