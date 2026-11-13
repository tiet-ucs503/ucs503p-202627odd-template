"""Student report for the student themself or a linked parent/teacher."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from deps import student_for_viewer
from services.report_builder import build_report

router = APIRouter(tags=["reports"])


@router.get("/students/{student_id}/report", response_model=schemas.StudentReport)
def student_report(
    student: models.User = Depends(student_for_viewer),
    # The viewer's clock offset from UTC, so daily trends follow their calendar day.
    tz_offset_minutes: int = Query(default=0, ge=-840, le=840),
    db: Session = Depends(get_db),
):
    return build_report(db, student, tz_offset_minutes)
