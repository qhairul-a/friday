"""
OpenWeather integration.
Fetches current conditions for a given lat/lon using the free 2.5/weather endpoint.
"""

import httpx
from datetime import datetime
from zoneinfo import ZoneInfo

from core.config import settings

_ICON_MAP = {
    "01": "☀️", "02": "⛅", "03": "🌥️", "04": "☁️",
    "09": "🌧️", "10": "🌦️", "11": "⛈️", "13": "❄️", "50": "🌫️",
}
_WIND_DIRS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]


def fetch_weather(lat: float, lon: float) -> dict:
    """Return current weather for the given coordinates."""
    resp = httpx.get(
        "https://api.openweathermap.org/data/2.5/weather",
        params={"lat": lat, "lon": lon, "appid": settings.OPENWEATHER_API_KEY, "units": "metric"},
        timeout=8,
    )
    resp.raise_for_status()
    d = resp.json()

    tz = ZoneInfo(settings.TIMEZONE)
    icon_prefix = d["weather"][0]["icon"][:2]
    wind_deg = d["wind"].get("deg", 0)

    return {
        "city":        d["name"],
        "country":     d["sys"]["country"],
        "temp":        round(d["main"]["temp"]),
        "feels_like":  round(d["main"]["feels_like"]),
        "temp_min":    round(d["main"]["temp_min"]),
        "temp_max":    round(d["main"]["temp_max"]),
        "description": d["weather"][0]["description"].title(),
        "icon":        _ICON_MAP.get(icon_prefix, "🌡️"),
        "humidity":    d["main"]["humidity"],
        "wind_speed":  round(d["wind"]["speed"] * 3.6),   # m/s → km/h
        "wind_dir":    _WIND_DIRS[round(wind_deg / 45) % 8],
        "visibility":  round(d.get("visibility", 0) / 1000, 1),  # m → km
        "clouds":      d["clouds"]["all"],
        "pressure":    d["main"]["pressure"],
        "sunrise":     datetime.fromtimestamp(d["sys"]["sunrise"], tz=tz).strftime("%H:%M"),
        "sunset":      datetime.fromtimestamp(d["sys"]["sunset"],  tz=tz).strftime("%H:%M"),
    }
