from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status

UPLOAD_ROOT = Path(__file__).resolve().parents[2] / "uploads" / "images"
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024


def save_upload_file(file: UploadFile) -> str:
    if file.filename is None or file.filename == "":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid file")

    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid file type")

    file_bytes = file.file.read()
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="file too large")

    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)

    suffix = Path(file.filename).suffix.lower()
    saved_name = f"{uuid4().hex}{suffix}"
    final_path = UPLOAD_ROOT / saved_name
    final_path.write_bytes(file_bytes)

    return f"/uploads/images/{saved_name}"
