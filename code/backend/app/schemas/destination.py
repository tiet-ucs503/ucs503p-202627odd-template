from pydantic import BaseModel, ConfigDict


class DestinationMinimal(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    country: str | None = None


class DestinationPublic(DestinationMinimal):
    latitude: float | None = None
    longitude: float | None = None
