// 실제 매칭 서버(backend/app)의 응답을 그대로 캡처해 만든 고정 데이터입니다.
// 기준 요청: 부산신항(영남) → 김포(수도권), R01, 11톤 카고, 철강재 9,500kg, 기준운임 454,000원.
// VITE_USE_MOCK=1일 때 네트워크 없이 화면을 개발하고 시연하기 위해 씁니다.

import type {
  CarrierBrief,
  CarrierMatchesResponse,
  CatalogFilters,
  CatalogOptionsResponse,
  FeedbackResponse,
  LocationOption,
  NumberOption,
  RouteOption,
  Scenario,
  ShipperMatchRequest,
  ShipperMatchResponse,
  TextOption,
  VehicleOption,
} from './types'

type Anchor = {
  minutes: number
  candidateCount: number
  expectedDispatchMinutes: number
  point: number
  min: number
  max: number
  failureProbability: number
}

// 서버 실측값입니다. 사이 구간은 선형 보간합니다.
const anchors: Anchor[] = [
  { minutes: 180, candidateCount: 44, expectedDispatchMinutes: 70, point: 513579, min: 454000, max: 577212, failureProbability: 0.10199407308190772 },
  { minutes: 360, candidateCount: 87, expectedDispatchMinutes: 55, point: 512910, min: 454000, max: 576038, failureProbability: 0.10199407308190772 },
  { minutes: 480, candidateCount: 111, expectedDispatchMinutes: 50, point: 512910, min: 454000, max: 573493, failureProbability: 0.09555396551106422 },
  { minutes: 720, candidateCount: 178, expectedDispatchMinutes: 42, point: 510643, min: 454000, max: 573493, failureProbability: 0.09555396551106422 },
  { minutes: 1440, candidateCount: 353, expectedDispatchMinutes: 33, point: 482714, min: 454000, max: 508891, failureProbability: 0.014465205582949699 },
  { minutes: 2880, candidateCount: 652, expectedDispatchMinutes: 27, point: 475342, min: 454000, max: 507252, failureProbability: 0.004534240324079735 },
]

// 차종 대체를 허용하면 서버 응답에서 후보가 44명에서 123명으로 늘었습니다.
const compatibleVehicleCandidateMultiplier = 123 / 44

const mockConfidence = 0.78

const mockCarriers: CarrierBrief[] = [
  { carrierId: 'D04989', score: 87, emptyDistanceKm: 8, estimatedNetIncome: 263193, preferenceMatches: ['영남 출발 적합', '수도권 도착 선호'], warning: null },
  { carrierId: 'D04712', score: 86, emptyDistanceKm: 8, estimatedNetIncome: 263193, preferenceMatches: ['영남 출발 적합', '수도권 도착 선호'], warning: null },
  { carrierId: 'D07935', score: 86, emptyDistanceKm: 8, estimatedNetIncome: 263193, preferenceMatches: ['영남 출발 적합', '수도권 도착 선호'], warning: null },
  { carrierId: 'D03629', score: 85, emptyDistanceKm: 7, estimatedNetIncome: 264243, preferenceMatches: ['영남 출발 적합', '수도권 도착 선호'], warning: null },
  { carrierId: 'D05373', score: 85, emptyDistanceKm: 9, estimatedNetIncome: 262143, preferenceMatches: ['영남 출발 적합', '수도권 도착 선호'], warning: null },
]

