from datetime import datetime

from pydantic import BaseModel, ConfigDict


class FollowCreate(BaseModel):
    followed_id: int


class FollowPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    follower_id: int
    followed_id: int
    created_at: datetime
