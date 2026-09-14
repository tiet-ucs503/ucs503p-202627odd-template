from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.orm import Session

from app.dependencies.db import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.utils.file_upload import save_upload_file

router = APIRouter(prefix="/api/uploads", tags=["uploads"])


@router.post("/images", status_code=status.HTTP_201_CREATED)
def upload_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    del db
    del current_user
    url = save_upload_file(file)
    return {"url": url}
