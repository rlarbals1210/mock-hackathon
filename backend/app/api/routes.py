from fastapi import APIRouter, Depends, Query

from app.api.dependencies import get_feedback_store, get_matching_engine
from app.schemas.matching import (
    CarrierMatchesResponse,
    FeedbackRequest,
    FeedbackResponse,
    ShipperMatchRequest,
    ShipperMatchResponse,
)
from app.services.feedback_store import FeedbackStore
from app.services.matching_engine import MatchingEngine

router = APIRouter()


@router.get("/health")
def health_check():
    return {"status": "ok"}


@router.post("/v1/matches/shipper", response_model=ShipperMatchResponse)
def match_shipper(
    request: ShipperMatchRequest,
    engine: MatchingEngine = Depends(get_matching_engine),
) -> ShipperMatchResponse:
    return engine.match_shipper(request)


@router.get("/v1/matches/carrier/{carrier_id}", response_model=CarrierMatchesResponse)
def match_carrier(
    carrier_id: str,
    limit: int = Query(default=3, ge=1, le=20),
    engine: MatchingEngine = Depends(get_matching_engine),
) -> CarrierMatchesResponse:
    return engine.match_carrier(carrier_id, limit)


@router.post("/v1/matches/feedback", response_model=FeedbackResponse)
def record_feedback(
    request: FeedbackRequest,
    store: FeedbackStore = Depends(get_feedback_store),
) -> FeedbackResponse:
    return store.record(request)