function interpolate(minutes: number): Anchor {
  const bounded = Math.min(2880, Math.max(30, minutes))
  const first = anchors[0]
  const last = anchors[anchors.length - 1]
  if (bounded <= first.minutes) return { ...first, minutes: bounded }
  if (bounded >= last.minutes) return { ...last, minutes: bounded }

  for (let index = 0; index < anchors.length - 1; index += 1) {
    const low = anchors[index]
    const high = anchors[index + 1]
    if (bounded < low.minutes || bounded > high.minutes) continue
    const ratio = (bounded - low.minutes) / (high.minutes - low.minutes)
    const between = (from: number, to: number) => from + (to - from) * ratio
    return {
      minutes: bounded,
      candidateCount: Math.round(between(low.candidateCount, high.candidateCount)),
      expectedDispatchMinutes: Math.round(between(low.expectedDispatchMinutes, high.expectedDispatchMinutes)),
      point: Math.round(between(low.point, high.point)),
      min: Math.round(between(low.min, high.min)),
      max: Math.round(between(low.max, high.max)),
      failureProbability: between(low.failureProbability, high.failureProbability),
    }
  }
  return { ...last, minutes: bounded }
}

function buildScenario(minutes: number, scenarioId: string, allowCompatibleVehicle: boolean): Scenario {
  const anchor = interpolate(minutes)
  const candidateCount = allowCompatibleVehicle
    ? Math.round(anchor.candidateCount * compatibleVehicleCandidateMultiplier)
    : anchor.candidateCount
  return {
    scenarioId,
    loadingWindowMinutes: minutes,
    candidateCount,
    expectedDispatchMinutes: anchor.expectedDispatchMinutes,
    expectedFare: { point: anchor.point, min: anchor.min, max: anchor.max },
    failureProbability: anchor.failureProbability,
    confidence: mockConfidence,
  }
}

function formatHours(minutes: number) {
  const hours = minutes / 60
  return Number.isInteger(hours) ? `${hours}` : hours.toFixed(1)
}

export function mockShipperMatch(request: ShipperMatchRequest): ShipperMatchResponse {
  const { cargo } = request
  const allowCompatibleVehicle = Boolean(cargo.allowCompatibleVehicle)

  // 서버와 같은 규칙으로 요청 시간창을 정규화합니다.
  const windows = [...new Set([...request.timeWindowOptionsMinutes, cargo.loadingWindowMinutes])]
    .sort((left, right) => left - right)
    .slice(0, 12)

  const current = buildScenario(cargo.loadingWindowMinutes, 'CURRENT', allowCompatibleVehicle)
  const timeWindowScenarios = windows.map((minutes) => buildScenario(minutes, `WINDOW_${minutes}`, allowCompatibleVehicle))

  // 서버는 후보 증가 대비 운임 상승이 가장 작은 시간창을 추천합니다.
  const better = timeWindowScenarios.filter((scenario) => scenario.candidateCount > current.candidateCount)
  const best = better.length ? better[Math.min(better.length - 1, Math.floor(better.length / 2))] : null

  const recommendations = best
    ? [{
        type: 'TIME_WINDOW' as const,
        description: `상차 가능 시간을 ${formatHours(current.loadingWindowMinutes)}시간에서 ${formatHours(best.loadingWindowMinutes)}시간으로 확대`,
        shipperAcceptanceProbability: 0.0475159785241787,
        scenarioId: best.scenarioId,
        candidateIncrease: best.candidateCount - current.candidateCount,
        dispatchMinutesChange: best.expectedDispatchMinutes - current.expectedDispatchMinutes,
        fareChange: best.expectedFare.point - current.expectedFare.point,
      }]
    : []

  const explanationFacts = best
    ? [
        `상차 가능 시간을 ${formatHours(current.loadingWindowMinutes)}시간에서 ${formatHours(best.loadingWindowMinutes)}시간으로 넓히면 후보 운송인이 ${current.candidateCount}명에서 ${best.candidateCount}명으로 증가합니다.`,
        `같은 비교에서 예상 배차시간은 ${current.expectedDispatchMinutes}분에서 ${best.expectedDispatchMinutes}분으로 바뀝니다.`,
        `예상 운임은 ${current.expectedFare.point}원에서 ${best.expectedFare.point}원으로 바뀌는 방향입니다.`,
      ]
    : ['현재 조건보다 후보가 늘어나는 시간창이 없습니다.']

  const generatedAt = new Date().toISOString()

  return {
    requestId: request.requestId ?? 'mock-request',
    matchId: 'M-20260812-000001',
    generatedAt,
    cargo: {
      callId: cargo.callId ?? null,
      route: `${cargo.origin} → ${cargo.destination}`,
      loadingAt: cargo.loadingAt,
      tonnage: cargo.tonnage,
      bodyType: cargo.bodyType,
      item: cargo.item,
      cargoNote: cargo.cargoNote ?? null,
      weightKg: cargo.weightKg,
    },
    current,
    timeWindowScenarios,
    recommendations,
    carriers: mockCarriers.slice(0, request.carrierLimit ?? 5),
    explanationFacts,
    predictionSources: {
      candidateCount: 'supply_pool_v13',
      expectedDispatchMinutes: 'dispatch_curve_v13',
      expectedFare: 'hist_gradient_boosting_v13',
      failureProbability: 'hist_gradient_boosting_v13',
      shipperAcceptanceProbability: 'hist_gradient_boosting_v13',
      carrierScore: 'rule_based_v1',
    },
    warnings: [],
  }
}

