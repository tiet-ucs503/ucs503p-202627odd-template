"""Parents and teachers linking to the students they are allowed to view."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from deps import require_guardian
from services.report_builder import summary_for_list

router = APIRouter(prefix="/guardians", tags=["guardians"])


@router.post("/links", response_model=schemas.LinkedStudent, status_code=201)
def link_student(
    payload: schemas.LinkRequest,
    guardian: models.User = Depends(require_guardian),
    db: Session = Depends(get_db),
):
    """
    Links the caller to a student using the student's link code. The code is
    shown only inside the student's own account, so having it means the child
    (or their family) chose to share it.
    """
    code = payload.link_code.strip().upper()
    student = db.query(models.User).filter_by(link_code=code, role="student").first()
    # Demo and real accounts are kept apart in both directions. Answer exactly
    # as if the code did not exist, so nothing is revealed either way.
    if student is None or student.is_demo != guardian.is_demo:
        raise HTTPException(status_code=404, detail="No student found with that code.")

    existing = (
        db.query(models.GuardianLink)
        .filter_by(guardian_id=guardian.id, student_id=student.id)
        .first()
    )
    if existing is None:
        db.add(models.GuardianLink(guardian_id=guardian.id, student_id=student.id))
        db.commit()
    return summary_for_list(db, student)


@router.get("/students", response_model=List[schemas.LinkedStudent])
def my_students(guardian: models.User = Depends(require_guardian), db: Session = Depends(get_db)):
    students = (
        db.query(models.User)
        .join(models.GuardianLink, models.GuardianLink.student_id == models.User.id)
        .filter(
            models.GuardianLink.guardian_id == guardian.id,
            models.User.is_demo == guardian.is_demo,
        )
        .order_by(models.User.name)
        .all()
    )
    return [summary_for_list(db, s) for s in students]
