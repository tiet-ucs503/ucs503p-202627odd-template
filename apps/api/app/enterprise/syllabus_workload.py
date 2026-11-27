"""Syllabus Progress Tracking, Configurable Workload Policy & HOD-Approved Class Cancellation Engine."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Any

from app.enterprise.notification_hub import TargetedNotificationHub


@dataclass
class SyllabusTopic:
    topic_id: str
    unit_id: str
    course_code: str
    title: str
    weight: float = 1.0
    status: str = "PENDING"  # PENDING | IN_PROGRESS | COMPLETED
    target_date: date | None = None
    completed_session_id: str | None = None
    notes: str = ""


@dataclass
class TeachingSessionRecord:
    session_id: str
    course_code: str
    faculty_id: str
    section_id: str
    department_id: str
    day: str
    period: int
    session_type: str  # LECTURE | PRACTICAL | TUTORIAL
    status: str = "SCHEDULED"  # SCHEDULED | COMPLETED | CANCELLED


@dataclass
class CancellationRequest:
    request_id: str
    session_id: str
    faculty_id: str
    department_id: str
    section_id: str
    reason: str
    description: str = ""
    status: str = "SUBMITTED"  # SUBMITTED | APPROVED | REJECTED
    reviewed_by: str | None = None


@dataclass(frozen=True)
class WorkloadPolicyRule:
    policy_version: str
    designation: str
    min_weekly_hours: int
    max_weekly_hours: int
    source_type: str  # REGULATORY | INSTITUTIONAL | DEPARTMENTAL


@dataclass(frozen=True)
class FacultyWorkloadReport:
    faculty_id: str
    designation: str
    lecture_hours: int
    practical_hours: int
    tutorial_hours: int
    scheduled_hours: int
    completed_sessions: int
    cancelled_sessions: int
    pending_sessions: int
    daily_distribution: dict[str, int]
    status_flag: str  # BALANCED | OVERLOADED | UNDERUTILIZED
    policy_note: str


class AcademicProgressAndWorkloadService:
    """Connects Timetable Sessions, Faculty Cancellations, HOD Approvals, Syllabus Progress & Workload Policies."""

    def __init__(self, hub: TargetedNotificationHub) -> None:
        self.hub = hub
        self.sessions: dict[str, TeachingSessionRecord] = {}
        self.topics: dict[str, SyllabusTopic] = {}
        self.planned_sessions_by_course: dict[str, int] = {}
        self.assigned_courses_by_faculty: dict[str, set[str]] = defaultdict(set)
        self.cancellations: dict[str, CancellationRequest] = {}
        self.progress_history: list[dict[str, Any]] = []
        self.audit_log: list[dict[str, Any]] = []
        self.policies: dict[str, WorkloadPolicyRule] = {
            "Professor": WorkloadPolicyRule("v2026.1", "Professor", 8, 14, "INSTITUTIONAL"),
            "Associate Professor": WorkloadPolicyRule("v2026.1", "Associate Professor", 10, 14, "INSTITUTIONAL"),
            "Assistant Professor": WorkloadPolicyRule("v2026.1", "Assistant Professor", 12, 16, "INSTITUTIONAL"),
        }

    def register_session(self, sess: TeachingSessionRecord) -> None:
        self.sessions[sess.session_id] = sess
        self.assigned_courses_by_faculty[sess.faculty_id].add(sess.course_code)

    def add_topic(self, topic: SyllabusTopic) -> None:
        self.topics[topic.topic_id] = topic

    def update_topic_progress(
        self,
        faculty_id: str,
        topic_id: str,
        new_status: str,
        session_id: str | None = None,
        notes: str = "",
    ) -> SyllabusTopic:
        topic = self.topics.get(topic_id)
        if topic is None:
            raise ValueError("Topic not found.")
        if topic.course_code not in self.assigned_courses_by_faculty.get(faculty_id, set()):
            raise PermissionError("Faculty is not assigned to this course.")
        if new_status == "COMPLETED":
            if not session_id or session_id not in self.sessions:
                raise ValueError("Completing a topic requires a valid teaching session reference.")
            sess = self.sessions[session_id]
            if sess.status == "CANCELLED":
                raise ValueError("A cancelled session cannot be used to mark a topic completed.")
            sess.status = "COMPLETED"
        prev = topic.status
        topic.status = new_status
        topic.completed_session_id = session_id if new_status == "COMPLETED" else topic.completed_session_id
        topic.notes = notes
        rec = {
            "faculty_id": faculty_id,
            "topic_id": topic_id,
            "previous_status": prev,
            "new_status": new_status,
            "session_id": session_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        self.progress_history.append(rec)
        self.audit_log.append({"action": "SYLLABUS_UPDATED", **rec})
        return topic

    def calculate_syllabus_progress(self, course_code: str, today: date | None = None) -> dict[str, Any]:
        ref_today = today or date.today()
        course_topics = [t for t in self.topics.values() if t.course_code == course_code]
        total_weight = sum(t.weight for t in course_topics)
        completed_weight = sum(t.weight for t in course_topics if t.status == "COMPLETED")
        topic_pct = round((completed_weight / total_weight) * 100.0, 2) if total_weight > 0 else 0.0

        # Session-based completion: NEVER count CANCELLED sessions as completed!
        course_sessions = [s for s in self.sessions.values() if s.course_code == course_code]
        completed_sessions = sum(1 for s in course_sessions if s.status == "COMPLETED")
        cancelled_sessions = sum(1 for s in course_sessions if s.status == "CANCELLED")
        planned = self.planned_sessions_by_course.get(course_code, max(1, len(course_sessions)))
        session_pct = round((completed_sessions / planned) * 100.0, 2) if planned > 0 else 0.0

        delayed_topics = [
            t.topic_id
            for t in course_topics
            if t.status != "COMPLETED" and t.target_date is not None and t.target_date < ref_today
        ]
        return {
            "course_code": course_code,
            "topic_completion_pct": topic_pct,
            "session_completion_pct": session_pct,
            "completed_sessions": completed_sessions,
            "cancelled_sessions": cancelled_sessions,
            "planned_sessions": planned,
            "delayed_topic_ids": delayed_topics,
        }

    def request_class_cancellation(
        self,
        institution_id: str,
        faculty_id: str,
        session_id: str,
        reason: str,
        description: str = "",
    ) -> CancellationRequest:
        sess = self.sessions.get(session_id)
        if sess is None or sess.faculty_id != faculty_id:
            raise PermissionError("Faculty may only cancel their own assigned teaching session.")
        if sess.status == "CANCELLED":
            raise ValueError("Session is already cancelled.")
        req = CancellationRequest(
            request_id=f"cancel-{session_id}",
            session_id=session_id,
            faculty_id=faculty_id,
            department_id=sess.department_id,
            section_id=sess.section_id,
            reason=reason,
            description=description,
        )
        self.cancellations[req.request_id] = req
        self.audit_log.append({"action": "CANCELLATION_REQUESTED", "request_id": req.request_id, "faculty_id": faculty_id, "session_id": session_id})
        self.hub.publish(
            event_id=f"cancel_req:{req.request_id}",
            event_type="CANCELLATION_REQUESTED",
            institution_id=institution_id,
            title=f"Class Cancellation Requested: {sess.course_code}",
            body=f"Faculty {faculty_id} requested cancellation ({reason}).",
            audience_scope="DEPARTMENT",
            target_id=sess.department_id,
            payload={"request_id": req.request_id, "session_id": session_id},
        )
        return req

    def approve_class_cancellation(self, institution_id: str, hod_id: str, request_id: str) -> CancellationRequest:
        req = self.cancellations.get(request_id)
        if req is None:
            raise ValueError("Cancellation request not found.")
        sess = self.sessions[req.session_id]
        sess.status = "CANCELLED"  # Preserves original session record, never deleted
        req.status = "APPROVED"
        req.reviewed_by = hod_id
        self.audit_log.append({"action": "CANCELLATION_APPROVED", "request_id": req.request_id, "hod_id": hod_id, "session_id": sess.session_id})
        self.hub.publish(
            event_id=f"cancel_ok:{req.request_id}",
            event_type="CLASS_CANCELLED",
            institution_id=institution_id,
            title=f"Class Cancelled: {sess.course_code}",
            body=f"HOD approved cancellation of {sess.course_code} on {sess.day} P{sess.period} ({req.reason}).",
            audience_scope="SECTION",
            target_id=sess.section_id,
            payload={"session_id": sess.session_id, "request_id": req.request_id},
        )
        return req

    def calculate_faculty_workload(self, faculty_id: str, designation: str = "Assistant Professor") -> FacultyWorkloadReport:
        fac_sessions = [s for s in self.sessions.values() if s.faculty_id == faculty_id]
        active = [s for s in fac_sessions if s.status != "CANCELLED"]
        lectures = sum(1 for s in active if s.session_type == "LECTURE")
        practicals = sum(1 for s in active if s.session_type == "PRACTICAL")
        tutorials = sum(1 for s in active if s.session_type == "TUTORIAL")
        completed = sum(1 for s in fac_sessions if s.status == "COMPLETED")
        cancelled = sum(1 for s in fac_sessions if s.status == "CANCELLED")
        pending = sum(1 for s in fac_sessions if s.status == "SCHEDULED")
        daily: dict[str, int] = defaultdict(int)
        for s in active:
            daily[s.day] += 1

        total_hours = len(active)
        rule = self.policies.get(designation, WorkloadPolicyRule("v2026.1", designation, 10, 16, "INSTITUTIONAL"))
        if total_hours > rule.max_weekly_hours:
            flag = "OVERLOADED"
            note = f"Exceeds {rule.source_type} policy {rule.policy_version} cap ({rule.max_weekly_hours}h/wk)."
        elif total_hours < rule.min_weekly_hours:
            flag = "UNDERUTILIZED"
            note = f"Below {rule.source_type} policy {rule.policy_version} floor ({rule.min_weekly_hours}h/wk)."
        else:
            flag = "BALANCED"
            note = f"Within {rule.source_type} policy {rule.policy_version} ({rule.min_weekly_hours}-{rule.max_weekly_hours}h/wk)."

        return FacultyWorkloadReport(
            faculty_id=faculty_id,
            designation=designation,
            lecture_hours=lectures,
            practical_hours=practicals,
            tutorial_hours=tutorials,
            scheduled_hours=total_hours,
            completed_sessions=completed,
            cancelled_sessions=cancelled,
            pending_sessions=pending,
            daily_distribution=dict(daily),
            status_flag=flag,
            policy_note=note,
        )
