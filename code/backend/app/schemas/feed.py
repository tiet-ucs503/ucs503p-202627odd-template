from pydantic import BaseModel, ConfigDict

from app.schemas.post import PostPublic


class FeedResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    items: list[PostPublic]
    total: int
