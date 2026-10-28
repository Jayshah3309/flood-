"""Configurable demo flood-risk scoring for the monitoring project."""

from dataclasses import dataclass


@dataclass(frozen=True)
class RiskModelConfig:
    # Thresholds are intentionally project/demo values until local calibration is available.
    water_normal: float = 2.0
    water_danger: float = 3.0
    water_critical: float = 3.5
    water_score_cap: float = 4.0
    rainfall_low: float = 10.0
    rainfall_heavy: float = 30.0
    rainfall_extreme: float = 50.0
    rainfall_score_cap: float = 70.0
    rise_low: float = 0.05
    rise_high: float = 0.15
    rise_very_high: float = 0.30
    rise_score_cap: float = 0.50
    water_weight: float = 0.50
    rainfall_weight: float = 0.30
    rise_rate_weight: float = 0.20
    minimum_reading_interval_hours: float = 1.0


RISK_MODEL_CONFIG = RiskModelConfig()


@dataclass(frozen=True)
class RiskAssessment:
    water_level_score: float
    rainfall_score: float
    rise_rate_score: float
    overall_risk_score: float
    risk: str
    prediction: str


PREDICTIONS = {
    "LOW": "Normal conditions",
    "MEDIUM": "Flood conditions developing",
    "HIGH": "High flood risk",
    "CRITICAL": "Critical flood risk",
}


def _score(value: float, low: float, medium: float, high: float, maximum: float) -> float:
    """Map configured factor bands to a continuous 0-100 score."""
    if value <= 0:
        return 0.0
    if value < low:
        score = (value / low) * 24
    elif value < medium:
        score = 25 + ((value - low) / (medium - low)) * 24
    elif value < high:
        score = 50 + ((value - medium) / (high - medium)) * 24
    else:
        score = 75 + ((value - high) / (maximum - high)) * 25
    return round(min(100, max(0, score)), 1)


def calculate_risk(
    water_level: float,
    rainfall: float,
    rise_rate: float,
    config: RiskModelConfig = RISK_MODEL_CONFIG,
) -> RiskAssessment:
    """Calculate the transparent demo score from the newest sensor values."""
    water_level_score = _score(
        water_level, config.water_normal, config.water_danger, config.water_critical, config.water_score_cap
    )
    rainfall_score = _score(
        rainfall, config.rainfall_low, config.rainfall_heavy, config.rainfall_extreme, config.rainfall_score_cap
    )
    rise_rate_score = _score(
        rise_rate, config.rise_low, config.rise_high, config.rise_very_high, config.rise_score_cap
    )
    overall_risk_score = round(
        water_level_score * config.water_weight
        + rainfall_score * config.rainfall_weight
        + rise_rate_score * config.rise_rate_weight,
        1,
    )
    if overall_risk_score < 25:
        risk = "LOW"
    elif overall_risk_score < 50:
        risk = "MEDIUM"
    elif overall_risk_score < 75:
        risk = "HIGH"
    else:
        risk = "CRITICAL"
    return RiskAssessment(
        water_level_score=water_level_score,
        rainfall_score=rainfall_score,
        rise_rate_score=rise_rate_score,
        overall_risk_score=overall_risk_score,
        risk=risk,
        prediction=PREDICTIONS[risk],
    )
