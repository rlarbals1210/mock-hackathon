from fastapi import APIRouter, Depends, Query

from app.api.dependencies import get_catalog_service, get_feedback_store, get_matching_engine
from app.schemas.catalog import CatalogFilters, CatalogOptionsResponse
from app.schemas.matching import (
    CarrierMatchesResponse,
    FeedbackRequest,
    FeedbackResponse,
    ShipperMatchRequest,
    ShipperMatchResponse,
)
from app.services.feedback_store import FeedbackStore
from app.services.catalog_service import CatalogService
from app.services.matching_engine import MatchingEngine

router = APIRouter()


@router.get("/health")
def health_check():
    return {"status": "ok"}


@router.get("/v1/catalog/options", response_model=CatalogOptionsResponse)
def catalog_options(
    route_id: str | None = Query(default=None, alias="routeId"),
    origin_region: str | None = Query(default=None, alias="originRegion"),
    origin: str | None = Query(default=None),
    destination_region: str | None = Query(default=None, alias="destinationRegion"),
    destination: str | None = Query(default=None),
    tonnage: int | None = Query(default=None),
    body_type: str | None = Query(default=None, alias="bodyType"),
    vehicle_type: str | None = Query(default=None, alias="vehicleType"),
    item: str | None = Query(default=None),
    loading_method: str | None = Query(default=None, alias="loadingMethod"),
    unloading_method: str | None = Query(default=None, alias="unloadingMethod"),
    payment_method: str | None = Query(default=None, alias="paymentMethod"),
    service: CatalogService = Depends(get_catalog_service),
) -> CatalogOptionsResponse:
    filters = CatalogFilters(
        routeId=route_id,
        originRegion=origin_region,
        origin=origin,
        destinationRegion=destination_region,
        destination=destination,
        tonnage=tonnage,
        bodyType=body_type,
        vehicleType=vehicle_type,
        item=item,
        loadingMethod=loading_method,
        unloadingMethod=unloading_method,
        paymentMethod=payment_method,
    )
    return service.options(filters)


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
