from __future__ import annotations

from datetime import datetime, timedelta, timezone
from itertools import count
from threading import Lock

from app.schemas.matching import (
    CargoSummary,
    CarrierBrief,
    CarrierMatchesResponse,
    CarrierRecommendation,
    FareRange,
    Recommendation,
    Scenario,
    ShipperMatchRequest,
    ShipperMatchResponse,
)
from app.services.data_repository import (
    CallRecord,
    CarrierRecord,
    DataSnapshot,
    MatchingDataRepository,
    RouteRecord,
    ShipperStats,
)
from app.services.model_service import MatchingModelService


KST = timezone(timedelta(hours=9))
ADJACENT_REGIONS = {
    "수도권": {"충청", "강원제주"},
    "충청": {"수도권", "영남", "호남"},
    "영남": {"충청"},
    "호남": {"충청", "영남"},
    "강원제주": {"수도권"},
}
COMPATIBLE_BODY_TYPES = {
    "냉동": {"냉동"},
    "냉장": {"냉장", "냉동"},
    "윙바디": {"윙바디", "카고"},
    "카고": {"윙바디", "카고"},
    "탑차": {"윙바디", "탑차"},
}
FUEL_EFFICIENCY_KM_PER_LITER = {5: 4.3, 11: 3.2, 25: 2.4}
FUEL_PRICE_KRW_PER_LITER = 1_650
EMPTY_COST_KRW_PER_KM = {5: 850, 11: 1_050, 25: 1_350}


class CarrierNotFoundError(LookupError):
    pass


class RouteNotFoundError(LookupError):
    pass


class InvalidMatchRequestError(ValueError):
    pass


