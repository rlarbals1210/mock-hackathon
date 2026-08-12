from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from app.api.dependencies import get_feedback_store, get_matching_engine
from app.core.config import settings
from app.main import app
from app.services.data_repository import MatchingDataRepository
from app.services.feedback_store import FeedbackStore
from app.services.matching_engine import MatchingEngine
from app.services.model_service import MatchingModelService
from tests.test_matching_engine import shipper_payload


test_engine = MatchingEngine(
    MatchingDataRepository(Path("/tmp/movin-api-test-missing.xlsx"), allow_demo_data=True),
    MatchingModelService(settings.matching_model_path),
)
app.dependency_overrides[get_matching_engine] = lambda: test_engine
client = TestClient(app, raise_server_exceptions=False)


def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_frontend_5174_cors_preflight():
    response = client.options(
        "/api/v1/matches/shipper",
        headers={
            "Origin": "http://localhost:5174",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5174"


def test_shipper_contract():
    response = client.post("/api/v1/matches/shipper", json=shipper_payload())
    assert response.status_code == 200
    body = response.json()
    assert body["requestId"] == "shipper-test-001"
    assert len(body["timeWindowScenarios"]) == 4
    assert 0 <= body["current"]["failureProbability"] <= 1
    assert body["predictionSources"]["failureProbability"] == "hist_gradient_boosting_v13"


def test_carrier_contract():
    response = client.get("/api/v1/matches/carrier/D07980?limit=2")
    assert response.status_code == 200
    recommendation = response.json()["recommendations"][0]
    assert set(recommendation) == {
        "callId", "route", "loadingTime", "emptyDistanceKm", "durationHours",
        "fare", "fuelCost", "emptyCost", "netIncome", "tags", "warning", "score",
    }


def test_common_not_found_error():
    response = client.get("/api/v1/matches/carrier/D-NOT-FOUND")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "CARRIER_NOT_FOUND"
    assert set(response.json()["error"]) == {"code", "message", "requestId", "details"}


def test_common_validation_error():
    payload = shipper_payload()
    payload["cargo"]["loadingWindowMinutes"] = 1
    response = client.post("/api/v1/matches/shipper", json=payload)
    assert response.status_code == 422
    body = response.json()["error"]
    assert body["code"] == "VALIDATION_ERROR"
    assert body["details"]


def test_invalid_route_combination_uses_common_error():
    payload = shipper_payload()
    payload["cargo"]["destination"] = "화성"
    response = client.post("/api/v1/matches/shipper", json=payload)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_REQUEST"


def test_feedback_contract_and_duplicate(tmp_path):
    store = FeedbackStore(tmp_path / "feedback.jsonl")
    app.dependency_overrides[get_feedback_store] = lambda: store
    payload = {
        "matchId": "M-20260812-000001",
        "actorType": "CARRIER",
        "actorId": "D00127",
        "action": "ACCEPT",
        "callId": "C0042",
        "scenarioId": None,
        "recommendationType": None,
        "reasonCode": None,
        "occurredAt": "2026-08-12T16:22:14+09:00",
    }
    try:
        first = client.post("/api/v1/matches/feedback", json=payload)
        second = client.post("/api/v1/matches/feedback", json=payload)
    finally:
        app.dependency_overrides.pop(get_feedback_store, None)
    assert first.status_code == 200
    assert first.json()["status"] == "recorded"
    assert second.json()["status"] == "duplicate"
