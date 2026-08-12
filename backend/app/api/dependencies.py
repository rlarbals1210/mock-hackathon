from functools import lru_cache

from app.core.config import settings
from app.services.data_repository import MatchingDataRepository
from app.services.catalog_service import CatalogService
from app.services.feedback_store import FeedbackStore
from app.services.matching_engine import MatchingEngine
from app.services.model_service import MatchingModelService


@lru_cache
def get_repository() -> MatchingDataRepository:
    return MatchingDataRepository(settings.matching_data_path, settings.allow_demo_data)


@lru_cache
def get_model_service() -> MatchingModelService:
    return MatchingModelService(settings.matching_model_path)


@lru_cache
def get_matching_engine() -> MatchingEngine:
    return MatchingEngine(get_repository(), get_model_service())


@lru_cache
def get_catalog_service() -> CatalogService:
    return CatalogService(get_repository())


@lru_cache
def get_feedback_store() -> FeedbackStore:
    return FeedbackStore(settings.feedback_path)


def warmup_matching_services() -> dict[str, object]:
    """Load the large workbook and model bundles before the first user request."""
    snapshot = get_repository().snapshot()
    models = get_model_service()
    models.warmup()
    return {
        "dataSource": snapshot.source,
        "modelAReady": models.has_model_a,
        "modelBReady": models.has_model_b,
        "warnings": [*snapshot.warnings, *models.warnings],
    }
