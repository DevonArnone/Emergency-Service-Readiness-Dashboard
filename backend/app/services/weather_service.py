"""Cached, failure-tolerant Fairfax forecast adapter for the public NWS API."""

from __future__ import annotations

import copy
import logging
import threading
import time
from datetime import datetime, timezone
from urllib.parse import urlparse

import httpx

from app.config import settings


logger = logging.getLogger(__name__)

FAIRFAX_POINT = (38.8462, -77.3064)
LOCATION_NAME = "Fairfax County, Virginia"


class FairfaxWeatherService:
    def __init__(self) -> None:
        self._cache: dict | None = None
        self._expires_at = 0.0
        self._lock = threading.Lock()

    def clear_cache(self) -> None:
        with self._lock:
            self._cache = None
            self._expires_at = 0.0

    def get_weather(self, *, force_refresh: bool = False) -> dict:
        now = time.monotonic()
        with self._lock:
            if not force_refresh and self._cache is not None and now < self._expires_at:
                return copy.deepcopy(self._cache)
            try:
                payload = self._fetch_live()
            except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
                logger.warning("NWS weather refresh failed: %s", type(exc).__name__)
                if self._cache is not None:
                    stale = copy.deepcopy(self._cache)
                    stale.update({
                        "status": "stale",
                        "stale": True,
                        "available": True,
                        "message": "The latest National Weather Service refresh failed; showing cached data.",
                    })
                    self._cache = stale
                    self._expires_at = time.monotonic() + min(max(settings.weather_cache_seconds, 1), 60)
                    return stale
                return self._unavailable_payload()
            self._cache = payload
            self._expires_at = time.monotonic() + max(settings.weather_cache_seconds, 1)
            return copy.deepcopy(payload)

    def _fetch_live(self) -> dict:
        base_url = settings.nws_api_base_url.rstrip("/")
        latitude, longitude = FAIRFAX_POINT
        headers = {
            "Accept": "application/geo+json",
            "User-Agent": settings.weather_user_agent,
        }
        with httpx.Client(timeout=settings.nws_timeout_seconds, headers=headers, follow_redirects=True) as client:
            point = self._get_json(client, f"{base_url}/points/{latitude},{longitude}")
            forecast_url = point.get("properties", {}).get("forecast")
            if not self._is_safe_nws_url(forecast_url, base_url):
                raise ValueError("NWS point response contained an invalid forecast URL")
            forecast = self._get_json(client, forecast_url)
            alerts = self._get_json(
                client,
                f"{base_url}/alerts/active",
                params={"point": f"{latitude},{longitude}"},
            )

        forecast_properties = forecast.get("properties") or {}
        periods = [self._normalize_period(period) for period in forecast_properties.get("periods", [])[:14]]
        alert_rows = [self._normalize_alert(feature) for feature in alerts.get("features", [])[:20]]
        retrieved_at = datetime.now(timezone.utc).isoformat()
        first_period = periods[0] if periods else None
        return {
            "status": "live",
            "available": True,
            "stale": False,
            "message": None,
            "location": LOCATION_NAME,
            "forecast_periods": periods,
            "active_alerts": alert_rows,
            "wind": {
                "speed": first_period["wind_speed"] if first_period else None,
                "direction": first_period["wind_direction"] if first_period else None,
            },
            "source": {
                "name": "National Weather Service",
                "url": "https://www.weather.gov/documentation/services-web-api",
                "retrieved_at": retrieved_at,
                "source_updated_at": forecast_properties.get("updated"),
            },
        }

    @staticmethod
    def _get_json(client: httpx.Client, url: str, *, params: dict | None = None) -> dict:
        response = client.get(url, params=params)
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict):
            raise ValueError("NWS response was not an object")
        return payload

    @staticmethod
    def _is_safe_nws_url(url: object, base_url: str) -> bool:
        if not isinstance(url, str):
            return False
        candidate = urlparse(url)
        expected = urlparse(base_url)
        return (
            candidate.scheme == expected.scheme
            and candidate.hostname == expected.hostname
            and candidate.port == expected.port
            and candidate.path.startswith("/gridpoints/")
        )

    @staticmethod
    def _normalize_period(period: dict) -> dict:
        return {
            "number": period.get("number"),
            "name": period.get("name"),
            "start_time": period.get("startTime"),
            "end_time": period.get("endTime"),
            "is_daytime": period.get("isDaytime"),
            "temperature": period.get("temperature"),
            "temperature_unit": period.get("temperatureUnit"),
            "probability_of_precipitation": (
                (period.get("probabilityOfPrecipitation") or {}).get("value")
            ),
            "wind_speed": period.get("windSpeed"),
            "wind_direction": period.get("windDirection"),
            "short_forecast": period.get("shortForecast"),
            "detailed_forecast": period.get("detailedForecast"),
        }

    @staticmethod
    def _normalize_alert(feature: dict) -> dict:
        properties = feature.get("properties") or {}
        return {
            "id": feature.get("id") or properties.get("id"),
            "event": properties.get("event"),
            "severity": properties.get("severity"),
            "urgency": properties.get("urgency"),
            "certainty": properties.get("certainty"),
            "headline": properties.get("headline"),
            "description": properties.get("description"),
            "instruction": properties.get("instruction"),
            "onset": properties.get("onset"),
            "ends": properties.get("ends"),
            "sender_name": properties.get("senderName"),
        }

    @staticmethod
    def _unavailable_payload() -> dict:
        return {
            "status": "unavailable",
            "available": False,
            "stale": False,
            "message": "National Weather Service data is temporarily unavailable.",
            "location": LOCATION_NAME,
            "forecast_periods": [],
            "active_alerts": [],
            "wind": {"speed": None, "direction": None},
            "source": {
                "name": "National Weather Service",
                "url": "https://www.weather.gov/documentation/services-web-api",
                "retrieved_at": None,
                "source_updated_at": None,
            },
        }


weather_service = FairfaxWeatherService()
