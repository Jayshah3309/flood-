import re

from app.models import CurrentData
from app.services.risk import calculate_risk


OUT_OF_SCOPE_RESPONSE = (
    "Im the Flood Prediction Assistant. I can help with flood prediction, flood monitoring, "
    "water levels, rainfall, flood risk, sensors, IoT, prediction models, flood warnings, and flood safety."
)

FLOOD_TOPIC_TERMS = (
    "flood", "flooding", "water level", "rain", "rainfall", "precipitation",
    "river", "drainage", "weather", "sensor", "ultrasonic", "esp32", "gps",
    "lora", "iot", "warning", "alert", "evacuat", "dam", "reservoir", "coastal",
    "dangerous", "project", "backend", "gemini", "open-meteo", "machine learning",
)


def is_flood_related(message: str) -> bool:
    """Keep external AI requests within the assistant's flood-monitoring scope."""
    question = message.lower()
    return any(term in question for term in FLOOD_TOPIC_TERMS) or bool(
        re.search(r"\b(?:low|medium|high|critical)\s+risk\b", question)
    ) or _is_risk_explanation_intent(question)


def needs_weather_data(message: str) -> bool:
    question = message.lower()
    return any(term in question for term in ("current weather", "weather forecast", "weather condition", "external weather"))


def needs_flood_data(message: str) -> bool:
    question = message.lower()
    return any(term in question for term in ("river/flood", "river condition", "river discharge", "flood data", "river data"))


def _choose(question: str, options: list[str]) -> str:
    """Choose a stable wording variation without introducing external AI."""
    return options[sum(ord(character) for character in question) % len(options)]


def _water_level_assessment(level: float, asks_about_flood: bool) -> str:
    """Assess a water level stated by the user with the project's demo thresholds."""
    if level < 2.0:
        risk = "LOW"
        prediction = "Flood risk is currently low. Continue routine monitoring."
        direct_answer = "No flood condition is indicated by this water-level threshold."
    elif level < 3.0:
        risk = "MEDIUM"
        prediction = "Flood conditions may be developing. Monitor water levels and local alerts."
        direct_answer = "Flood conditions may be developing at this water-level threshold."
    elif level < 3.5:
        risk = "HIGH"
        prediction = "High flood risk detected. Continuous monitoring is recommended."
        direct_answer = "A high flood risk is present based on this water-level threshold."
    else:
        risk = "CRITICAL"
        prediction = "Critical flood risk detected. Follow official emergency guidance."
        direct_answer = "Critical flood conditions are indicated by this water-level threshold."

    response = f"Water level: {level:g} m\nFlood Risk: {risk}\nPrediction: {prediction}"
    return f"{response}\n{direct_answer}" if asks_about_flood else response


def _rainfall_assessment(rainfall: float) -> tuple[str, str, str]:
    """Classify stated rainfall with the same bands used by the project model."""
    if rainfall < 10:
        return "LOW", "LOW", "Rainfall intensity is currently low and is unlikely to create significant flood risk by itself."
    if rainfall < 30:
        return "MODERATE", "MODERATE", "Moderate rainfall may increase flood risk, especially if water levels are already elevated."
    if rainfall < 50:
        return "HEAVY", "HIGH", "Heavy rainfall can significantly increase flood risk. Continuous monitoring is recommended."
    return "EXTREME", "CRITICAL", "Extreme rainfall can create severe flood conditions. Follow official emergency guidance."


def _stated_rainfall(question: str) -> float | None:
    unit = r"(?:mm\s*/\s*(?:hr|hour)|mm\s+per\s+hour)"
    match = re.search(
        rf"\b(?:rainfall|raining)(?:\s+(?:is|at))?\s*(\d+(?:\.\d+)?)\s*{unit}\b",
        question,
    ) or re.search(rf"\b(\d+(?:\.\d+)?)\s*{unit}\s+rainfall\b", question)
    return float(match.group(1)) if match else None


