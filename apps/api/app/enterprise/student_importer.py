"""High-Throughput Batched Student Dataset Importer & Automatic Group-to-Timetable Mapper (50,000+ Students)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class StudentImportRow:
    enrollment_number: str
    email: str
    full_name: str
    department_code: str
    program_code: str
    semester: int
    section_name: str
    group_code: str


@dataclass
class StudentImportReport:
    total_rows: int
    valid_rows: int
    duplicate_rows: int
    invalid_rows: int
    mapped_timetables: int
    errors: list[str] = field(default_factory=list)
    group_distribution: dict[str, int] = field(default_factory=dict)


def validate_and_map_student_dataset(
    rows: list[StudentImportRow],
    valid_departments: set[str],
    section_to_timetable: dict[tuple[str, int, str], str],
    batch_size: int = 2000,
) -> tuple[list[dict[str, Any]], StudentImportReport]:
    """Validates, deduplicates, and maps 50,000+ students to their section/group/timetable in batches."""
    seen_enrollments: set[str] = set()
    seen_emails: set[str] = set()
    mapped: list[dict[str, Any]] = []
    errors: list[str] = []
    group_dist: dict[str, int] = {}
    duplicates = 0
    invalid = 0

    for start in range(0, len(rows), batch_size):
        batch = rows[start : start + batch_size]
        for idx, r in enumerate(batch, start=start + 1):
            enr = r.enrollment_number.strip().upper()
            email = r.email.strip().lower()
            dept = r.department_code.strip().upper()
            sec = r.section_name.strip().upper()
            grp = r.group_code.strip().upper()

            if not enr or not email or "@" not in email or not dept or not sec:
                invalid += 1
                if len(errors) < 50:
                    errors.append(f"Row {idx}: missing required enrollment/email/department/section.")
                continue
            if enr in seen_enrollments or email in seen_emails:
                duplicates += 1
                continue
            if dept not in valid_departments:
                invalid += 1
                if len(errors) < 50:
                    errors.append(f"Row {idx}: unknown department '{dept}'.")
                continue

            tt_id = section_to_timetable.get((dept, r.semester, sec))
            if tt_id is None:
                invalid += 1
                if len(errors) < 50:
                    errors.append(f"Row {idx}: no timetable mapped for {dept} Sem-{r.semester} {sec}.")
                continue

            seen_enrollments.add(enr)
            seen_emails.add(email)
            group_key = f"{dept}:S{r.semester}:{sec}:{grp}"
            group_dist[group_key] = group_dist.get(group_key, 0) + 1
            mapped.append(
                {
                    "enrollment_number": enr,
                    "email": email,
                    "full_name": r.full_name.strip(),
                    "department_code": dept,
                    "program_code": r.program_code.strip().upper(),
                    "semester": r.semester,
                    "section_name": sec,
                    "group_code": grp,
                    "timetable_version_id": tt_id,
                }
            )

    report = StudentImportReport(
        total_rows=len(rows),
        valid_rows=len(mapped),
        duplicate_rows=duplicates,
        invalid_rows=invalid,
        mapped_timetables=len({m["timetable_version_id"] for m in mapped}),
        errors=errors,
        group_distribution=group_dist,
    )
    return mapped, report
