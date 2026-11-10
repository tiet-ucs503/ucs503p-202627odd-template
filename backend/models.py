from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"
    userId = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True, nullable=True)
    password_hash = Column(String, nullable=True)
    role = Column(String, default="student") # student, teacher, parent
    points = Column(Integer, default=0)
    level = Column(Integer, default=1)
    student_code = Column(String, unique=True, index=True, nullable=True)
    linked_student_id = Column(Integer, ForeignKey("users.userId"), nullable=True)
    
    attempts = relationship("MissionAttempt", back_populates="user", cascade="all, delete-orphan")
    mastery = relationship("TopicMastery", back_populates="user", cascade="all, delete-orphan")
    reports = relationship("LearningReport", back_populates="user", cascade="all, delete-orphan")

class Mission(Base):
    __tablename__ = "missions"
    missionId = Column(String, primary_key=True, index=True)
    topic = Column(String, index=True)
    difficulty = Column(Integer, default=1)
    
    questions = relationship("Question", back_populates="mission")

class Question(Base):
    __tablename__ = "questions"
    questionId = Column(Integer, primary_key=True, index=True)
    missionId = Column(String, ForeignKey("missions.missionId"))
    text = Column(String)
    difficulty = Column(Integer, default=1)
    
    mission = relationship("Mission", back_populates="questions")

class TopicMastery(Base):
    __tablename__ = "topic_mastery"
    masteryId = Column(Integer, primary_key=True, index=True)
    userId = Column(Integer, ForeignKey("users.userId"))
    topic = Column(String, index=True)
    masteryLevel = Column(Float, default=0.0)
    
    user = relationship("User", back_populates="mastery")

class MissionAttempt(Base):
    __tablename__ = "mission_attempts"
    attemptId = Column(Integer, primary_key=True, index=True)
    userId = Column(Integer, ForeignKey("users.userId"))
    villain = Column(String, default="Green Goblin")
    score = Column(Integer, default=0)
    timeTaken = Column(Integer, default=0)
    hintUsed = Column(Boolean, default=False)
    cognitiveState = Column(String, default="Focused")
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="attempts")
    hints = relationship("HintHistory", back_populates="attempt")

class HintHistory(Base):
    __tablename__ = "hint_history"
    hintId = Column(Integer, primary_key=True, index=True)
    attemptId = Column(Integer, ForeignKey("mission_attempts.attemptId"))
    hintText = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    attempt = relationship("MissionAttempt", back_populates="hints")

class LearningReport(Base):
    __tablename__ = "learning_reports"
    reportId = Column(Integer, primary_key=True, index=True)
    userId = Column(Integer, ForeignKey("users.userId"))
    totalScore = Column(Integer, default=0)
    badges = Column(String, default="") # Comma-separated badges
    aiSummary = Column(Text, nullable=True)
    focusPercentage = Column(Float, default=0.0)
    averageAccuracy = Column(Float, default=0.0)
    generatedAt = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="reports")

class Badge(Base):
    __tablename__ = "badges"
    badgeId = Column(Integer, primary_key=True, index=True)
    criteria = Column(String)