def _risk_reasoning(water_level: float, rainfall: float, rise_rate: float, risk: str) -> str:
    """Explain the project risk assessment without claiming a confirmed physical cause."""
    intensity, _, _ = _rainfall_assessment(rainfall)
    if water_level >= 3.5:
        water_condition = "at or above the project's critical water-level threshold"
    elif water_level >= 3.0:
        water_condition = "already in the project's danger water-level range"
    elif water_level >= 2.0:
        water_condition = "above the project's normal water-level range"
    else:
        water_condition = "currently below the project's warning water-level range"

    rise_condition = (
        f"The calculated water-level rise rate is {rise_rate:.2f} m/hr, so water is entering "
        "the system faster than it is leaving."
        if rise_rate >= 0.05
        else "The current derived water-level rise rate is not elevated, but future rainfall and inflow can still change conditions."
    )
    return (
        f"Flood Risk: {risk}.\n\n"
        f"Water level is {water_level:.2f} m and is {water_condition}. Rainfall is "
        f"{rainfall:.1f} mm/hr, classified as {intensity} rainfall.\n\n"
        "Why this affects flood risk:\n"
        f"1. A high water level leaves less river or drainage capacity before overflow becomes possible.\n"
        f"2. {intensity.title()} rainfall adds water to rivers, drains, and low-lying areas.\n"
        "3. If incoming water exceeds drainage or channel capacity, water can accumulate or overflow.\n"
        f"4. {rise_condition}\n\n"
        "These sensor readings indicate risk, but they do not by themselves confirm the exact physical cause. "
        "Soil saturation, blocked drainage, upstream inflow, river capacity, urban surfaces, dam releases, "
        "and coastal conditions can also contribute."
    )


def _explains_cause(question: str) -> bool:
    return any(term in question for term in (
        "why", "what causes", "what is causing", "explain the reason",
        "reason for", "cause of flood", "causing the flood",
    ))


def _requested_risk_level(question: str) -> str | None:
    """Find a risk level mentioned in a natural-language why question."""
    match = re.search(r"\b(low|medium|high|critical)\s+risk\b", question)
    if match:
        return match.group(1).upper()
    match = re.search(r"\brisk\s+(?:is\s+|being\s+|became\s+|become\s+)?(low|medium|high|critical)\b", question)
    return match.group(1).upper() if match else None


def _is_risk_explanation_intent(question: str) -> bool:
    """Recognize direct and abbreviated questions about the project flood risk."""
    if "explain the risk" in question or "flood risk increasing" in question:
        return True
    return bool(
        re.search(
            r"\bwhy\s+(?:is\s+)?(?:it|this)\s+(?:is\s+|being\s+)?"
            r"(?:low|medium|high|critical)(?:\s+risk)?\b",
            question,
        )
    )


def _current_risk_reasoning(data: CurrentData, requested_level: str | None = None) -> str:
    """Explain the stored risk and its transparent project-model contributions."""
    summary = {
        "LOW": "The monitored conditions are currently within the normal or low-risk range.",
        "MEDIUM": "The risk is medium because one or more monitored conditions are elevated, but the overall score has not reached the high-risk range.",
        "HIGH": "The risk is high because one or more monitored conditions are reaching elevated levels.",
        "CRITICAL": "The risk is critical because monitored conditions have reached the project's highest risk range.",
    }[data.risk]
    requested_note = (
        f"The current dashboard classification is {data.risk}, not {requested_level}.\n\n"
        if requested_level and requested_level != data.risk
        else ""
    )
    return (
        f"{requested_note}Flood Risk: {data.risk}\n\n"
        f"Based on the current readings, {summary.lower()}\n\n"
        "The main contributing factors are:\n"
        f"1. Current water level: {data.water_level:.2f} m (factor score {data.water_level_score:.1f}/100).\n"
        f"2. Current rainfall: {data.rainfall:.1f} mm/hr (factor score {data.rainfall_score:.1f}/100).\n"
        f"3. Current water-level rise rate: {data.rise_rate:.2f} m/hr (factor score {data.rise_rate_score:.1f}/100).\n"
        f"4. Weighted overall risk score: {data.overall_risk_score:.1f}/100.\n"
        f"Prediction: {data.prediction}.\n\n"
        "These readings indicate contributing conditions based on the project's thresholds; they do not prove that flooding is definitely happening or confirm the exact physical cause."
    )


def _current_conditions(data: CurrentData) -> str:
    recommendation = {
        "LOW": "Continue routine monitoring.",
        "MEDIUM": "Monitor readings and local official alerts.",
        "HIGH": "Continuous monitoring and preparedness are recommended.",
        "CRITICAL": "Follow official local emergency guidance and avoid flood-prone areas.",
    }[data.risk]
    return (
        f"Current Flood Risk: {data.risk}\n\n"
        "LIVE PROJECT DATA (ESP32/backend):\n"
        f"- Water level: {data.water_level:.2f} m\n"
        f"- Rainfall: {data.rainfall:.1f} mm/hr\n"
        f"- Temperature: {data.temperature:.1f} C\n"
        f"- Water-level rise rate: {data.rise_rate:.2f} m/hr\n"
        f"- Risk score: {data.overall_risk_score:.1f}/100\n"
        f"- Prediction: {data.prediction}\n\n"
        f"Recommendation: {recommendation}"
    )


