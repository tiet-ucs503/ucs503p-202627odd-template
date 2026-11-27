"""Interconnected Enterprise University Engine: Scheduling, Makeup Voting, Attendance, Finance & RBAC."""

from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from app.enterprise.notification_hub import TargetedNotificationHub


class AccessDeniedError(PermissionError):
    pass


class ConflictError(RuntimeError):
    pass


class ValidationError(ValueError):
    pass


@dataclass
class UserPrincipal:
    user_id: str
    institution_id: str
    role: str
    department_id: str | None = None
    section_id: str | None = None


@dataclass
class PublishedRoutineEntry:
    entry_id: str
    institution_id: str
    version_number: int
    department_id: str
    section_id: str
    course_code: str
    teacher_id: str
    room_id: str
    day: str
    slot_id: str
    is_makeup: bool = False
    original_entry_id: str | None = None


@dataclass
class MakeupProposal:
    option_id: str
    day: str
    slot_id: str
    room_id: str
    votes: int = 0


@dataclass
class MakeupRequestRecord:
    request_id: str
    institution_id: str
    department_id: str
    section_id: str
    course_code: str
    teacher_id: str
    original_entry_id: str
    reason: str
    deadline: datetime
    proposals: list[MakeupProposal]
    status: str = "VOTING_OPEN"  # VOTING_OPEN | VOTING_CLOSED | APPROVED | REJECTED
    votes_by_student: dict[str, str] = field(default_factory=dict)
    vote_audit: list[dict[str, Any]] = field(default_factory=list)
    approved_option_id: str | None = None


@dataclass
class AttendanceSessionRecord:
    attendance_session_id: str
    institution_id: str
    routine_entry_id: str
    course_code: str
    section_id: str
    is_makeup: bool
    makeup_request_id: str | None = None
    records: dict[str, str] = field(default_factory=dict)  # student_id -> PRESENT|ABSENT


@dataclass
class InvoiceRecord:
    invoice_id: str
    institution_id: str
    student_id: str
    amount_due: int
    amount_paid: int = 0
    status: str = "UNPAID"
    version: int = 1


