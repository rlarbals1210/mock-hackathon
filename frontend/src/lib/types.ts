// docs/api-contract.md v1의 응답 스키마를 그대로 옮긴 타입입니다.
// 필드 추가·삭제·단위 변경은 계약서 변경과 함께만 이루어집니다.

export type BodyType = '냉동' | '냉장' | '윙바디' | '카고' | '탑차'
export type Tonnage = 5 | 11 | 25
export type RegistrationActor = '원화주직접' | '주선사대리'
export type HandlingMethod = '지게차' | '수작업' | '호이스트'
export type PaymentMethod = '인수증후불' | '선불' | '착불'

export type RecommendationType = 'TIME_WINDOW' | 'VEHICLE' | 'DATE' | 'PRICE' | 'AUTHORITY' | 'SPLIT'

export type CargoInput = {
  callId?: string
  shipperId?: string
  routeId: string
  origin: string
  originRegion: string
  destination: string
  destinationRegion: string
  /** ISO 8601, 타임존 포함 */
  loadingAt: string
  /** 30~2880 */
  loadingWindowMinutes: number
  /** 0 초과 720 이하 */
  leadTimeHours: number
  tonnage: Tonnage
  bodyType: BodyType
  vehicleType?: string
  allowCompatibleVehicle?: boolean
  item: string
  /** 0 초과, tonnage * 1000 이하 */
  weightKg: number
  /** 1~100 */
  pallets: number
  baseFare: number
  offeredFare: number
  registrationActor?: RegistrationActor
  adjustmentPermissionApproved?: boolean
  splitAllowed?: boolean
  concurrentLoadAllowed?: boolean
  waypointAllowed?: boolean
  orderChangeAllowed?: boolean
  loadingMethod?: HandlingMethod
  unloadingMethod?: HandlingMethod
  paymentMethod?: PaymentMethod
  timeChangeCostPerHour?: number
}

export type ShipperMatchRequest = {
  requestId?: string
  cargo: CargoInput
  /** 중복 제거 후 최대 12개. 서버가 cargo.loadingWindowMinutes를 합쳐 정렬합니다. */
  timeWindowOptionsMinutes: number[]
  carrierLimit?: number
}

export type FareRange = {
  point: number
  min: number
  max: number
}

export type Scenario = {
  scenarioId: string
  loadingWindowMinutes: number
  candidateCount: number
  expectedDispatchMinutes: number
  expectedFare: FareRange
  /** 학습 모델을 쓸 수 없으면 null. null이면 화면과 자연어 설명에서 감춥니다. */
  failureProbability: number | null
  confidence: number | null
}

export type Recommendation = {
  type: RecommendationType
  description: string
  shipperAcceptanceProbability: number | null
  scenarioId: string
  candidateIncrease: number
  dispatchMinutesChange: number
  fareChange: number
}

export type CarrierBrief = {
  carrierId: string
  score: number
  emptyDistanceKm: number
  estimatedNetIncome: number
  preferenceMatches: string[]
  warning: string | null
}

export type CargoSummary = {
  callId: string | null
  route: string
  loadingAt: string
  tonnage: number
  bodyType: string
  item: string
  weightKg: number
}

export type ShipperMatchResponse = {
  requestId: string
  matchId: string
  generatedAt: string
  cargo: CargoSummary
  current: Scenario
  timeWindowScenarios: Scenario[]
  recommendations: Recommendation[]
  carriers: CarrierBrief[]
  explanationFacts: string[]
  predictionSources: Record<string, string>
  warnings: string[]
}

export type CarrierRecommendation = {
  callId: string
  route: string
  loadingTime: string
  emptyDistanceKm: number
  durationHours: number
  fare: number
  fuelCost: number
  emptyCost: number
  netIncome: number
  tags: string[]
  warning: string | null
  score: number
}

export type CarrierMatchesResponse = {
  carrierId: string
  generatedAt: string
  recommendations: CarrierRecommendation[]
  predictionSources: Record<string, string>
  warnings: string[]
}

export type FeedbackActorType = 'SHIPPER' | 'CARRIER'
export type FeedbackAction = 'VIEW' | 'ACCEPT' | 'REJECT' | 'IGNORE'

