from __future__ import annotations

import json
from datetime import datetime

import pytest

from app.schemas.matching import FeedbackRequest, ShipperMatchRequest
from app.services.data_repository import MatchingDataRepository
from app.services.feedback_store import FeedbackStore
from app.services.matching_engine import CarrierNotFoundError, MatchingEngine
from app.services.model_service import MatchingModelService


@pytest.fixture
def engine(tmp_path):
    repository = MatchingDataRepository(tmp_path / "missing.xlsx", allow_demo_data=True)
    models = MatchingModelService(tmp_path / "missing-models")
    return MatchingEngine(repository, models)


def shipper_payload():
    return {
        "requestId": "shipper-test-001",
        "cargo": {
            "callId": "C0042",
            "shipperId": "S018",
            "routeId": "R01",
            "origin": "부산신항",
            "originRegion": "영남",
            "destination": "김포",
            "destinationRegion": "수도권",
            "loadingAt": "2026-08-13T17:30:00+09:00",
            "loadingWindowMinutes": 180,
            "leadTimeHours": 26.0,
            "tonnage": 11,
            "bodyType": "카고",
            "vehicleType": "11t카고",
            "allowCompatibleVehicle": False,
            "item": "철강재",
            "weightKg": 9500,
            "pallets": 10,
            "baseFare": 454000,
            "offeredFare": 454000,
            "registrationActor": "원화주직접",
            "adjustmentPermissionApproved": True,
            "splitAllowed": False,
            "concurrentLoadAllowed": False,
            "waypointAllowed": False,
            "orderChangeAllowed": False,
            "loadingMethod": "지게차",
            "unloadingMethod": "지게차",
            "paymentMethod": "인수증후불",
            "timeChangeCostPerHour": 0,
        },
        "timeWindowOptionsMinutes": [180, 480, 1440, 2880],
        "carrierLimit": 5,
    }


def test_shipper_returns_all_slider_scenarios_without_inventing_probabilities(engine):
    response = engine.match_shipper(ShipperMatchRequest.model_validate(shipper_payload()))

    assert [item.loadingWindowMinutes for item in response.timeWindowScenarios] == [180, 480, 1440, 2880]
    assert response.current.scenarioId == "CURRENT"
    assert response.timeWindowScenarios[0].scenarioId == "WINDOW_180"
    counts = [item.candidateCount for item in response.timeWindowScenarios]
    assert counts == sorted(counts)
    assert all(item.failureProbability is None for item in response.timeWindowScenarios)
    assert all(item.expectedFare.point == 454000 for item in response.timeWindowScenarios)
    assert response.predictionSources["failureProbability"] == "unavailable"
    assert response.predictionSources["expectedFare"] == "offered_fare_fallback"


def test_shipper_carriers_respect_vehicle_and_region_filters(engine):
    request = ShipperMatchRequest.model_validate(shipper_payload())
    response = engine.match_shipper(request)
    snapshot = engine.repository.snapshot()
    carriers = {item.carrier_id: item for item in snapshot.carriers}

    for result in response.carriers:
        carrier = carriers[result.carrierId]
        assert carrier.tonnage == 11
        assert carrier.body_type == "카고"
        assert carrier.garage_region in {"영남", "충청"}
        assert 0 <= result.score <= 100
        assert result.estimatedNetIncome >= 0


def test_carrier_response_uses_krw_and_expected_fields(engine):
    response = engine.match_carrier("D07980", limit=3)

    assert response.carrierId == "D07980"
    assert 1 <= len(response.recommendations) <= 3
    for result in response.recommendations:
        assert result.fare >= 100000
        assert result.fuelCost >= 0
        assert result.emptyCost >= 0
        assert result.netIncome == max(0, result.fare - result.fuelCost - result.emptyCost)
        assert result.durationHours >= 0
        assert 0 <= result.score <= 100


def test_unknown_carrier_raises(engine):
    with pytest.raises(CarrierNotFoundError):
        engine.match_carrier("D-NOT-FOUND")


def test_feedback_is_idempotent(tmp_path):
    store = FeedbackStore(tmp_path / "feedback.jsonl")
    request = FeedbackRequest.model_validate({
        "matchId": "M-20260812-000001",
        "actorType": "CARRIER",
        "actorId": "D00127",
        "action": "ACCEPT",
        "callId": "C0042",
        "scenarioId": None,
        "recommendationType": None,
        "reasonCode": None,
        "occurredAt": "2026-08-12T16:22:14+09:00",
    })

    first = store.record(request)
    second = store.record(request)

    assert first.status == "recorded"
    assert second.status == "duplicate"
    assert first.feedbackId == second.feedbackId
    rows = [json.loads(line) for line in (tmp_path / "feedback.jsonl").read_text(encoding="utf-8").splitlines()]
    assert len(rows) == 1


def test_time_window_options_are_sorted_and_deduplicated():
    payload = shipper_payload()
    payload["timeWindowOptionsMinutes"] = [480, 180, 480]
    request = ShipperMatchRequest.model_validate(payload)
    assert request.timeWindowOptionsMinutes == [180, 480]