const mockCarrierCalls = [
  { callId: 'C2890', route: '대전유성 → 이천', loadingTime: '2026-08-14T17:00:00+09:00', emptyDistanceKm: 11, durationHours: 3.3, fare: 234000, fuelCost: 77731, emptyCost: 11550, netIncome: 144719, tags: ['선호 권역 일치'], warning: null, score: 88 },
  { callId: 'C6197', route: '부산신항 → 김포', loadingTime: '2026-08-14T19:00:00+09:00', emptyDistanceKm: 26, durationHours: 6.5, fare: 454000, fuelCost: 168000, emptyCost: 27300, netIncome: 258700, tags: ['복화 연결 가능'], warning: null, score: 84 },
  { callId: 'C6247', route: '의왕ICD → 안산', loadingTime: '2026-08-14T12:00:00+09:00', emptyDistanceKm: 9, durationHours: 1.7, fare: 96000, fuelCost: 23900, emptyCost: 9450, netIncome: 62650, tags: ['짧고 일찍 끝남'], warning: '운임은 낮지만 귀가 방향', score: 79 },
]

export function mockCarrierMatches(carrierId: string, limit: number): CarrierMatchesResponse {
  return {
    matchId: `M-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-MOCK01`,
    carrierId,
    generatedAt: new Date().toISOString(),
    recommendations: mockCarrierCalls.slice(0, limit),
    predictionSources: {
      score: 'rule_based_v1',
      emptyDistanceKm: 'carrier_history_estimate_v1',
      costs: 'deterministic_cost_v1',
    },
    warnings: [],
  }
}

