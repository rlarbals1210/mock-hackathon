from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

from app.schemas.catalog import (
    CatalogFilters,
    CatalogOptionsResponse,
    LocationOption,
    NumberOption,
    RouteOption,
    TextOption,
    VehicleOption,
)
from app.schemas.matching import CargoInput
from app.services.data_repository import CallRecord, MatchingDataRepository, RouteRecord


KST = timezone(timedelta(hours=9))


@dataclass(frozen=True)
class CatalogRow:
    call: CallRecord
    route: RouteRecord


class CatalogService:
    """Builds faceted form options exclusively from the loaded workbook snapshot."""

    def __init__(self, repository: MatchingDataRepository) -> None:
        self.repository = repository

    @staticmethod
    def _value(row: CatalogRow, field: str) -> Any:
        values = {
            "routeId": row.route.route_id,
            "originRegion": row.route.origin_region,
            "origin": row.route.origin,
            "destinationRegion": row.route.destination_region,
            "destination": row.route.destination,
            "tonnage": row.call.tonnage,
            "bodyType": row.call.body_type,
            "vehicleType": row.call.vehicle_type,
            "item": row.call.item,
            "loadingMethod": row.call.loading_method,
            "unloadingMethod": row.call.unloading_method,
            "paymentMethod": row.call.payment_method,
        }
        return values[field]

    @classmethod
    def _filtered(
        cls,
        rows: list[CatalogRow],
        filters: CatalogFilters,
        *,
        skip: str | None = None,
    ) -> list[CatalogRow]:
        active = filters.model_dump(exclude_none=True)
        return [
            row
            for row in rows
            if all(field == skip or cls._value(row, field) == value for field, value in active.items())
        ]

    @classmethod
    def _text_options(
        cls,
        rows: list[CatalogRow],
        filters: CatalogFilters,
        field: str,
        getter: Callable[[CatalogRow], str],
    ) -> list[TextOption]:
        counts = Counter(getter(row) for row in cls._filtered(rows, filters, skip=field))
        return [TextOption(value=value, label=value, callCount=counts[value]) for value in sorted(counts)]

    @classmethod
    def _number_options(
        cls,
        rows: list[CatalogRow],
        filters: CatalogFilters,
        field: str,
        getter: Callable[[CatalogRow], int],
        label: Callable[[int], str],
    ) -> list[NumberOption]:
        counts = Counter(getter(row) for row in cls._filtered(rows, filters, skip=field))
        return [NumberOption(value=value, label=label(value), callCount=counts[value]) for value in sorted(counts)]

    @classmethod
    def _location_options(
        cls,
        rows: list[CatalogRow],
        filters: CatalogFilters,
        field: str,
        getter: Callable[[CatalogRow], tuple[str, str]],
    ) -> list[LocationOption]:
        counts = Counter(getter(row) for row in cls._filtered(rows, filters, skip=field))
        return [
            LocationOption(value=value, label=value, region=region, callCount=count)
            for (value, region), count in sorted(counts.items())
        ]

    @classmethod
    def _vehicle_options(cls, rows: list[CatalogRow], filters: CatalogFilters) -> list[VehicleOption]:
        facet_rows = cls._filtered(rows, filters, skip="vehicleType")
        counts = Counter((row.call.vehicle_type, row.call.tonnage, row.call.body_type) for row in facet_rows)
        return [
            VehicleOption(value=value, label=value, tonnage=tonnage, bodyType=body_type, callCount=count)
            for (value, tonnage, body_type), count in sorted(counts.items(), key=lambda item: (item[0][1], item[0][2]))
        ]

    @staticmethod
    def _sample_cargo(rows: list[CatalogRow]) -> CargoInput | None:
        compatible = sorted(
            (row for row in rows if 30 <= row.call.loading_window_minutes <= 2880),
            key=lambda row: row.call.call_id,
        )
        if not compatible:
            return None
        row = compatible[0]
        call = row.call
        route = row.route
        return CargoInput(
            callId=call.call_id,
            shipperId=call.shipper_id,
            routeId=route.route_id,
            origin=route.origin,
            originRegion=route.origin_region,
            destination=route.destination,
            destinationRegion=route.destination_region,
            loadingAt=call.loading_at,
            loadingWindowMinutes=call.loading_window_minutes,
            leadTimeHours=call.lead_time_hours,
            tonnage=call.tonnage,
            bodyType=call.body_type,
            vehicleType=call.vehicle_type,
            allowCompatibleVehicle=call.vehicle_flexible,
            item=call.item,
            weightKg=call.weight_kg,
            pallets=call.pallets,
            baseFare=call.base_fare_krw,
            offeredFare=call.offered_fare_krw,
            registrationActor=call.registration_actor,
            adjustmentPermissionApproved=not call.permission_unapproved,
            splitAllowed=call.split_allowed,
            concurrentLoadAllowed=call.concurrent_load_allowed,
            waypointAllowed=call.waypoint_allowed,
            orderChangeAllowed=call.order_change_allowed,
            loadingMethod=call.loading_method,
            unloadingMethod=call.unloading_method,
            paymentMethod=call.payment_method,
            timeChangeCostPerHour=call.time_change_cost_per_hour,
        )

    def options(self, filters: CatalogFilters) -> CatalogOptionsResponse:
        snapshot = self.repository.snapshot()
        rows = [
            CatalogRow(call=call, route=route)
            for call in snapshot.calls
            if (route := snapshot.routes.get(call.route_id)) is not None
        ]
        matched = self._filtered(rows, filters)

        route_counts = Counter(row.route.route_id for row in matched)
        routes = []
        for route_id in sorted(route_counts):
            route = snapshot.routes[route_id]
            fares = {
                str(tonnage): fare
                for (fare_route_id, tonnage), fare in sorted(snapshot.base_fares.items())
                if fare_route_id == route_id
            }
            routes.append(RouteOption(
                routeId=route_id,
                label=f"{route.origin} → {route.destination}",
                origin=route.origin,
                originRegion=route.origin_region,
                destination=route.destination,
                destinationRegion=route.destination_region,
                distanceKm=route.distance_km,
                standardHours=route.standard_hours,
                toll=route.toll_krw,
                baseFareByTonnage=fares,
                callCount=route_counts[route_id],
            ))

        window_counts = Counter(
            row.call.loading_window_minutes
            for row in matched
            if 30 <= row.call.loading_window_minutes <= 2880
        )
        windows = [
            NumberOption(value=value, label=f"{value}분", callCount=window_counts[value])
            for value in sorted(window_counts)
        ]

        return CatalogOptionsResponse(
            source=snapshot.source,
            generatedAt=datetime.now(KST),
            totalCallCount=len(rows),
            matchedCallCount=len(matched),
            selectionValid=bool(matched),
            appliedFilters=filters,
            originRegions=self._text_options(rows, filters, "originRegion", lambda row: row.route.origin_region),
            origins=self._location_options(
                rows, filters, "origin", lambda row: (row.route.origin, row.route.origin_region)
            ),
            destinationRegions=self._text_options(
                rows, filters, "destinationRegion", lambda row: row.route.destination_region
            ),
            destinations=self._location_options(
                rows, filters, "destination", lambda row: (row.route.destination, row.route.destination_region)
            ),
            tonnages=self._number_options(rows, filters, "tonnage", lambda row: row.call.tonnage, lambda value: f"{value}톤"),
            bodyTypes=self._text_options(rows, filters, "bodyType", lambda row: row.call.body_type),
            vehicleTypes=self._vehicle_options(rows, filters),
            items=self._text_options(rows, filters, "item", lambda row: row.call.item),
            loadingMethods=self._text_options(rows, filters, "loadingMethod", lambda row: row.call.loading_method),
            unloadingMethods=self._text_options(
                rows, filters, "unloadingMethod", lambda row: row.call.unloading_method
            ),
            paymentMethods=self._text_options(rows, filters, "paymentMethod", lambda row: row.call.payment_method),
            loadingWindowMinutes=windows,
            routes=routes,
            sampleCargo=self._sample_cargo(matched),
            warnings=list(snapshot.warnings),
        )
