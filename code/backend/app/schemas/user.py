from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.schemas.destination import DestinationMinimal


class UserMinimal(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    full_name: str
    profile_picture_url: str | None = None


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1)
    bio: str | None = Field(default=None, max_length=500)
    profile_picture_url: str | None = Field(default=None, max_length=500)


class UserProfile(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    full_name: str
    bio: str | None = None
    profile_picture_url: str | None = None
    post_count: int = 0
    destinations_visited: list[DestinationMinimal] = []


class UserPublic(UserMinimal):
    email: EmailStr
