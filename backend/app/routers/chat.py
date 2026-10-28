from fastapi import APIRouter

from app.models import ChatRequest, ChatResponse
from app.services.chat import (
    create_dummy_reply,
    is_flood_related,
    needs_flood_data,
    needs_weather_data,
)
from app.services.external_data import get_flood_data, get_weather
from app.services.gemini import generate_flood_reply
from app.services.settings import gemini_api_key
from app.services.store import get_current_data

router = APIRouter(tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    """Use Gemini when configured, with the local flood assistant as a safe fallback."""
    data = get_current_data()
    flood_related = is_flood_related(request.question)
    weather = get_weather(data.latitude, data.longitude) if needs_weather_data(request.question) else None
    flood_data = get_flood_data(data.latitude, data.longitude) if needs_flood_data(request.question) else None
    local_answer = create_dummy_reply(request.question, data, weather, flood_data)
    if not flood_related or not gemini_api_key():
        return ChatResponse(answer=local_answer)

    weather = weather or get_weather(data.latitude, data.longitude)
    flood_data = flood_data or get_flood_data(data.latitude, data.longitude)
    gemini_answer = generate_flood_reply(request.question, data, weather, flood_data)
    return ChatResponse(answer=gemini_answer or local_answer)
