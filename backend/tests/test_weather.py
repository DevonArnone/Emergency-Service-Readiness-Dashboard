"""Deterministic NWS adapter coverage; no test performs network I/O."""

from __future__ import annotations

import unittest
from unittest.mock import patch

import httpx

from app.api.operations import fairfax_weather
from app.models import FairfaxWeatherResponse
from app.services.weather_service import FairfaxWeatherService


POINT_URL = "https://api.weather.gov/points/38.8462,-77.3064"
FORECAST_URL = "https://api.weather.gov/gridpoints/LWX/96,70/forecast"
ALERTS_URL = "https://api.weather.gov/alerts/active"


class FakeResponse:
    def __init__(self, payload: dict, status_code: int = 200) -> None:
        self.payload = payload
        self.status_code = status_code
        self.request = httpx.Request("GET", "https://api.weather.gov/test")

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise httpx.HTTPStatusError(
                "NWS test response failed",
                request=self.request,
                response=httpx.Response(self.status_code, request=self.request),
            )

    def json(self) -> dict:
        return self.payload


class FakeClient:
    def __init__(self, responses: dict[str, dict]) -> None:
        self.responses = responses
        self.calls: list[tuple[str, dict | None]] = []

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback) -> None:
        return None

    def get(self, url: str, params: dict | None = None) -> FakeResponse:
        self.calls.append((url, params))
        return FakeResponse(self.responses[url])


def live_responses() -> dict[str, dict]:
    return {
        POINT_URL: {"properties": {"forecast": FORECAST_URL}},
        FORECAST_URL: {
            "properties": {
                "updated": "2026-09-20T12:00:00+00:00",
                "periods": [{
                    "number": 1,
                    "name": "Today",
                    "startTime": "2026-09-20T08:00:00-04:00",
                    "endTime": "2026-09-20T18:00:00-04:00",
                    "isDaytime": True,
                    "temperature": 74,
                    "temperatureUnit": "F",
                    "probabilityOfPrecipitation": {"value": 20},
                    "windSpeed": "8 mph",
                    "windDirection": "NW",
                    "shortForecast": "Partly Sunny",
                    "detailedForecast": "Partly sunny with northwest winds.",
                }],
            },
        },
        ALERTS_URL: {
            "features": [{
                "id": "urn:oid:qa-alert",
                "properties": {
                    "event": "Wind Advisory",
                    "severity": "Moderate",
                    "urgency": "Expected",
                    "certainty": "Likely",
                    "headline": "Wind Advisory issued for Fairfax County",
                    "description": "Synthetic fixture only.",
                    "instruction": "Secure loose objects.",
                    "onset": "2026-09-20T20:00:00-04:00",
                    "ends": "2026-09-21T04:00:00-04:00",
                    "senderName": "NWS Baltimore/Washington",
                },
            }],
        },
    }


class FairfaxWeatherServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.service = FairfaxWeatherService()

    def test_live_response_is_normalized_and_cached(self) -> None:
        client = FakeClient(live_responses())
        with patch("app.services.weather_service.httpx.Client", return_value=client):
            first = self.service.get_weather()
            second = self.service.get_weather()

        self.assertEqual(first["status"], "live")
        FairfaxWeatherResponse.model_validate(first)
        self.assertFalse(first["stale"])
        self.assertEqual(first["forecast_periods"][0]["short_forecast"], "Partly Sunny")
        self.assertEqual(first["wind"], {"speed": "8 mph", "direction": "NW"})
        self.assertEqual(first["active_alerts"][0]["event"], "Wind Advisory")
        self.assertEqual(first["source"]["source_updated_at"], "2026-09-20T12:00:00+00:00")
        self.assertEqual(first, second)
        self.assertEqual(len(client.calls), 3)
        self.assertEqual(client.calls[-1], (ALERTS_URL, {"point": "38.8462,-77.3064"}))

    def test_refresh_failure_returns_explicit_stale_cache(self) -> None:
        client = FakeClient(live_responses())
        with patch("app.services.weather_service.httpx.Client", return_value=client):
            self.service.get_weather()
        self.service._expires_at = 0

        with patch(
            "app.services.weather_service.httpx.Client",
            side_effect=httpx.ConnectTimeout("fixture timeout"),
        ):
            stale = self.service.get_weather()

        self.assertEqual(stale["status"], "stale")
        FairfaxWeatherResponse.model_validate(stale)
        self.assertTrue(stale["stale"])
        self.assertTrue(stale["available"])
        self.assertEqual(stale["forecast_periods"][0]["temperature"], 74)

    def test_failure_without_cache_returns_unavailable_contract(self) -> None:
        with patch(
            "app.services.weather_service.httpx.Client",
            side_effect=httpx.ConnectTimeout("fixture timeout"),
        ):
            unavailable = self.service.get_weather()

        self.assertEqual(unavailable["status"], "unavailable")
        FairfaxWeatherResponse.model_validate(unavailable)
        self.assertFalse(unavailable["available"])
        self.assertFalse(unavailable["stale"])
        self.assertEqual(unavailable["forecast_periods"], [])
        self.assertEqual(unavailable["active_alerts"], [])

    def test_forecast_url_cannot_escape_configured_nws_origin(self) -> None:
        responses = live_responses()
        responses[POINT_URL] = {"properties": {"forecast": "https://example.invalid/private"}}
        client = FakeClient(responses)
        with patch("app.services.weather_service.httpx.Client", return_value=client):
            unavailable = self.service.get_weather()

        self.assertEqual(unavailable["status"], "unavailable")
        self.assertEqual(len(client.calls), 1)


class WeatherEndpointTests(unittest.IsolatedAsyncioTestCase):
    async def test_endpoint_uses_adapter_without_network_access(self) -> None:
        expected = {"status": "live", "available": True, "stale": False}
        with patch("app.api.operations.weather_service.get_weather", return_value=expected):
            self.assertEqual(await fairfax_weather(), expected)


if __name__ == "__main__":
    unittest.main()
