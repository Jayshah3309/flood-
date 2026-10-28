"""Small backend-only settings loader that keeps secrets out of the frontend."""

import os
from pathlib import Path


def load_backend_env() -> None:
    """Load simple KEY=VALUE entries from backend/.env without overriding process env."""
    env_path = Path(__file__).resolve().parents[2] / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_backend_env()


def gemini_api_key() -> str | None:
    return os.getenv("GEMINI_API_KEY") or None
