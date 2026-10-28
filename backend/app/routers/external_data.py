from typing import Any

from fastapi import APIRouter

from app.services.external_data import get_flood_data, get_weather
from app.services.store import get_current_data

router = APIRouter(tags=["external data"])


@router.get("/weather")
def read_weather() -> dict[str, Any]:
    """Return Open-Meteo weather for the latest sensor GPS position."""
    data = get_current_data()
    return get_weather(data.latitude, data.longitude)


@router.get("/flood-data")
def read_flood_data() -> dict[str, Any]:
    """Return Open-Meteo modelled river discharge for the latest sensor GPS position."""
    data = get_current_data()
    return get_flood_data(data.latitude, data.longitude)