def _weather_reply(data: CurrentData, weather: dict | None) -> str:
    if not weather or not weather.get("available"):
        return (
            "External weather API data is currently unavailable. The live ESP32 rainfall reading is "
            f"{data.rainfall:.1f} mm/hr and the temperature reading is {data.temperature:.1f} C."
        )
    current = weather.get("current", {})
    units = weather.get("current_units", {})
    return (
        "EXTERNAL DATA (Open-Meteo Weather):\n"
        f"- Temperature: {current.get('temperature_2m', 'That reading is currently unavailable.')} {units.get('temperature_2m', '')}\n"
        f"- Rain: {current.get('rain', 'That reading is currently unavailable.')} {units.get('rain', '')}\n"
        f"- Precipitation: {current.get('precipitation', 'That reading is currently unavailable.')} {units.get('precipitation', '')}\n\n"
        f"LIVE PROJECT DATA: ESP32 rainfall is {data.rainfall:.1f} mm/hr. External weather data does not replace the project risk classification."
    )


def _flood_data_reply(flood_data: dict | None) -> str:
    if not flood_data or not flood_data.get("available"):
        return "External Open-Meteo flood/river data is currently unavailable. The project risk engine remains based on the latest local sensor readings."
    daily = flood_data.get("daily", {})
    discharge = daily.get("river_discharge", [])
    date = daily.get("time", [])
    if not discharge:
        return "External Open-Meteo flood data responded, but river-discharge readings are currently unavailable for this location."
    return (
        "EXTERNAL DATA (Open-Meteo Flood):\n"
        f"- Modelled river discharge: {discharge[0]} m³/s on {date[0] if date else 'the latest available date'}.\n"
        "This is external modelled river data and does not replace the project's calculated flood risk."
    )


def _project_thresholds() -> str:
    return (
        "Project water-level thresholds are: LOW below 2.0 m, MEDIUM from 2.0 to below 3.0 m, "
        "HIGH from 3.0 to below 3.5 m, and CRITICAL at 3.5 m or higher. Rainfall is LOW below "
        "10 mm/hr, MODERATE below 30 mm/hr, HEAVY below 50 mm/hr, and EXTREME at 50 mm/hr or higher."
    )


