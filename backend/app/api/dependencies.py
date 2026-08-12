from functools import lru_cache

from app.core.config import settings
from app.services.data_repository import MatchingDataRepository
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
def get_feedback_store() -> FeedbackStore:
    return FeedbackStore(settings.feedback_path)
