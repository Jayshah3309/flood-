"""Optional Gemini client. It never exposes the server-side API key."""

import json
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen

from app.models import CurrentData
from app.services.settings import gemini_api_key


GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"


def generate_flood_reply(
    question: str,
    sensor_data: CurrentData,
    weather: dict[str, Any],
    flood_data: dict[str, Any],
) -> str | None:
    """Return Gemini text when configured and available; otherwise signal local fallback."""
    api_key = gemini_api_key()
    if not api_key:
        return None

    context = {
        "sensor_readings": sensor_data.model_dump(mode="json"),
        "weather": weather,
        "flood_data": flood_data,
    }
    prompt = (
        "You are the Flood Prediction Assistant for an engineering flood-monitoring project. "
        "Answer only flood-monitoring, flood-safety, sensors, IoT, rainfall, weather, river-discharge, "
        "and project questions. Use only the sensor and external-data values supplied below; never invent "
        "readings, causes, predictions, warnings, or official guidance. Explain LOW, MEDIUM, HIGH, or "
        "CRITICAL risk through the actual water level, rainfall, rise rate, and overall score when relevant. "
        "State that readings indicate risk and cannot confirm the exact physical cause by themselves. "
        "If weather or flood data say available=false, say that source is unavailable rather than guessing. "
        "Keep the answer concise and practical.\n\n"
        f"Current project context: {json.dumps(context, ensure_ascii=False)}\n\n"
        f"User question: {question}"
    )
    body = json.dumps(
        {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": 500},
        }
    ).encode("utf-8")
    request = Request(
        GEMINI_URL,
        data=body,
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
        method="POST",
    )
    try:
        with urlopen(request, timeout=12) as response:
            payload = json.loads(response.read().decode("utf-8"))
        parts = payload.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        text = "".join(part.get("text", "") for part in parts).strip()
        return text or None
    except (OSError, URLError, ValueError, KeyError, IndexError):
        return None
