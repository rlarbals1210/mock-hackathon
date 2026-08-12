from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from app.api.dependencies import get_catalog_service, get_feedback_store, get_matching_engine
from app.core.config import settings
from app.main import app
from app.services.data_repository import MatchingDataRepository
from app.services.catalog_service import CatalogService
from app.services.feedback_store import FeedbackStore
from app.services.matching_engine import MatchingEngine
from app.services.model_service import MatchingModelService
from tests.test_matching_engine import shipper_payload


test_engine = MatchingEngine(
    MatchingDataRepository(Path("/tmp/movin-api-test-missing.xlsx"), allow_demo_data=True),
    MatchingModelService(settings.matching_model_path),
)
app.dependency_overrides[get_matching_engine] = lambda: test_engine
app.dependency_overrides[get_catalog_service] = lambda: CatalogService(test_engine.repository)
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


def test_catalog_options_are_derived_from_loaded_data():
    response = client.get("/api/v1/catalog/options")
    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "demo_seed_v1"
    assert body["totalCallCount"] == 3
    assert {option["value"] for option in body["origins"]} == {"부산신항", "창원공단", "대전유성"}
    assert {option["value"] for option in body["vehicleTypes"]} == {"11t카고"}
    assert {option["value"] for option in body["items"]} == {"철강재", "생활용품", "자동차부품"}
    assert body["sampleCargo"]["routeId"] == "R01"
    assert body["sampleCargo"]["vehicleType"] == "11t카고"


def test_catalog_options_filter_dependent_choices():
    response = client.get(
        "/api/v1/catalog/options",
        params={"origin": "부산신항", "tonnage": 11, "bodyType": "카고"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["selectionValid"] is True
    assert body["matchedCallCount"] == 1
    assert [option["value"] for option in body["destinations"]] == ["김포"]
    assert [option["value"] for option in body["items"]] == ["철강재"]
    assert body["routes"][0]["routeId"] == "R01"
    assert body["routes"][0]["baseFareByTonnage"]["11"] == 454000


def test_catalog_invalid_combination_returns_alternatives_without_inventing_values():
    response = client.get(
        "/api/v1/catalog/options",
        params={"origin": "부산신항", "destination": "화성"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["selectionValid"] is False
    assert body["matchedCallCount"] == 0
    assert body["routes"] == []
    assert [option["value"] for option in body["destinations"]] == ["김포"]


def test_catalog_sample_cargo_is_directly_accepted_by_match_api():
    catalog = client.get(
        "/api/v1/catalog/options",
        params={"origin": "부산신항", "destination": "김포", "vehicleType": "11t카고"},
    ).json()
    cargo = catalog["sampleCargo"]
    response = client.post(
        "/api/v1/matches/shipper",
        json={
            "requestId": "catalog-chain-test",
            "cargo": cargo,
            "timeWindowOptionsMinutes": [cargo["loadingWindowMinutes"], 480, 1440, 2880],
            "carrierLimit": 3,
        },
    )
    assert response.status_code == 200
    assert response.json()["cargo"]["callId"] == cargo["callId"]


def test_shipper_contract():
    payload = shipper_payload()
    payload["cargo"]["cargoNote"] = "냉동 만두, 파렛트 4개"
    response = client.post("/api/v1/matches/shipper", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["requestId"] == "shipper-test-001"
    assert body["cargo"]["cargoNote"] == "냉동 만두, 파렛트 4개"
    assert len(body["timeWindowScenarios"]) == 4
    assert 0 <= body["current"]["failureProbability"] <= 1
    assert body["predictionSources"]["failureProbability"] == "hist_gradient_boosting_v13"


def test_carrier_contract():
    response = client.get("/api/v1/matches/carrier/D07980?limit=2")
    assert response.status_code == 200
    body = response.json()
    assert body["matchId"].startswith("M-")
    assert len({item["route"] for item in body["recommendations"]}) == len(body["recommendations"])
    recommendation = body["recommendations"][0]
    assert set(recommendation) == {
        "callId", "route", "loadingTime", "emptyDistanceKm", "durationHours",
        "fare", "fuelCost", "emptyCost", "netIncome", "tags", "warning", "score",
    }


def test_carrier_query_preferences_affect_score_and_tags():
    response = client.get(
        "/api/v1/matches/carrier/D07980",
        params=[
            ("limit", "3"),
            ("preferredRegion", "영남"),
            ("preferredSubRegion", "부산"),
            ("maxEmptyKm", "5"),
            ("maxDurationHours", "6"),
            ("preferredLoadingPeriod", "AFTERNOON"),
            ("prioritizeIncome", "true"),
            ("prioritizeBackhaul", "true"),
        ],
    )
    assert response.status_code == 200
    body = response.json()
    assert body["predictionSources"]["preferences"] == "query_preference_weights_v1"
    tags = {tag for item in body["recommendations"] for tag in item["tags"]}
    assert "설정한 선호 권역 일치" in tags
    assert "설정한 세부 지역 일치" in tags
    assert "공차 5km 이내" in tags
    assert "운행 6시간 이내" in tags
    assert "선호 상차시간 일치" in tags


def test_carrier_rejects_unknown_loading_period():
    response = client.get(
        "/api/v1/matches/carrier/D07980",
        params={"preferredLoadingPeriod": "DAWN"},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_REQUEST"


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


def test_cargo_note_max_length_is_enforced():
    payload = shipper_payload()
    payload["cargo"]["cargoNote"] = "가" * 201
    response = client.post("/api/v1/matches/shipper", json=payload)
    assert response.status_code == 422
    assert any(item["field"] == "cargo.cargoNote" for item in response.json()["error"]["details"])


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