class UniversityOperationsService:
    """Thread-safe, ACID-style coordinator connecting Timetable, Makeup Voting, Attendance, Finance & Notifications."""

    def __init__(self, hub: TargetedNotificationHub) -> None:
        self._lock = threading.RLock()
        self.hub = hub
        self.published_version = 0
        self.published_entries: list[PublishedRoutineEntry] = []
        self.version_history: dict[int, list[PublishedRoutineEntry]] = {}
        self.makeup_requests: dict[str, MakeupRequestRecord] = {}
        self.attendance_sessions: dict[str, AttendanceSessionRecord] = {}
        self.invoices: dict[str, InvoiceRecord] = {}
        self._processed_payment_keys: set[str] = set()
        self.audit_log: list[dict[str, Any]] = []

    def _assert_role(self, actor: UserPrincipal, allowed: tuple[str, ...]) -> None:
        if actor.role not in allowed:
            raise AccessDeniedError(f"Role {actor.role} is not authorized for this action.")

    def _check_conflict_locked(
        self,
        institution_id: str,
        teacher_id: str,
        room_id: str,
        section_id: str,
        day: str,
        slot_id: str,
    ) -> str | None:
        for e in self.published_entries:
            if e.institution_id != institution_id or e.day != day or e.slot_id != slot_id:
                continue
            if e.room_id == room_id:
                return f"Room {room_id} is already booked on {day} {slot_id}."
            if e.teacher_id == teacher_id:
                return f"Teacher {teacher_id} already teaches on {day} {slot_id}."
            if e.section_id == section_id:
                return f"Section {section_id} already has a class on {day} {slot_id}."
        return None

    # ---- COORDINATOR ROUTINE PUBLISHING & ROOM ALLOCATION (ATOMIC) ----
    def publish_routine_entry(
        self,
        actor: UserPrincipal,
        department_id: str,
        section_id: str,
        course_code: str,
        teacher_id: str,
        room_id: str,
        day: str,
        slot_id: str,
        is_makeup: bool = False,
        original_entry_id: str | None = None,
        makeup_request_id: str | None = None,
    ) -> tuple[PublishedRoutineEntry, AttendanceSessionRecord]:
        self._assert_role(actor, ("SUPER_ADMIN", "COLLEGE_ADMIN", "COORDINATOR"))
        with self._lock:
            conflict = self._check_conflict_locked(actor.institution_id, teacher_id, room_id, section_id, day, slot_id)
            if conflict:
                raise ConflictError(conflict)

            self.published_version += 1
            entry = PublishedRoutineEntry(
                entry_id=f"ent-{uuid.uuid4().hex[:8]}",
                institution_id=actor.institution_id,
                version_number=self.published_version,
                department_id=department_id,
                section_id=section_id,
                course_code=course_code,
                teacher_id=teacher_id,
                room_id=room_id,
                day=day,
                slot_id=slot_id,
                is_makeup=is_makeup,
                original_entry_id=original_entry_id,
            )
            self.published_entries.append(entry)
            self.version_history[self.published_version] = list(self.published_entries)

            # TIMETABLE -> ATTENDANCE linkage
            att = AttendanceSessionRecord(
                attendance_session_id=f"att-{uuid.uuid4().hex[:8]}",
                institution_id=actor.institution_id,
                routine_entry_id=entry.entry_id,
                course_code=course_code,
                section_id=section_id,
                is_makeup=is_makeup,
                makeup_request_id=makeup_request_id,
            )
            self.attendance_sessions[att.attendance_session_id] = att
            self.audit_log.append({"action": "ROUTINE_PUBLISHED", "actor": actor.user_id, "entry_id": entry.entry_id, "version": self.published_version})

            # TIMETABLE -> TARGETED NOTIFICATION
            self.hub.publish(
                event_id=f"pub:{entry.entry_id}:v{self.published_version}",
                event_type="TIMETABLE_PUBLISHED",
                institution_id=actor.institution_id,
                title=f"Routine v{self.published_version} Published: {course_code}",
                body=f"{course_code} scheduled on {day} ({slot_id}) in {room_id}.",
                audience_scope="SECTION",
                target_id=section_id,
                payload={"entry_id": entry.entry_id, "version": self.published_version, "attendance_session_id": att.attendance_session_id},
            )
            return entry, att

    # ---- DEPARTMENT-SCOPED READ (SECURITY ENFORCEMENT) ----
    def get_department_entries(self, actor: UserPrincipal, department_id: str) -> list[PublishedRoutineEntry]:
        if actor.role not in ("SUPER_ADMIN", "COLLEGE_ADMIN", "COORDINATOR") and actor.department_id != department_id:
            raise AccessDeniedError("Cannot access private data belonging to another department.")
        with self._lock:
            return [e for e in self.published_entries if e.institution_id == actor.institution_id and e.department_id == department_id]

    # ---- MAKEUP CLASS REQUEST -> VOTING -> CONFLICT-VALIDATED APPROVAL -> TIMETABLE + ATTENDANCE ----
    def create_makeup_request(
        self,
        actor: UserPrincipal,
        department_id: str,
        section_id: str,
        course_code: str,
        teacher_id: str,
        original_entry_id: str,
        reason: str,
        deadline: datetime,
        proposals: list[tuple[str, str, str]],  # (day, slot_id, room_id)
    ) -> MakeupRequestRecord:
        self._assert_role(actor, ("SUPER_ADMIN", "COLLEGE_ADMIN", "COORDINATOR", "HOD", "FACULTY", "CLASS_REPRESENTATIVE"))
        if not proposals:
            raise ValidationError("At least one proposed slot is required.")
        with self._lock:
            req = MakeupRequestRecord(
                request_id=f"mk-{uuid.uuid4().hex[:8]}",
                institution_id=actor.institution_id,
                department_id=department_id,
                section_id=section_id,
                course_code=course_code,
                teacher_id=teacher_id,
                original_entry_id=original_entry_id,
                reason=reason,
                deadline=deadline,
                proposals=[MakeupProposal(option_id=f"opt-{i+1}", day=d, slot_id=s, room_id=r) for i, (d, s, r) in enumerate(proposals)],
            )
            self.makeup_requests[req.request_id] = req
            self.hub.publish(
                event_id=f"makeup_req:{req.request_id}",
                event_type="MAKEUP_POLL_CREATED",
                institution_id=actor.institution_id,
                title=f"Vote on Makeup Class: {course_code}",
                body=f"Vote before {deadline.isoformat()} for {course_code} ({reason}).",
                audience_scope="SECTION",
                target_id=section_id,
                payload={"request_id": req.request_id},
            )
            return req

    def cast_student_vote(
        self,
        actor: UserPrincipal,
        request_id: str,
        option_id: str,
        now: datetime | None = None,
    ) -> MakeupRequestRecord:
        self._assert_role(actor, ("STUDENT", "CLASS_REPRESENTATIVE"))
        ref_now = now or datetime.now(timezone.utc)
        with self._lock:
            req = self.makeup_requests.get(request_id)
            if req is None or req.institution_id != actor.institution_id:
                raise ValidationError("Makeup request not found.")
            if actor.section_id != req.section_id:
                raise AccessDeniedError("Only students in the affected section may vote.")
            if req.status != "VOTING_OPEN" or ref_now >= req.deadline:
                req.status = "VOTING_CLOSED"
                raise ConflictError("Voting deadline has passed; poll is closed.")
            option_map = {p.option_id: p for p in req.proposals}
            if option_id not in option_map:
                raise ValidationError("Invalid proposal option.")

            prev = req.votes_by_student.get(actor.user_id)
            if prev == option_id:
                return req  # Idempotent duplicate vote
            if prev is not None:
                option_map[prev].votes -= 1
            option_map[option_id].votes += 1
            req.votes_by_student[actor.user_id] = option_id
            req.vote_audit.append({"student_id": actor.user_id, "from": prev, "to": option_id, "at": ref_now.isoformat()})
            return req

    def close_and_approve_makeup(
        self,
        actor: UserPrincipal,
        request_id: str,
    ) -> tuple[PublishedRoutineEntry, AttendanceSessionRecord]:
        self._assert_role(actor, ("SUPER_ADMIN", "COLLEGE_ADMIN", "COORDINATOR"))
        with self._lock:
            req = self.makeup_requests.get(request_id)
            if req is None or req.institution_id != actor.institution_id:
                raise ValidationError("Makeup request not found.")
            if req.status == "APPROVED":
                raise ConflictError("Makeup request is already approved.")
            req.status = "VOTING_CLOSED"

            # Never assume most-voted slot is conflict-free; validate in ranked vote order!
            ranked = sorted(req.proposals, key=lambda p: (-p.votes, p.option_id))
            chosen: MakeupProposal | None = None
            last_conflict = "No valid slot available."
            for cand in ranked:
                conflict = self._check_conflict_locked(
                    req.institution_id, req.teacher_id, cand.room_id, req.section_id, cand.day, cand.slot_id
                )
                if conflict is None:
                    chosen = cand
                    break
                last_conflict = conflict
            if chosen is None:
                raise ConflictError(f"All voted slots have conflicts: {last_conflict}")

            entry, att = self.publish_routine_entry(
                actor=actor,
                department_id=req.department_id,
                section_id=req.section_id,
                course_code=req.course_code,
                teacher_id=req.teacher_id,
                room_id=chosen.room_id,
                day=chosen.day,
                slot_id=chosen.slot_id,
                is_makeup=True,
                original_entry_id=req.original_entry_id,
                makeup_request_id=req.request_id,
            )
            req.status = "APPROVED"
            req.approved_option_id = chosen.option_id
            return entry, att

    # ---- IDEMPOTENT ATTENDANCE & PAYMENT CALLBACKS ----
    def mark_attendance(self, actor: UserPrincipal, attendance_session_id: str, student_id: str, status: str) -> float:
        self._assert_role(actor, ("SUPER_ADMIN", "COLLEGE_ADMIN", "COORDINATOR", "FACULTY"))
        with self._lock:
            sess = self.attendance_sessions.get(attendance_session_id)
            if sess is None:
                raise ValidationError("Attendance session not found.")
            sess.records[student_id] = status  # Idempotent upsert per (session, student)
            # Compute updated student attendance percentage across all sessions
            total = sum(1 for s in self.attendance_sessions.values() if student_id in s.records)
            present = sum(1 for s in self.attendance_sessions.values() if s.records.get(student_id) == "PRESENT")
            return round((present / total) * 100.0, 2) if total else 0.0

    def process_payment_callback(self, invoice_id: str, idempotency_key: str, amount_minor: int) -> InvoiceRecord:
        with self._lock:
            inv = self.invoices.get(invoice_id)
            if inv is None:
                raise ValidationError("Invoice not found.")
            if idempotency_key in self._processed_payment_keys:
                return inv  # Duplicate callback safely ignored
            self._processed_payment_keys.add(idempotency_key)
            inv.amount_paid += amount_minor
            inv.version += 1
            inv.status = "PAID" if inv.amount_paid >= inv.amount_due else "PARTIAL"
            return inv
