from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


BodyType = Literal["냉동", "냉장", "윙바디", "카고", "탑차"]
Tonnage = Literal[5, 11, 25]


class ApiModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CargoInput(ApiModel):
    callId: str | None = Field(default=None, min_length=1, max_length=40)
    shipperId: str | None = Field(default=None, min_length=1, max_length=40)
    routeId: str = Field(min_length=1, max_length=20)
    origin: str = Field(min_length=1, max_length=80)
    originRegion: str = Field(min_length=1, max_length=40)
    destination: str = Field(min_length=1, max_length=80)
    destinationRegion: str = Field(min_length=1, max_length=40)
    loadingAt: datetime
    loadingWindowMinutes: int = Field(ge=30, le=2880)
    leadTimeHours: float = Field(gt=0, le=720)
    tonnage: Tonnage
    bodyType: BodyType
    allowCompatibleVehicle: bool = False
    item: str = Field(min_length=1, max_length=80)
    weightKg: int = Field(gt=0, le=25_000)
    pallets: int = Field(ge=1, le=100)
    baseFare: int = Field(gt=0, le=100_000_000)
    offeredFare: int = Field(gt=0, le=100_000_000)
    registrationActor: Literal["원화주직접", "주선사대리"] = "원화주직접"
    adjustmentPermissionApproved: bool = True
    splitAllowed: bool = False
    concurrentLoadAllowed: bool = False
    waypointAllowed: bool = False
    orderChangeAllowed: bool = False
    loadingMethod: Literal["지게차", "수작업", "호이스트"] = "지게차"
    paymentMethod: Literal["인수증후불", "선불", "착불"] = "인수증후불"
    timeChangeCostPerHour: int = Field(default=0, ge=0, le=10_000_000)

    @model_validator(mode="after")
    def validate_capacity(self) -> "CargoInput":
        if self.weightKg > self.tonnage * 1000:
            raise ValueError("weightKg는 선택한 tonnage의 적재 한도를 넘을 수 없습니다.")
        return self


class ShipperMatchRequest(ApiModel):
    requestId: str | None = Field(default=None, min_length=1, max_length=100)
    cargo: CargoInput
    timeWindowOptionsMinutes: list[int] = Field(min_length=1, max_length=12)
    carrierLimit: int = Field(default=5, ge=1, le=20)

    @model_validator(mode="after")
    def normalize_time_windows(self) -> "ShipperMatchRequest":
        values = sorted(set(self.timeWindowOptionsMinutes + [self.cargo.loadingWindowMinutes]))
        if any(value < 30 or value > 2880 for value in values):
            raise ValueError("timeWindowOptionsMinutes 값은 30 이상 2880 이하여야 합니다.")
        if len(values) > 12:
            raise ValueError("timeWindowOptionsMinutes는 중복 제거 후 최대 12개입니다.")
        self.timeWindowOptionsMinutes = values
        return self


class FareRange(ApiModel):
    point: int = Field(ge=0)
    min: int = Field(ge=0)
    max: int = Field(ge=0)

    @model_validator(mode="after")
    def validate_order(self) -> "FareRange":
        if not self.min <= self.point <= self.max:
            raise ValueError("expectedFare는 min ≤ point ≤ max여야 합니다.")
        return self


class Scenario(ApiModel):
    scenarioId: str
    loadingWindowMinutes: int = Field(ge=30, le=2880)
    candidateCount: int = Field(ge=0)
    expectedDispatchMinutes: int = Field(ge=0)
    expectedFare: FareRange
    failureProbability: float | None = Field(default=None, ge=0, le=1)
    confidence: float | None = Field(default=None, ge=0, le=1)


class Recommendation(ApiModel):
    type: Literal["TIME_WINDOW", "VEHICLE", "DATE", "PRICE", "AUTHORITY", "SPLIT"]
    description: str
    shipperAcceptanceProbability: float | None = Field(default=None, ge=0, le=1)
    scenarioId: str
    candidateIncrease: int
    dispatchMinutesChange: int
    fareChange: int


class CarrierBrief(ApiModel):
    carrierId: str
    score: int = Field(ge=0, le=100)
    emptyDistanceKm: int = Field(ge=0)
    estimatedNetIncome: int = Field(ge=0)
    preferenceMatches: list[str]
    warning: str | None = None


class CargoSummary(ApiModel):
    callId: str | None = None
    route: str
    loadingAt: datetime
    tonnage: int
    bodyType: str
    item: str
    weightKg: int


class ShipperMatchResponse(ApiModel):
    requestId: str
    matchId: str
    generatedAt: datetime
    cargo: CargoSummary
    current: Scenario
    timeWindowScenarios: list[Scenario]
    recommendations: list[Recommendation]
    carriers: list[CarrierBrief]
    explanationFacts: list[str]
    predictionSources: dict[str, str]
    warnings: list[str]


class CarrierRecommendation(ApiModel):
    callId: str
    route: str
    loadingTime: datetime
    emptyDistanceKm: int = Field(ge=0)
    durationHours: float = Field(ge=0)
    fare: int = Field(ge=0)
    fuelCost: int = Field(ge=0)
    emptyCost: int = Field(ge=0)
    netIncome: int = Field(ge=0)
    tags: list[str]
    warning: str | None = None
    score: int = Field(ge=0, le=100)


class CarrierMatchesResponse(ApiModel):
    carrierId: str
    generatedAt: datetime
    recommendations: list[CarrierRecommendation]
    predictionSources: dict[str, str]
    warnings: list[str]


class FeedbackRequest(ApiModel):
    matchId: str = Field(min_length=1, max_length=100)
    actorType: Literal["SHIPPER", "CARRIER"]
    actorId: str = Field(min_length=1, max_length=100)
    action: Literal["VIEW", "ACCEPT", "REJECT", "IGNORE"]
    callId: str | None = Field(default=None, max_length=100)
    scenarioId: str | None = Field(default=None, max_length=100)
    recommendationType: str | None = Field(default=None, max_length=100)
    reasonCode: str | None = Field(default=None, max_length=200)
    occurredAt: datetime


class FeedbackResponse(ApiModel):
    feedbackId: str
    status: Literal["recorded", "duplicate"]
    recordedAt: datetime


class ErrorDetail(ApiModel):
    field: str
    reason: str


class ErrorBody(ApiModel):
    code: str
    message: str
    requestId: str | None = None
    details: list[ErrorDetail] = Field(default_factory=list)


class ErrorResponse(ApiModel):
    error: ErrorBody
