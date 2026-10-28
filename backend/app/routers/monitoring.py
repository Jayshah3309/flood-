from fastapi import APIRouter, status

from app.models import CurrentData, SensorDataIn
from app.services.store import get_current_data, save_sensor_data

router = APIRouter(tags=["monitoring"])


@router.get("/current-data", response_model=CurrentData)
def read_current_data() -> CurrentData:
    """Return the latest in-memory sensor reading."""
    return get_current_data()


@router.post("/sensor-data", response_model=CurrentData, status_code=status.HTTP_201_CREATED)
def create_sensor_data(sensor_data: SensorDataIn) -> CurrentData:
    """Store the latest ESP32-compatible sensor reading in memory."""
    return save_sensor_data(sensor_data)
