// 화면이 쓰는 모양과 매칭 API의 계약 사이를 변환합니다.
// 화면 컴포넌트가 계약 필드를 직접 다루지 않도록 변환을 여기에 모읍니다.

import type { Candidate } from '../data'
import type { CargoForm, LeverState, Prediction } from '../features/shipper/shipperModel'
import { getCargoWeightKg, getLeadHours, getWindowHours } from '../features/shipper/shipperModel'
import type {
  BodyType,
  CarrierRecommendation,
  CargoInput,
  RouteOption,
  Scenario,
  ShipperMatchRequest,
  Tonnage,
  VehicleOption,
} from './types'

/** 등록 화면이 수집하지 않지만 API가 필수로 요구하는 값의 데모 기본값입니다. */
const defaultPallets = 10
const defaultCarrierLimit = 5

export type VehicleMapping = { tonnage: Tonnage; bodyType: BodyType; vehicleType: string }

// 등록 화면의 기존 차량 라벨을 카탈로그의 vehicleType 값으로 옮깁니다.
// 등록 화면이 카탈로그 선택지를 직접 쓰도록 바꾸면(P2) 이 표는 삭제합니다.
const legacyVehicleLabels: Record<string, string> = {
  '5톤 카고': '5t카고',
  '5톤 윙바디': '5t윙바디',
  '11톤 윙바디': '11t윙바디',
  '25톤 카고': '25t카고',
}

/** 카탈로그의 vehicleTypes에서 화면 선택값에 해당하는 항목을 찾습니다. */
export function resolveVehicle(vehicle: string, vehicleTypes: VehicleOption[]): VehicleMapping | null {
  const target = legacyVehicleLabels[vehicle] ?? vehicle
  const option = vehicleTypes.find((item) => item.value === target)
  if (!option) return null
  return {
    tonnage: option.tonnage as Tonnage,
    bodyType: option.bodyType as BodyType,
    vehicleType: option.value,
  }
}

/** 카탈로그의 routes에서 출발지·도착지에 해당하는 노선을 찾습니다. */
export function resolveRoute(origin: string, destination: string, routes: RouteOption[]): RouteOption | null {
  return routes.find((route) => route.origin === origin && route.destination === destination) ?? null
}

export type RequestBlockReason =
  | 'INCOMPLETE'
  | 'UNSUPPORTED_ROUTE'
  | 'UNSUPPORTED_VEHICLE'
  | 'UNKNOWN_WEIGHT'
  | 'WEIGHT_OVER_CAPACITY'
  | 'NO_BASE_FARE'

export type BuildResult =
  | { ok: true; request: ShipperMatchRequest }
  | { ok: false; reason: RequestBlockReason; message: string }

/** 슬라이더가 한 번에 비교할 시간창입니다. 계약상 중복 제거 후 12개까지 허용됩니다. */
export const comparisonWindowMinutes = [180, 360, 480, 720, 1080, 1440, 2160, 2880]

function toIsoWithOffset(date: string, minutes: number, shiftDays: number) {
  const loadingAt = new Date(`${date}T00:00:00`)
  loadingAt.setDate(loadingAt.getDate() + shiftDays)
  loadingAt.setMinutes(loadingAt.getMinutes() + minutes)

  const pad = (value: number) => String(value).padStart(2, '0')
  const offsetMinutes = -loadingAt.getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const absolute = Math.abs(offsetMinutes)
  const stamp = `${loadingAt.getFullYear()}-${pad(loadingAt.getMonth() + 1)}-${pad(loadingAt.getDate())}`
    + `T${pad(loadingAt.getHours())}:${pad(loadingAt.getMinutes())}:00`
  return `${stamp}${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`
}

/**
 * 등록 화면의 콜 정보와 조건 비교 화면의 레버를 매칭 API 요청으로 바꿉니다.
 * 시간창만 서버가 배열로 한 번에 평가하고, 차종·날짜·시간변경비용은 요청값 자체를 바꿉니다.
 */
