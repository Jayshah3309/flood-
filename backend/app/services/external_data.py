"""Resilient, key-free Open-Meteo integrations for the backend."""

import json
from typing import Any
from urllib.parse import urlencode
from urllib.request import urlopen


WEATHER_URL = "https://api.open-meteo.com/v1/forecast"
FLOOD_URL = "https://flood-api.open-meteo.com/v1/flood"


def _get_json(url: str, params: dict[str, Any]) -> dict[str, Any]:
    query = urlencode(params, safe=",")
    with urlopen(f"{url}?{query}", timeout=6) as response:
        return json.loads(response.read().decode("utf-8"))


def _unavailable(source: str) -> dict[str, Any]:
    return {
        "available": False,
        "source": source,
        "message": f"{source} is temporarily unavailable. Local sensor monitoring remains active.",
    }


def get_weather(latitude: float, longitude: float) -> dict[str, Any]:
    """Fetch current weather and a short rainfall outlook without raising API failures."""
    try:
        payload = _get_json(
            WEATHER_URL,
            {
                "latitude": latitude,
                "longitude": longitude,
                "current": "temperature_2m,precipitation,rain,weather_code",
                "hourly": "precipitation_probability,precipitation,rain",
                "forecast_days": 1,
                "timezone": "auto",
            },
        )
        return {
            "available": True,
            "source": "Open-Meteo Weather",
            "latitude": payload.get("latitude"),
            "longitude": payload.get("longitude"),
            "current": payload.get("current", {}),
            "current_units": payload.get("current_units", {}),
            "hourly": payload.get("hourly", {}),
            "hourly_units": payload.get("hourly_units", {}),
        }
    except Exception:
        return _unavailable("Open-Meteo Weather")


def get_flood_data(latitude: float, longitude: float) -> dict[str, Any]:
    """Fetch nearby modelled river discharge without breaking local monitoring."""
    try:
        payload = _get_json(
            FLOOD_URL,
            {
                "latitude": latitude,
                "longitude": longitude,
                "daily": "river_discharge,river_discharge_mean,river_discharge_max",
                "forecast_days": 7,
                "timezone": "auto",
            },
        )
        return {
            "available": True,
            "source": "Open-Meteo Flood (modelled river discharge)",
            "latitude": payload.get("latitude"),
            "longitude": payload.get("longitude"),
            "daily": payload.get("daily", {}),
            "daily_units": payload.get("daily_units", {}),
        }
    except Exception:
        return _unavailable("Open-Meteo Flood")
