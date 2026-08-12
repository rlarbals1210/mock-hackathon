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
from app.services.matching_engine import InvalidMatchRequestError, MatchingEngine

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
    preferred_region: str | None = Query(default=None, alias="preferredRegion", min_length=1, max_length=40),
    preferred_subregion: str | None = Query(default=None, alias="preferredSubRegion", min_length=1, max_length=40),
    max_empty_km: int | None = Query(default=None, alias="maxEmptyKm", ge=0, le=1_000),
    max_duration_hours: float | None = Query(default=None, alias="maxDurationHours", gt=0, le=168),
    preferred_loading_period: list[str] | None = Query(default=None, alias="preferredLoadingPeriod"),
    prioritize_income: bool = Query(default=False, alias="prioritizeIncome"),
    prioritize_backhaul: bool = Query(default=False, alias="prioritizeBackhaul"),
    engine: MatchingEngine = Depends(get_matching_engine),
) -> CarrierMatchesResponse:
    allowed_periods = {"MORNING", "AFTERNOON", "NIGHT"}
    periods = frozenset(preferred_loading_period or [])
    unknown_periods = sorted(periods.difference(allowed_periods))
    if unknown_periods:
        raise InvalidMatchRequestError(
            "preferredLoadingPeriod는 MORNING, AFTERNOON, NIGHT만 사용할 수 있습니다."
        )
    return engine.match_carrier(
        carrier_id,
        limit,
        preferred_region=preferred_region,
        preferred_subregion=preferred_subregion,
        max_empty_km=max_empty_km,
        max_duration_hours=max_duration_hours,
        preferred_loading_periods=periods,
        prioritize_income=prioritize_income,
        prioritize_backhaul=prioritize_backhaul,
    )


@router.post("/v1/matches/feedback", response_model=FeedbackResponse)
def record_feedback(
    request: FeedbackRequest,
    store: FeedbackStore = Depends(get_feedback_store),
) -> FeedbackResponse:
    return store.record(request)