export type FeedbackRequest = {
  matchId: string
  actorType: FeedbackActorType
  actorId: string
  action: FeedbackAction
  callId?: string | null
  scenarioId?: string | null
  recommendationType?: string | null
  reasonCode?: string | null
  /** 필수입니다. 서버는 기본값을 채우지 않습니다. */
  occurredAt: string
}

export type FeedbackResponse = {
  feedbackId: string
  status: 'recorded' | 'duplicate'
  recordedAt: string
}

export type CatalogFilters = {
  routeId?: string | null
  originRegion?: string | null
  origin?: string | null
  destinationRegion?: string | null
  destination?: string | null
  tonnage?: number | null
  bodyType?: string | null
  vehicleType?: string | null
  item?: string | null
  loadingMethod?: string | null
  unloadingMethod?: string | null
  paymentMethod?: string | null
}

export type TextOption = {
  value: string
  label: string
  callCount: number
}

export type NumberOption = {
  value: number
  label: string
  callCount: number
}

export type LocationOption = TextOption & { region: string }

export type VehicleOption = TextOption & { tonnage: number; bodyType: string }

export type RouteOption = {
  routeId: string
  label: string
  origin: string
  originRegion: string
  destination: string
  destinationRegion: string
  distanceKm: number
  standardHours: number
  toll: number
  /** 톤급을 문자열 키로 갖는 기준운임(원)입니다. 예: { "5": 368000, "11": 454000 } */
  baseFareByTonnage: Record<string, number>
  callCount: number
}

export type CatalogOptionsResponse = {
  source: string
  generatedAt: string
  totalCallCount: number
  matchedCallCount: number
  /** false면 현재 선택 조합에 해당하는 콜이 없습니다. 바뀐 필드 아래 선택을 지웁니다. */
  selectionValid: boolean
  appliedFilters: CatalogFilters
  originRegions: TextOption[]
  origins: LocationOption[]
  destinationRegions: TextOption[]
  destinations: LocationOption[]
  tonnages: NumberOption[]
  bodyTypes: TextOption[]
  vehicleTypes: VehicleOption[]
  items: TextOption[]
  loadingMethods: TextOption[]
  unloadingMethods: TextOption[]
  paymentMethods: TextOption[]
  loadingWindowMinutes: NumberOption[]
  routes: RouteOption[]
  sampleCargo: CargoInput | null
  warnings: string[]
}

/**
 * 생성형 AI에 넘기는 입력입니다. docs/frontend-integration-handoff.md 6절의 match-insight-v1 계약입니다.
 * 모든 값은 매칭 API 응답에서 수정 없이 복사하며, 프론트가 새로 계산한 숫자는 differences만 허용합니다.
 */
export type InsightSchemaVersion = 'match-insight-v1'

export type ShipperInsightFacts = {
  requestId: string
  matchId: string
  cargo: CargoSummary
  current: Scenario
  selectedScenario: Scenario
  recommendation: Recommendation | null
  explanationFacts: string[]
  predictionSources: Record<string, string>
  warnings: string[]
}

export type CarrierInsightDifferences = {
  fare: number
  fuelCost: number
  emptyCost: number
  netIncome: number
  durationHours: number
  emptyDistanceKm: number
}

export type CarrierInsightFacts = {
  carrierId: string
  baseline: CarrierRecommendation
  selected: CarrierRecommendation
  differences: CarrierInsightDifferences
  predictionSources: Record<string, string>
  warnings: string[]
}

export type InsightRequest =
  | { schemaVersion: InsightSchemaVersion; audience: 'SHIPPER'; intent: 'MATCH_SUMMARY'; facts: ShipperInsightFacts }
  | { schemaVersion: InsightSchemaVersion; audience: 'CARRIER'; intent: 'CANDIDATE_COMPARISON'; facts: CarrierInsightFacts }

export type InsightResponse = {
  text: string
  model: string
  /** 생성 문장에 입력에 없는 숫자가 있어 서버가 문장을 버렸을 때 true입니다. */
  rejected?: boolean
}

export type ApiErrorDetail = {
  field: string
  reason: string
}

export type ApiErrorBody = {
  code: string
  message: string
  requestId: string | null
  details: ApiErrorDetail[]
}

export type ApiErrorResponse = {
  error: ApiErrorBody
}
