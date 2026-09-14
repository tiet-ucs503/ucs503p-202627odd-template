from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.destination import DestinationMinimal
from app.schemas.user import UserMinimal


class PostCreate(BaseModel):
    content: str = Field(..., min_length=1)
    destination_name: str = Field(..., min_length=1)
    image_url: str | None = None


class PostPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user: UserMinimal
    content: str
    image_url: str | None = None
    destination: DestinationMinimal
    created_at: datetime
