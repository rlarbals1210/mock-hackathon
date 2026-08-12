from __future__ import annotations

from datetime import datetime

from pydantic import Field

from app.schemas.matching import ApiModel, CargoInput


class CatalogFilters(ApiModel):
    routeId: str | None = None
    originRegion: str | None = None
    origin: str | None = None
    destinationRegion: str | None = None
    destination: str | None = None
    tonnage: int | None = None
    bodyType: str | None = None
    vehicleType: str | None = None
    item: str | None = None
    loadingMethod: str | None = None
    unloadingMethod: str | None = None
    paymentMethod: str | None = None


class TextOption(ApiModel):
    value: str
    label: str
    callCount: int = Field(ge=0)


class NumberOption(ApiModel):
    value: int
    label: str
    callCount: int = Field(ge=0)


class LocationOption(TextOption):
    region: str


class VehicleOption(TextOption):
    tonnage: int
    bodyType: str


class RouteOption(ApiModel):
    routeId: str
    label: str
    origin: str
    originRegion: str
    destination: str
    destinationRegion: str
    distanceKm: int = Field(ge=0)
    standardHours: float = Field(ge=0)
    toll: int = Field(ge=0)
    baseFareByTonnage: dict[str, int]
    callCount: int = Field(ge=0)


class CatalogOptionsResponse(ApiModel):
    source: str
    generatedAt: datetime
    totalCallCount: int = Field(ge=0)
    matchedCallCount: int = Field(ge=0)
    selectionValid: bool
    appliedFilters: CatalogFilters
    originRegions: list[TextOption]
    origins: list[LocationOption]
    destinationRegions: list[TextOption]
    destinations: list[LocationOption]
    tonnages: list[NumberOption]
    bodyTypes: list[TextOption]
    vehicleTypes: list[VehicleOption]
    items: list[TextOption]
    loadingMethods: list[TextOption]
    unloadingMethods: list[TextOption]
    paymentMethods: list[TextOption]
    loadingWindowMinutes: list[NumberOption]
    routes: list[RouteOption]
    sampleCargo: CargoInput | None = None
    warnings: list[str]