// GET /api/v1/catalog/options의 오프라인 사본입니다.
// 값은 v13 엑셀의 참조_노선·참조_기준운임 시트에서 그대로 가져왔습니다.
// 실제 모드에서는 서버 응답을 쓰므로 이 표는 mock 전용입니다.
const mockRoutes: RouteOption[] = [
  { routeId: 'R01', label: '부산신항 → 김포', origin: '부산신항', originRegion: '영남', destination: '김포', destinationRegion: '수도권', distanceKm: 400, standardHours: 6.5, toll: 32800, baseFareByTonnage: { '5': 368000, '11': 454000, '25': 596000 }, callCount: 838 },
  { routeId: 'R02', label: '부산북항 → 화성', origin: '부산북항', originRegion: '영남', destination: '화성', destinationRegion: '수도권', distanceKm: 390, standardHours: 6.4, toll: 32000, baseFareByTonnage: { '5': 354000, '11': 438000, '25': 578000 }, callCount: 831 },
  { routeId: 'R03', label: '광양항 → 군산', origin: '광양항', originRegion: '호남', destination: '군산', destinationRegion: '호남', distanceKm: 170, standardHours: 3.5, toll: 13900, baseFareByTonnage: { '5': 184000, '11': 230000, '25': 303000 }, callCount: 1005 },
  { routeId: 'R04', label: '창원공단 → 평택', origin: '창원공단', originRegion: '영남', destination: '평택', destinationRegion: '수도권', distanceKm: 300, standardHours: 5.2, toll: 24600, baseFareByTonnage: { '5': 326000, '11': 406000, '25': 520000 }, callCount: 1003 },
  { routeId: 'R05', label: '인천남동 → 달성', origin: '인천남동', originRegion: '수도권', destination: '달성', destinationRegion: '영남', distanceKm: 290, standardHours: 5.1, toll: 23800, baseFareByTonnage: { '5': 330000, '11': 415000, '25': 536000 }, callCount: 1006 },
  { routeId: 'R06', label: '안성물류 → 천안', origin: '안성물류', originRegion: '수도권', destination: '천안', destinationRegion: '충청', distanceKm: 60, standardHours: 2, toll: 4900, baseFareByTonnage: { '5': 126000, '11': 172000, '25': 234000 }, callCount: 1002 },
  { routeId: 'R07', label: '대전유성 → 이천', origin: '대전유성', originRegion: '충청', destination: '이천', destinationRegion: '수도권', distanceKm: 130, standardHours: 2.9, toll: 10700, baseFareByTonnage: { '5': 182000, '11': 234000, '25': 321000 }, callCount: 1004 },
  { routeId: 'R08', label: '의왕ICD → 안산', origin: '의왕ICD', originRegion: '수도권', destination: '안산', destinationRegion: '수도권', distanceKm: 40, standardHours: 1.7, toll: 3300, baseFareByTonnage: { '5': 114000, '11': 159000, '25': 216000 }, callCount: 1001 },
  { routeId: 'R09', label: '평택항 → 청주', origin: '평택항', originRegion: '수도권', destination: '청주', destinationRegion: '충청', distanceKm: 110, standardHours: 2.7, toll: 9000, baseFareByTonnage: { '5': 162000, '11': 212000, '25': 293000 }, callCount: 1003 },
  { routeId: 'R10', label: '인천항 → 김해', origin: '인천항', originRegion: '수도권', destination: '김해', destinationRegion: '영남', distanceKm: 350, standardHours: 5.9, toll: 28700, baseFareByTonnage: { '5': 384000, '11': 470000, '25': 619000 }, callCount: 1002 },
  { routeId: 'R11', label: '부산신항 → 이천', origin: '부산신항', originRegion: '영남', destination: '이천', destinationRegion: '수도권', distanceKm: 370, standardHours: 6.1, toll: 30300, baseFareByTonnage: { '5': 354000, '11': 438000, '25': 578000 }, callCount: 1002 },
  { routeId: 'R12', label: '대전유성 → 김해', origin: '대전유성', originRegion: '충청', destination: '김해', destinationRegion: '영남', distanceKm: 200, standardHours: 3.9, toll: 16400, baseFareByTonnage: { '5': 281000, '11': 350000, '25': 439000 }, callCount: 1303 },
]

const mockItems = ['기계류', '냉동수산', '냉동식품', '생활용품', '섬유원단', '식품가공', '자동차부품', '전자부품', '제과류', '철강재', '화학원료']
const mockBodyTypes = ['냉동', '냉장', '윙바디', '카고', '탑차']
const mockTonnages = [5, 11, 25]
const mockLoadingWindows = [30, 60, 120, 180, 360, 480, 720, 1440, 2880]

function matchesFilters(route: RouteOption, filters: CatalogFilters) {
  if (filters.routeId && route.routeId !== filters.routeId) return false
  if (filters.origin && route.origin !== filters.origin) return false
  if (filters.destination && route.destination !== filters.destination) return false
  if (filters.originRegion && route.originRegion !== filters.originRegion) return false
  if (filters.destinationRegion && route.destinationRegion !== filters.destinationRegion) return false
  return true
}

