from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CurrentData(BaseModel):
    water_level: float = Field(description="Current river water level in metres")
    rainfall: float = Field(description="Rainfall intensity in millimetres per hour")
    temperature: float = Field(description="Air temperature in degrees Celsius")
    latitude: float
    longitude: float
    risk: str
    prediction: str
    rise_rate: float = Field(description="Water-level increase in metres per hour")
    water_level_score: float = Field(ge=0, le=100)
    rainfall_score: float = Field(ge=0, le=100)
    rise_rate_score: float = Field(ge=0, le=100)
    overall_risk_score: float = Field(ge=0, le=100)
    updated_at: datetime


class SensorDataIn(BaseModel):
    """Validated reading sent by an ESP32 or another sensor gateway."""

    model_config = ConfigDict(extra="forbid")

    water_level: float = Field(
        ge=0, le=20, description="Required river water level in metres (0 to 20)", examples=[2.45]
    )
    rainfall: float = Field(
        ge=0, le=500, description="Required rainfall intensity in mm/hour (0 to 500)", examples=[18.5]
    )
    temperature: float = Field(
        ge=-50, le=80, description="Required air temperature in degrees Celsius (-50 to 80)", examples=[29.2]
    )
    latitude: float = Field(
        ge=-90, le=90, description="Required GPS latitude (-90 to 90)", examples=[19.0760]
    )
    longitude: float = Field(
        ge=-180, le=180, description="Required GPS longitude (-180 to 180)", examples=[72.8777]
    )


class ChatSensorData(BaseModel):
    water_level: float = Field(ge=0)
    rainfall: float = Field(ge=0)
    temperature: float
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    risk: str = Field(min_length=1, max_length=30)
    prediction: str = Field(min_length=1, max_length=100)


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    sensor_data: ChatSensorData


class ChatResponse(BaseModel):
    answer: str