def create_dummy_reply(
    message: str,
    data: CurrentData,
    weather: dict | None = None,
    flood_data: dict | None = None,
) -> str:
    """Return a local, flood-focused answer using the latest stored reading."""
    question = message.lower().strip()
    stated_water_level_match = re.search(
        r"\bwater\s+level\s*(?:is\s*)?[:=]?\s*(\d+(?:\.\d+)?)\s*(?:m|meters?|metres?)\b",
        question,
    )
    stated_water_level = float(stated_water_level_match.group(1)) if stated_water_level_match else None
    stated_rainfall = _stated_rainfall(question)

    if needs_weather_data(question):
        return _weather_reply(data, weather)
    if needs_flood_data(question):
        return _flood_data_reply(flood_data)
    if any(term in question for term in ("sensor status", "sensors online", "sensor health")):
        return (
            "The backend has a latest sensor reading available. Individual device health details are currently "
            "shown as dashboard status indicators; the API does not provide separate live health telemetry yet."
        )
    if any(term in question for term in ("current flood risk", "is there a flood risk", "will flooding happen", "current conditions", "current status")):
        return _current_conditions(data)
    if any(term in question for term in ("is that dangerous", "is this dangerous")):
        return (
            f"Based on the current readings, the water level is {data.water_level:.2f} m and the overall "
            f"project flood risk is {data.risk}. {_current_risk_reasoning(data)}"
        )
    if ("risk increasing" in question and "why" in question) or ("factors" in question and "risk" in question):
        return _current_risk_reasoning(data)
    if any(term in question for term in ("predict the next", "next few hours", "situation getting", "getting better", "getting worse", "risk increasing")):
        trend = (
            "The derived rise rate is elevated, which suggests conditions could worsen if the trend continues."
            if data.rise_rate >= 0.05
            else "The current derived rise rate is not elevated, but continued rainfall or rising water could increase risk."
        )
        return f"{_current_conditions(data)}\n\nOutlook: {trend} The dashboard outlook is a project demo, not a calibrated forecast."
    if any(term in question for term in ("what if water level", "water level reaches", "water level reach")):
        match = re.search(r"(\d+(?:\.\d+)?)\s*(?:m|meters?|metres?)", question)
        if match:
            level = float(match.group(1))
            return f"Hypothetical water level: {level:g} m\n{_water_level_assessment(level, True)}\n{_project_thresholds()}"
    if "what if rainfall" in question or "rainfall reaches" in question:
        match = _stated_rainfall(question) or (
            float(found.group(1)) if (found := re.search(r"(\d+(?:\.\d+)?)\s*mm", question)) else None
        )
        if match is not None:
            intensity, contribution, explanation = _rainfall_assessment(match)
            return (
                f"Hypothetical rainfall: {match:g} mm/hr\nIntensity: {intensity}\n"
                f"Flood-risk contribution: {contribution}\n{explanation}\n{_project_thresholds()}"
            )
    if any(term in question for term in ("rises quickly", "rises rapidly", "water level rises quickly")):
        return (
            "If the water level rises quickly, the rise-rate factor in the existing risk engine increases. "
            "A rapid rise can indicate water entering the system faster than it is leaving, so continued monitoring is recommended."
        )
    if any(term in question for term in ("risk becomes critical", "during a flood", "safe to cross", "cross flood water", "when should people evacuate")):
        return (
            "Avoid walking or driving through floodwater, move to safer higher ground if instructed, and follow official local "
            "emergency alerts and evacuation instructions. This assistant is not an emergency authority."
        )
    if any(term in question for term in ("water-level threshold", "water level threshold", "danger level", "critical level")):
        return _project_thresholds()
    if (
        "dangerous" in question
        and "rain" not in question
        and (match := re.search(r"(\d+(?:\.\d+)?)\s*(?:m|meters?|metres?)", question))
    ):
        level = float(match.group(1))
        return f"Hypothetical assessment for {level:g} m:\n{_water_level_assessment(level, True)}\n{_project_thresholds()}"
    if any(term in question for term in ("water level increases", "water level increase", "water rising speed", "water-level trend")):
        return (
            f"The current water level is {data.water_level:.2f} m. If it increases, its water-level score rises under "
            f"the existing thresholds and can increase the overall risk. {_project_thresholds()}"
        )
    if any(term in question for term in ("rainfall increases", "rainfall increase", "rain increases", "rain increase")):
        return (
            f"The current rainfall is {data.rainfall:.1f} mm/hr. More rainfall can increase runoff and the rainfall "
            f"score in the existing risk calculation, particularly when water levels are already elevated."
        )
    if any(term in question for term in ("architecture", "what is the backend", "role of ai", "role of gemini", "role of open-meteo", "limitations", "future scope", "whole system", "system work")):
        return (
            "This project uses ESP32-compatible sensor input to send water level, rainfall, temperature, and GPS data to "
            "a FastAPI backend. The backend calculates the authoritative project risk, then the dashboard presents it. "
            "Gemini can provide natural-language explanations when configured, while Open-Meteo supplies clearly labelled "
            "external weather and modelled river data. Current limitations include demo thresholds, in-memory storage, and "
            "the need for local calibration; future work can add validated historical data, real sensors, and calibrated models."
        )
    if any(term in question for term in ("what sensor measures water", "water level sensor", "rainfall sensor", "temperature sensor")):
        return (
            "An ultrasonic sensor can measure water level by timing an echo from the water surface. A rainfall sensor "
            "measures precipitation, and a temperature sensor measures air temperature. The current project API accepts "
            "these readings, while physical sensor integration remains a separate hardware step."
        )

    if stated_water_level is not None and stated_rainfall is not None:
        assessment = calculate_risk(stated_water_level, stated_rainfall, data.rise_rate)
        if _explains_cause(question):
            return _risk_reasoning(stated_water_level, stated_rainfall, data.rise_rate, assessment.risk)
        prediction = {
            "LOW": "Flood risk is currently low.",
            "MEDIUM": "Flood conditions may be developing.",
            "HIGH": "High flood risk detected. Continuous monitoring is recommended.",
            "CRITICAL": "Critical flood risk detected. Follow official emergency guidance.",
        }[assessment.risk]
        return (
            f"Water Level: {stated_water_level:g} m\n"
            f"Rainfall: {stated_rainfall:g} mm/hr\n"
            f"Flood Risk: {assessment.risk}\n"
            f"Prediction: {prediction}"
        )
    if stated_water_level is not None:
        level = stated_water_level
        asks_about_flood = "flood" in question or "is there" in question
        return _water_level_assessment(level, asks_about_flood)
    if stated_rainfall is not None:
        intensity, contribution, explanation = _rainfall_assessment(stated_rainfall)
        return (
            f"Rainfall: {stated_rainfall:g} mm/hr\n"
            f"Rainfall Intensity: {intensity}\n"
            f"Flood Risk Contribution: {contribution}\n"
            f"Prediction: {explanation}"
        )
    if _explains_cause(question) or _is_risk_explanation_intent(question):
        if any(term in question for term in ("water level increasing", "water level rising", "water level rise")):
            return (
                "A rising water level can occur when more water is entering a river or drainage system than is leaving it. "
                "Heavy rainfall, upstream runoff, tributary inflow, blocked drainage, or changes in discharge can contribute. "
                f"The latest derived rise rate is {data.rise_rate:.2f} m/hr; this reading alone cannot confirm the exact cause."
            )
        if any(term in question for term in ("heavy rain", "heavy rainfall", "rainfall cause", "rainfall increase")):
            return (
                "Heavy rainfall can produce more surface runoff and river inflow than drainage channels or rivers can carry. "
                "When incoming water exceeds the system's capacity, water can accumulate or overflow, causing flooding. "
                "Saturated soil, paved surfaces, and blocked drains can make this worse."
            )
        requested_level = _requested_risk_level(question)
        if requested_level or _is_risk_explanation_intent(question) or "risk" in question or "warning" in question:
            return _current_risk_reasoning(data, requested_level)
        if any(term in question for term in ("flooding", "flood", "dangerous", "causing")):
            return _risk_reasoning(data.water_level, data.rainfall, data.rise_rate, data.risk)
    rainfall_terms = (
        "rain", "rainfall", "rain rate", "rainfall rate", "rain intensity",
        "rainfall intensity", "speed of rain", "amount of rain",
        "amount of rainfall", "how much rain", "heavy rain", "moderate rain",
        "extreme rain", "precipitation",
    )
    if any(term in question for term in rainfall_terms):
        if "speed of rain" in question or "speed of the rain" in question:
            return (
                "Rain is not normally measured by speed. For flood monitoring, rainfall is "
                "measured as rainfall intensity or rainfall rate in mm/hr. Higher rainfall "
                "intensity can increase flood risk, especially when water levels are already high."
            )
        if any(term in question for term in ("how heavy", "is the rain heavy", "is rain heavy")):
            intensity, contribution, explanation = _rainfall_assessment(data.rainfall)
            return (
                f"The latest rainfall reading is {data.rainfall:.1f} mm/hr, which is {intensity} "
                f"intensity with a {contribution} flood-risk contribution. {explanation}"
            )
        if "heavy rain" in question and "flood" in question:
            return (
                "Heavy rain can cause flooding when drainage capacity is exceeded or water levels "
                "are already elevated. Monitor official alerts and the live rainfall and water-level readings."
            )
        return (
            "Rainfall rate, also called rainfall intensity, is measured in mm/hr for flood monitoring. "
            f"The latest dashboard rainfall reading is {data.rainfall:.1f} mm/hr."
        )

    if any(term in question for term in ("latest reading", "latest sensor data", "current dashboard", "dashboard reading", "current conditions")):
        return f"The latest dashboard reading is {data.water_level:.2f} m water level, {data.rainfall:.0f} mm/hr rainfall, {data.temperature:.1f} °C, {data.risk} risk, and {data.prediction}."
    if any(term in question for term in ("current water level", "latest water level", "water level now", "river level", "gauge reading")):
        return _choose(question, [
            f"The latest water-level reading is {data.water_level:.2f} m.",
            f"River Gauge 01 currently reports {data.water_level:.2f} m.",
        ])
    if any(term in question for term in ("current rainfall", "latest rainfall", "rainfall now", "rain intensity", "rainfall intensity", "precipitation")):
        return _choose(question, [
            f"The latest rainfall intensity is {data.rainfall:.0f} mm/hr.",
            f"Current sensor data shows {data.rainfall:.0f} mm/hr of rainfall.",
        ])
    if any(term in question for term in ("current temperature", "latest temperature", "temperature now")):
        return f"The latest recorded temperature is {data.temperature:.1f} °C."
    if "risk levels" not in question and any(term in question for term in ("current risk", "flood risk", "risk level", "current alert")):
        return f"The current flood risk is {data.risk}. The active prediction is {data.prediction}."
    if any(term in question for term in ("current prediction", "latest prediction", "prediction now")):
        return f"The current prediction is {data.prediction}, based on the latest sensor readings."
    if any(term in question for term in ("current gps", "current location", "latest location", "gps location", "latitude", "longitude", "where is the sensor")):
        return f"The latest sensor location is latitude {data.latitude:.4f}, longitude {data.longitude:.4f}."

    if any(term in question for term in ("flood causes", "cause of flood", "why do floods happen", "what causes flooding", "what causes floods", "causes floods")):
        return _choose(question, [
            "Flooding can result from intense rainfall, overflowing rivers, poor drainage, blocked waterways, storm surge, or rapid runoff from paved areas.",
            "Common flood causes include prolonged or heavy rain, saturated ground, river overflow, drainage failure, and coastal storm surge.",
        ])
    if any(term in question for term in ("flood prediction", "predict flood", "forecast flood")):
        return _choose(question, [
            "Flood prediction combines recent water level, rainfall intensity, weather conditions, and historical patterns to estimate whether flooding may occur.",
            "A flood forecast compares live sensor readings with thresholds and historical behaviour, then estimates the likely flood risk for the monitored area.",
        ])
    if any(term in question for term in ("risk levels", "low medium high critical", "what does high risk", "what is critical risk")):
        return "Flood risk levels communicate urgency: LOW means normal conditions, MEDIUM means monitor conditions, HIGH means prepare and follow alerts, and CRITICAL means immediate protective action may be needed."
    if any(term in question for term in ("warning", "warnings", "alert", "alerts", "notification")):
        return "Flood warnings and alerts notify people when conditions cross monitoring thresholds. Follow official local-authority instructions, especially when the alert level rises."
    if any(term in question for term in ("flood safety", "flood safe", "during a flood", "emergency", "evacuat", "protect myself")):
        return _choose(question, [
            "Move to higher ground, avoid walking or driving through floodwater, follow official alerts, and keep emergency contacts and supplies ready.",
            "During a flood, stay away from flowing or standing floodwater, use safe evacuation routes, and follow instructions from local authorities.",
        ])
    if any(term in question for term in ("ultrasonic", "ultrasound sensor")):
        return "An ultrasonic water-level sensor sends a sound pulse toward the water surface and measures the echo time. The distance is converted into a water-level reading."
    if "esp32" in question:
        return "An ESP32 is a small microcontroller with Wi-Fi and Bluetooth. In this project it can collect sensor readings, apply simple checks, and send data to the monitoring backend."
    if any(term in question for term in ("gps", "global positioning")):
        return "GPS provides the sensor station's latitude and longitude, helping operators associate readings and alerts with the correct monitored location."
    if "lora" in question:
        return "LoRa is a low-power, long-range wireless communication technology. It is useful for remote flood sensors that need to send small readings while conserving battery power."
    if any(term in question for term in ("iot", "internet of things", "connected sensor")):
        return "IoT-based flood monitoring connects water, rainfall, and weather sensors to a central dashboard so readings can be reviewed and acted on in near real time."
    if any(term in question for term in ("machine learning", "ml model", "prediction model")):
        return "Machine learning can learn relationships between historical weather, rainfall, water levels, and flood events. It can support risk estimates, but its accuracy depends on reliable data and careful validation."
    if any(term in question for term in ("historical data", "historical flood data", "past flood", "flood history")):
        return "Historical flood data helps identify seasonal patterns, previous high-water events, rainfall thresholds, and locations that may need more attention during future storms."
    if any(term in question for term in ("real time", "realtime", "live monitoring", "monitoring work")):
        return "Real-time monitoring collects readings at regular intervals, sends them to the backend, updates the dashboard, and can trigger warnings when conditions approach configured thresholds."
    if any(term in question for term in ("this project", "project work", "how does this system work", "complete working", "flood monitoring project")):
        return f"This project collects sensor readings, stores the latest record in the FastAPI backend, refreshes the dashboard, shows water-level history, and provides flood-only chat guidance. The latest reading is {data.water_level:.2f} m with {data.risk} risk."
    if any(term in question for term in ("water level", "rainfall", "temperature", "flood", "flooding", "sensor", "monitoring")):
        return f"The latest dashboard reading is {data.water_level:.2f} m water level, {data.rainfall:.0f} mm/hr rainfall, {data.temperature:.1f} °C, and {data.risk} risk with a {data.prediction} prediction."

    return OUT_OF_SCOPE_RESPONSE