export function buildShipperRequest(
  cargo: CargoForm,
  levers: LeverState,
  catalog: { routes: RouteOption[]; vehicleTypes: VehicleOption[] },
  requestId?: string,
): BuildResult {
  if (!cargo.origin || !cargo.destination || !cargo.vehicle || !cargo.item || !cargo.loadingDate || cargo.startMinutes === null || cargo.endMinutes === null) {
    return { ok: false, reason: 'INCOMPLETE', message: '콜 정보를 모두 입력해야 예측을 요청할 수 있습니다.' }
  }

  const route = resolveRoute(cargo.origin, cargo.destination, catalog.routes)
  if (!route) {
    return { ok: false, reason: 'UNSUPPORTED_ROUTE', message: `${cargo.origin} → ${cargo.destination} 노선은 참조 데이터에 없습니다.` }
  }

  const vehicle = resolveVehicle(cargo.vehicle, catalog.vehicleTypes)
  if (!vehicle) {
    return { ok: false, reason: 'UNSUPPORTED_VEHICLE', message: `${cargo.vehicle}는 예측 모델이 지원하지 않는 차종입니다.` }
  }

  const weightKg = getCargoWeightKg(cargo.cargoWeight)
  if (weightKg === null) {
    return { ok: false, reason: 'UNKNOWN_WEIGHT', message: '화물 중량을 인식하지 못했습니다.' }
  }
  if (weightKg > vehicle.tonnage * 1000) {
    return { ok: false, reason: 'WEIGHT_OVER_CAPACITY', message: `${vehicle.tonnage}톤 차량의 적재 한도를 넘는 중량입니다.` }
  }

  const baseFare = route.baseFareByTonnage[String(vehicle.tonnage)]
  if (!baseFare) {
    return { ok: false, reason: 'NO_BASE_FARE', message: '해당 노선과 톤급의 기준운임이 없습니다.' }
  }

  const windowHours = getWindowHours(cargo.startMinutes, cargo.endMinutes) ?? 3
  const loadingWindowMinutes = Math.min(2880, Math.max(30, Math.round(windowHours * 60)))
  // getLeadHours는 최소 1시간을 보장합니다. API 상한 720시간에 맞춰 자릅니다.
  const leadTimeHours = Math.min(720, getLeadHours(cargo) ?? 24)

  const cargoInput: CargoInput = {
    routeId: route.routeId,
    origin: route.origin,
    originRegion: route.originRegion,
    destination: route.destination,
    destinationRegion: route.destinationRegion,
    loadingAt: toIsoWithOffset(cargo.loadingDate, cargo.startMinutes, levers.dateShiftDays),
    loadingWindowMinutes,
    leadTimeHours: Math.round(leadTimeHours * 10) / 10,
    tonnage: vehicle.tonnage,
    bodyType: vehicle.bodyType,
    vehicleType: vehicle.vehicleType,
    allowCompatibleVehicle: levers.vehicleFlexible,
    item: cargo.item,
    weightKg: Math.round(weightKg),
    pallets: defaultPallets,
    baseFare,
    offeredFare: baseFare,
    timeChangeCostPerHour: levers.timeChangeCostPerHour,
  }

  const requestedWindow = Math.min(2880, Math.max(30, Math.round(levers.windowHours * 60)))
  const timeWindowOptionsMinutes = [...new Set([...comparisonWindowMinutes, requestedWindow, loadingWindowMinutes])]
    .sort((left, right) => left - right)
    .slice(0, 12)

  return {
    ok: true,
    request: { requestId, cargo: cargoInput, timeWindowOptionsMinutes, carrierLimit: defaultCarrierLimit },
  }
}

/** 계약의 시나리오를 화면이 쓰는 Prediction으로 바꿉니다. confidence는 화면이 백분율로 씁니다. */
export function scenarioToPrediction(scenario: Scenario): Prediction {
  return {
    candidates: scenario.candidateCount,
    fare: scenario.expectedFare.point,
    dispatchMinutes: scenario.expectedDispatchMinutes,
    windowHours: Math.round((scenario.loadingWindowMinutes / 60) * 10) / 10,
    confidence: Math.round((scenario.confidence ?? 0) * 100),
    failureProbability: scenario.failureProbability,
  }
}

/** 요청한 시간창에 가장 가까운 시나리오를 고릅니다. */
export function pickScenario(scenarios: Scenario[], windowHours: number): Scenario | null {
  if (!scenarios.length) return null
  const target = windowHours * 60
  return scenarios.reduce((closest, scenario) => (
    Math.abs(scenario.loadingWindowMinutes - target) < Math.abs(closest.loadingWindowMinutes - target) ? scenario : closest
  ))
}

export type CarrierCandidate = Candidate & { callId: string; score: number }

/** 운송인 추천 콜을 기존 운송인 화면이 쓰는 Candidate 모양으로 바꿉니다. */
export function toCarrierCandidate(recommendation: CarrierRecommendation, index: number): CarrierCandidate {
  // 운송인 화면은 금액을 만원 단위로 표시합니다. 원 단위 응답을 표시 단위로 환산합니다.
  const toManwon = (value: number) => Math.round(value / 1000) / 10
  const loadingTime = new Date(recommendation.loadingTime)
  const pad = (value: number) => String(value).padStart(2, '0')

  return {
    id: index + 1,
    callId: recommendation.callId,
    route: recommendation.route,
    time: `${pad(loadingTime.getHours())}:${pad(loadingTime.getMinutes())}`,
    emptyKm: recommendation.emptyDistanceKm,
    duration: Math.round(recommendation.durationHours),
    fare: toManwon(recommendation.fare),
    fuelCost: toManwon(recommendation.fuelCost),
    emptyCost: toManwon(recommendation.emptyCost),
    net: toManwon(recommendation.netIncome),
    tags: recommendation.tags,
    warning: recommendation.warning ?? undefined,
    score: recommendation.score,
  }
}

/** 유찰확률이 null이면 화면과 자연어 설명에서 감춥니다(계약 8절). */
export function hasFailureProbability(scenario: Scenario | null): scenario is Scenario & { failureProbability: number } {
  return scenario !== null && typeof scenario.failureProbability === 'number'
}
