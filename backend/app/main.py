from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import chat, external_data, monitoring

app = FastAPI(title="Flood Prediction & Monitoring API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(monitoring.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(external_data.router, prefix="/api")


@app.get("/", tags=["health"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}