class MatchingEngine:
    def __init__(self, repository: MatchingDataRepository, models: MatchingModelService) -> None:
        self.repository = repository
        self.models = models
        self._sequence = count(1)
        self._sequence_lock = Lock()

    def _new_match_id(self, now: datetime) -> str:
        with self._sequence_lock:
            number = next(self._sequence)
        return f"M-{now:%Y%m%d}-{number:06d}"

    @staticmethod
    def _region_reachable(carrier: CarrierRecord, origin_region: str) -> bool:
        if carrier.activity_radius >= 3:
            return True
        if carrier.garage_region == origin_region:
            return True
        return carrier.activity_radius >= 2 and carrier.garage_region in ADJACENT_REGIONS.get(origin_region, set())

    @staticmethod
    def _vehicle_matches(carrier: CarrierRecord, tonnage: int, body_type: str, flexible: bool) -> bool:
        tonnage_ok = carrier.tonnage >= tonnage if flexible else carrier.tonnage == tonnage
        allowed_types = COMPATIBLE_BODY_TYPES.get(body_type, {body_type}) if flexible else {body_type}
        return tonnage_ok and carrier.body_type in allowed_types

    @staticmethod
    def _is_night(loading_at: datetime) -> bool:
        return loading_at.hour >= 18 or loading_at.hour < 6

    def _hard_eligible(
        self,
        carrier: CarrierRecord,
        *,
        origin_region: str,
        tonnage: int,
        body_type: str,
        flexible: bool,
        loading_at: datetime,
    ) -> bool:
        return (
            self._region_reachable(carrier, origin_region)
            and self._vehicle_matches(carrier, tonnage, body_type, flexible)
            and (carrier.night_allowed or not self._is_night(loading_at))
        )

    def _candidate_pool(
        self,
        snapshot: DataSnapshot,
        *,
        origin_region: str,
        tonnage: int,
        body_type: str,
        flexible: bool,
        loading_at: datetime,
        window_minutes: int,
    ) -> list[CarrierRecord]:
        availability_threshold = min(max(window_minutes / 60, 0.5) / 48, 1.0)
        return [
            carrier
            for carrier in snapshot.carriers
            if self._hard_eligible(
                carrier,
                origin_region=origin_region,
                tonnage=tonnage,
                body_type=body_type,
                flexible=flexible,
                loading_at=loading_at,
            )
            and carrier.availability_phase < availability_threshold
        ]

    @staticmethod
    def _dispatch_minutes(candidate_count: int) -> int:
        return int(round(266 / max(candidate_count, 1) ** 0.354))

    @staticmethod
    def _flex_cargo(
        *,
        split_allowed: bool,
        concurrent_load_allowed: bool,
        waypoint_allowed: bool,
        order_change_allowed: bool,
    ) -> float:
        return sum((split_allowed, concurrent_load_allowed, waypoint_allowed, order_change_allowed)) / 4

    def _scenario(
        self,
        *,
        snapshot: DataSnapshot,
        request: ShipperMatchRequest,
        route: RouteRecord,
        stats: ShipperStats,
        window_minutes: int,
        candidate_count_48h: int,
    ) -> Scenario:
        cargo = request.cargo
        candidates = self._candidate_pool(
            snapshot,
            origin_region=cargo.originRegion,
            tonnage=cargo.tonnage,
            body_type=cargo.bodyType,
            flexible=cargo.allowCompatibleVehicle,
            loading_at=cargo.loadingAt,
            window_minutes=window_minutes,
        )
        dispatch_minutes = self._dispatch_minutes(len(candidates))
        model_result = self.models.predict_scenario({
            "loading_window_minutes": window_minutes,
            "lead_time_hours": cargo.leadTimeHours,
            "distance_km": route.distance_km,
            "tonnage": cargo.tonnage,
            "weight_kg": cargo.weightKg,
            "pallets": cargo.pallets,
            "urgent": cargo.leadTimeHours < 15,
            "permission_unapproved": not cargo.adjustmentPermissionApproved,
            "flex_cargo": self._flex_cargo(
                split_allowed=cargo.splitAllowed,
                concurrent_load_allowed=cargo.concurrentLoadAllowed,
                waypoint_allowed=cargo.waypointAllowed,
                order_change_allowed=cargo.orderChangeAllowed,
            ),
            "vehicle_flexible": cargo.allowCompatibleVehicle,
            "base_fare_krw": cargo.baseFare,
            "candidate_count": len(candidates),
            "candidate_count_48h": candidate_count_48h,
            "shipper_order_count": stats.order_count,
            "weekday_concentration": stats.weekday_concentration,
            "route_concentration": stats.route_concentration,
            "shipper_segment": stats.segment,
            "registration_actor": cargo.registrationActor,
            "route_id": cargo.routeId,
            "body_type": cargo.bodyType,
            "loading_at": cargo.loadingAt,
        })
        if model_result.fare_point is None:
            fare_point = cargo.offeredFare
            fare_min = cargo.offeredFare
            fare_max = cargo.offeredFare
            confidence = None
        else:
            fare_point = model_result.fare_point
            fare_min = model_result.fare_min or fare_point
            fare_max = model_result.fare_max or fare_point
            confidence = 0.78
        return Scenario(
            scenarioId=f"WINDOW_{window_minutes}",
            loadingWindowMinutes=window_minutes,
            candidateCount=len(candidates),
            expectedDispatchMinutes=dispatch_minutes,
            expectedFare=FareRange(point=fare_point, min=fare_min, max=fare_max),
            failureProbability=model_result.failure_probability,
            confidence=confidence,
        )

    @staticmethod
    def _estimated_empty_distance(carrier: CarrierRecord, route: RouteRecord) -> int:
        if carrier.garage_region == route.origin_region:
            multiplier = 0.65
        elif carrier.garage_region in ADJACENT_REGIONS.get(route.origin_region, set()):
            multiplier = 1.25
        else:
            multiplier = 2.0
        return max(1, int(round(carrier.historical_empty_km * multiplier)))

    @staticmethod
    def _costs(tonnage: int, loaded_distance_km: int, empty_distance_km: int, fare: int, toll_krw: int) -> tuple[int, int, int]:
        fuel_efficiency = FUEL_EFFICIENCY_KM_PER_LITER[tonnage]
        fuel_cost = int(round((loaded_distance_km / fuel_efficiency) * FUEL_PRICE_KRW_PER_LITER)) + toll_krw
        empty_cost = int(round(empty_distance_km * EMPTY_COST_KRW_PER_KM[tonnage]))
        net_income = max(0, fare - fuel_cost - empty_cost)
        return fuel_cost, empty_cost, net_income

    def _score_carrier(self, carrier: CarrierRecord, route: RouteRecord, empty_km: int, net_income: int, fare: int) -> int:
        reliability = carrier.reliability * 25
        acceptance = carrier.historical_acceptance_rate * 15
        preference = 20 if carrier.preferred_region == route.destination_region else 8
        empty_score = max(0, 25 - min(empty_km, 100) * 0.25)
        income_score = min(15, (net_income / max(fare, 1)) * 18)
        return max(0, min(100, int(round(reliability + acceptance + preference + empty_score + income_score))))

    def _carrier_brief(self, carrier: CarrierRecord, route: RouteRecord, fare: int) -> CarrierBrief:
        empty_km = self._estimated_empty_distance(carrier, route)
        _, _, net_income = self._costs(carrier.tonnage, route.distance_km, empty_km, fare, route.toll_krw)
        tags = []
        if carrier.garage_region == route.origin_region:
            tags.append(f"{route.origin_region} 출발 적합")
        if carrier.preferred_region == route.destination_region:
            tags.append(f"{route.destination_region} 도착 선호")
        if not tags:
            tags.append("필수 운송 조건 충족")
        warning = "상차지까지 공차거리가 30km를 초과합니다." if empty_km > 30 else None
        return CarrierBrief(
            carrierId=carrier.carrier_id,
            score=self._score_carrier(carrier, route, empty_km, net_income, fare),
            emptyDistanceKm=empty_km,
            estimatedNetIncome=net_income,
            preferenceMatches=tags,
            warning=warning,
        )

    def match_shipper(self, request: ShipperMatchRequest) -> ShipperMatchResponse:
        snapshot = self.repository.snapshot()
        route = snapshot.routes.get(request.cargo.routeId)
        if route is None:
            raise RouteNotFoundError(request.cargo.routeId)
        cargo = request.cargo
        if (
            cargo.origin != route.origin
            or cargo.originRegion != route.origin_region
            or cargo.destination != route.destination
            or cargo.destinationRegion != route.destination_region
        ):
            raise InvalidMatchRequestError("routeId와 출발지·도착지 정보가 일치하지 않습니다.")
        expected_base_fare = snapshot.base_fares.get((cargo.routeId, cargo.tonnage))
        if expected_base_fare is not None and abs(cargo.baseFare - expected_base_fare) > max(1_000, expected_base_fare * 0.2):
            raise InvalidMatchRequestError("baseFare가 참조 기준운임과 20% 넘게 차이 납니다.")
        stats = snapshot.shipper_stats.get(cargo.shipperId or "", ShipperStats())
        count_48h = len(self._candidate_pool(
            snapshot,
            origin_region=cargo.originRegion,
            tonnage=cargo.tonnage,
            body_type=cargo.bodyType,
            flexible=cargo.allowCompatibleVehicle,
            loading_at=cargo.loadingAt,
            window_minutes=2880,
        ))
        scenarios = [
            self._scenario(
                snapshot=snapshot,
                request=request,
                route=route,
                stats=stats,
                window_minutes=window,
                candidate_count_48h=count_48h,
            )
            for window in request.timeWindowOptionsMinutes
        ]
        current_window = next(item for item in scenarios if item.loadingWindowMinutes == cargo.loadingWindowMinutes)
        current = current_window.model_copy(update={"scenarioId": "CURRENT"})
        better = [item for item in scenarios if item.loadingWindowMinutes > current.loadingWindowMinutes]
        selected = max(
            better,
            key=lambda item: (item.candidateCount - current.candidateCount) / max(item.loadingWindowMinutes - current.loadingWindowMinutes, 1),
            default=current,
        )

        acceptance_probability = None
        if selected is not current:
            acceptance_probability = self.models.predict_shipper_acceptance({
                "current_candidate_count": current.candidateCount,
                "proposed_candidate_count": selected.candidateCount,
                "candidate_count_48h": count_48h,
                "current_window_minutes": current.loadingWindowMinutes,
                "proposed_fare_krw": selected.expectedFare.point,
                "proposed_dispatch_minutes": selected.expectedDispatchMinutes,
                "lead_time_hours": cargo.leadTimeHours,
                "distance_km": route.distance_km,
                "tonnage": cargo.tonnage,
                "weight_kg": cargo.weightKg,
                "pallets": cargo.pallets,
                "urgent": cargo.leadTimeHours < 15,
                "permission_unapproved": not cargo.adjustmentPermissionApproved,
                "flex_cargo": self._flex_cargo(
                    split_allowed=cargo.splitAllowed,
                    concurrent_load_allowed=cargo.concurrentLoadAllowed,
                    waypoint_allowed=cargo.waypointAllowed,
                    order_change_allowed=cargo.orderChangeAllowed,
                ),
                "vehicle_flexible": cargo.allowCompatibleVehicle,
                "base_fare_krw": cargo.baseFare,
                "offered_fare_krw": cargo.offeredFare,
                "shipper_order_count": stats.order_count,
                "weekday_concentration": stats.weekday_concentration,
                "route_concentration": stats.route_concentration,
                "shipper_segment": stats.segment,
                "shipper_acceptance_rate": stats.historical_acceptance_rate,
                "registration_actor": cargo.registrationActor,
                "body_type": cargo.bodyType,
                "loading_method": cargo.loadingMethod,
                "payment_method": cargo.paymentMethod,
                "time_change_cost_per_hour": cargo.timeChangeCostPerHour,
            })

        recommendations = []
        if selected is not current:
            recommendations.append(Recommendation(
                type="TIME_WINDOW",
                description=(
                    f"상차 가능 시간을 {current.loadingWindowMinutes / 60:g}시간에서 "
                    f"{selected.loadingWindowMinutes / 60:g}시간으로 확대"
                ),
                shipperAcceptanceProbability=acceptance_probability,
                scenarioId=selected.scenarioId,
                candidateIncrease=selected.candidateCount - current.candidateCount,
                dispatchMinutesChange=selected.expectedDispatchMinutes - current.expectedDispatchMinutes,
                fareChange=selected.expectedFare.point - current.expectedFare.point,
            ))

        selected_pool = self._candidate_pool(
            snapshot,
            origin_region=cargo.originRegion,
            tonnage=cargo.tonnage,
            body_type=cargo.bodyType,
            flexible=cargo.allowCompatibleVehicle,
            loading_at=cargo.loadingAt,
            window_minutes=selected.loadingWindowMinutes,
        )
        carrier_briefs = sorted(
            (self._carrier_brief(carrier, route, selected.expectedFare.point) for carrier in selected_pool),
            key=lambda item: item.score,
            reverse=True,
        )[: request.carrierLimit]

        facts = []
        if selected is not current:
            facts.append(
                f"상차 가능 시간을 {current.loadingWindowMinutes / 60:g}시간에서 "
                f"{selected.loadingWindowMinutes / 60:g}시간으로 넓히면 후보 운송인이 "
                f"{current.candidateCount}명에서 {selected.candidateCount}명으로 증가합니다."
            )
            facts.append(
                f"같은 비교에서 예상 배차시간은 {current.expectedDispatchMinutes}분에서 "
                f"{selected.expectedDispatchMinutes}분으로 바뀝니다."
            )

        model_b_used = any(item.failureProbability is not None for item in scenarios)
        model_a_used = acceptance_probability is not None
        if model_b_used and selected is not current:
            facts.append(
                f"예상 운임은 {current.expectedFare.point}원에서 {selected.expectedFare.point}원으로 바뀌는 방향입니다."
            )

        now = datetime.now(KST)
        warnings = list(dict.fromkeys([*snapshot.warnings, *self.models.warnings]))
        return ShipperMatchResponse(
            requestId=request.requestId or f"req-{now:%Y%m%d%H%M%S}",
            matchId=self._new_match_id(now),
            generatedAt=now,
            cargo=CargoSummary(
                callId=cargo.callId,
                route=f"{cargo.origin} → {cargo.destination}",
                loadingAt=cargo.loadingAt,
                tonnage=cargo.tonnage,
                bodyType=cargo.bodyType,
                item=cargo.item,
                weightKg=cargo.weightKg,
            ),
            current=current,
            timeWindowScenarios=scenarios,
            recommendations=recommendations,
            carriers=carrier_briefs,
            explanationFacts=facts,
            predictionSources={
                "candidateCount": "supply_pool_v13",
                "expectedDispatchMinutes": "dispatch_curve_v13",
                "expectedFare": "hist_gradient_boosting_v13" if model_b_used else "offered_fare_fallback",
                "failureProbability": "hist_gradient_boosting_v13" if model_b_used else "unavailable",
                "shipperAcceptanceProbability": "hist_gradient_boosting_v13" if model_a_used else "unavailable",
                "carrierScore": "rule_based_v1",
            },
            warnings=warnings,
        )

    def _call_recommendation(
        self,
        carrier: CarrierRecord,
        call: CallRecord,
        route: RouteRecord,
    ) -> CarrierRecommendation | None:
        if not self._hard_eligible(
            carrier,
            origin_region=route.origin_region,
            tonnage=call.tonnage,
            body_type=call.body_type,
            flexible=call.vehicle_flexible,
            loading_at=call.loading_at,
        ):
            return None
        empty_km = self._estimated_empty_distance(carrier, route)
        fuel_cost, empty_cost, net_income = self._costs(
            call.tonnage, route.distance_km, empty_km, call.offered_fare_krw, route.toll_krw
        )
        tags = []
        if carrier.preferred_region == route.destination_region:
            tags.append("선호 권역 일치")
        if route.destination_region == carrier.garage_region:
            tags.append("귀가 방향")
        if call.vehicle_flexible and carrier.body_type != call.body_type:
            tags.append("호환 차종")
        if self._is_night(call.loading_at):
            tags.append("야간 운행 가능")
        if not tags:
            tags.append(f"{route.destination_region} 도착")
        warning = "공차거리가 30km를 초과합니다." if empty_km > 30 else None
        duration = round(route.standard_hours + empty_km / 60 + 0.25, 1)
        return CarrierRecommendation(
            callId=call.call_id,
            route=f"{route.origin} → {route.destination}",
            loadingTime=call.loading_at,
            emptyDistanceKm=empty_km,
            durationHours=duration,
            fare=call.offered_fare_krw,
            fuelCost=fuel_cost,
            emptyCost=empty_cost,
            netIncome=net_income,
            tags=tags,
            warning=warning,
            score=self._score_carrier(carrier, route, empty_km, net_income, call.offered_fare_krw),
        )

    def match_carrier(self, carrier_id: str, limit: int = 3) -> CarrierMatchesResponse:
        snapshot = self.repository.snapshot()
        carrier = next((item for item in snapshot.carriers if item.carrier_id == carrier_id), None)
        if carrier is None:
            raise CarrierNotFoundError(carrier_id)
        recommendations = []
        now = datetime.now(KST)
        upcoming_calls = [call for call in snapshot.calls if now <= call.loading_at <= now + timedelta(days=14)]
        candidate_calls = upcoming_calls if upcoming_calls else list(snapshot.calls)
        for call in candidate_calls:
            route = snapshot.routes.get(call.route_id)
            if route is None:
                continue
            recommendation = self._call_recommendation(carrier, call, route)
            if recommendation is not None:
                recommendations.append(recommendation)
        recommendations.sort(key=lambda item: (item.score, item.netIncome), reverse=True)
        return CarrierMatchesResponse(
            carrierId=carrier_id,
            generatedAt=now,
            recommendations=recommendations[:limit],
            predictionSources={
                "score": "rule_based_v1",
                "emptyDistanceKm": "carrier_history_estimate_v1",
                "costs": "deterministic_cost_v1",
            },
            warnings=list(snapshot.warnings),
        )