export function mockCatalogOptions(filters: CatalogFilters = {}): CatalogOptionsResponse {
  const routes = mockRoutes.filter((route) => matchesFilters(route, filters))
  const matchedCallCount = routes.reduce((total, route) => total + route.callCount, 0)

  const unique = <T, K extends string | number>(items: T[], key: (item: T) => K) => {
    const seen = new Map<K, T>()
    for (const item of items) if (!seen.has(key(item))) seen.set(key(item), item)
    return [...seen.values()]
  }

  const origins: LocationOption[] = unique(
    routes.map((route) => ({ value: route.origin, label: route.origin, region: route.originRegion, callCount: route.callCount })),
    (option) => option.value,
  )
  const destinations: LocationOption[] = unique(
    routes.map((route) => ({ value: route.destination, label: route.destination, region: route.destinationRegion, callCount: route.callCount })),
    (option) => option.value,
  )
  const originRegions: TextOption[] = unique(origins.map((option) => ({ value: option.region, label: option.region, callCount: option.callCount })), (option) => option.value)
  const destinationRegions: TextOption[] = unique(destinations.map((option) => ({ value: option.region, label: option.region, callCount: option.callCount })), (option) => option.value)

  const tonnages: NumberOption[] = mockTonnages.map((value) => ({ value, label: `${value}톤`, callCount: matchedCallCount }))
  const bodyTypes: TextOption[] = mockBodyTypes.map((value) => ({ value, label: value, callCount: matchedCallCount }))
  const vehicleTypes: VehicleOption[] = mockTonnages.flatMap((tonnage) => mockBodyTypes.map((bodyType) => ({
    value: `${tonnage}t${bodyType}`,
    label: `${tonnage}t${bodyType}`,
    tonnage,
    bodyType,
    callCount: matchedCallCount,
  })))
  const items: TextOption[] = mockItems.map((value) => ({ value, label: value, callCount: matchedCallCount }))
  const methods = (values: string[]): TextOption[] => values.map((value) => ({ value, label: value, callCount: matchedCallCount }))

  const firstRoute = routes[0] ?? mockRoutes[0]

  return {
    source: 'mock-v13',
    generatedAt: new Date().toISOString(),
    totalCallCount: 12000,
    matchedCallCount,
    selectionValid: routes.length > 0,
    appliedFilters: filters,
    originRegions,
    origins,
    destinationRegions,
    destinations,
    tonnages,
    bodyTypes,
    vehicleTypes,
    items,
    loadingMethods: methods(['지게차', '수작업', '호이스트']),
    unloadingMethods: methods(['지게차', '수작업', '호이스트']),
    paymentMethods: methods(['인수증후불', '선불', '착불']),
    loadingWindowMinutes: mockLoadingWindows.map((value) => ({ value, label: `${value / 60}시간`, callCount: matchedCallCount })),
    routes,
    sampleCargo: {
      callId: 'C0042',
      shipperId: 'S018',
      routeId: firstRoute.routeId,
      origin: firstRoute.origin,
      originRegion: firstRoute.originRegion,
      destination: firstRoute.destination,
      destinationRegion: firstRoute.destinationRegion,
      loadingAt: '2026-08-13T17:30:00+09:00',
      loadingWindowMinutes: 180,
      leadTimeHours: 26,
      tonnage: 11,
      bodyType: '카고',
      vehicleType: '11t카고',
      allowCompatibleVehicle: false,
      item: '철강재',
      weightKg: 9500,
      pallets: 10,
      baseFare: firstRoute.baseFareByTonnage['11'],
      offeredFare: firstRoute.baseFareByTonnage['11'],
    },
    warnings: [],
  }
}

let mockFeedbackSequence = 0

export function mockFeedbackResponse(): FeedbackResponse {
  mockFeedbackSequence += 1
  return {
    feedbackId: `F-20260812-${String(mockFeedbackSequence).padStart(6, '0')}`,
    status: 'recorded',
    recordedAt: new Date().toISOString(),
  }
}
