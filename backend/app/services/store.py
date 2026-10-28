from datetime import datetime, timezone

from app.models import CurrentData, SensorDataIn
from app.services.risk import RISK_MODEL_CONFIG, calculate_risk


_initial_reading = SensorDataIn(
    water_level=2.35,
    rainfall=42.0,
    temperature=28.4,
    latitude=19.0760,
    longitude=72.8777,
)
_initial_assessment = calculate_risk(
    _initial_reading.water_level, _initial_reading.rainfall, rise_rate=0
)
_current_data = CurrentData(
    **_initial_reading.model_dump(),
    **_initial_assessment.__dict__,
    rise_rate=0,
    updated_at=datetime.now(timezone.utc),
)


def get_current_data() -> CurrentData:
    return _current_data


def save_sensor_data(sensor_data: SensorDataIn) -> CurrentData:
    """Keep only the newest sensor reading until persistent storage is added."""
    global _current_data
    updated_at = datetime.now(timezone.utc)
    elapsed_hours = max(
        (updated_at - _current_data.updated_at).total_seconds() / 3600,
        RISK_MODEL_CONFIG.minimum_reading_interval_hours,
    )
    rise_rate = max(0.0, (sensor_data.water_level - _current_data.water_level) / elapsed_hours)
    assessment = calculate_risk(sensor_data.water_level, sensor_data.rainfall, rise_rate)
    _current_data = CurrentData(
        **sensor_data.model_dump(),
        **assessment.__dict__,
        rise_rate=round(rise_rate, 3),
        updated_at=updated_at,
    )
    return _current_data
