export type ShipperSection = 'preferences' | 'register' | 'compare' | 'report' | 'profile' | 'information'

export type PreferenceGroupId = 'result' | 'schedule' | 'carrier'
export type PreferenceState = Record<PreferenceGroupId, string[]>

export type CargoForm = {
  originRegion: string
  origin: string
  destinationRegion: string
  destination: string
  vehicle: string
  item: string
  cargoDescription: string
  cargoWeight: string
  loadingDate: string
  startMinutes: number | null
  endMinutes: number | null
}

export type DecisionChoice = 'current' | 'adjusted' | null

export type OperationLog = {
  id: string
  title: string
  detail: string
  time: string
}

export type Prediction = {
  candidates: number
  fare: number
  dispatchMinutes: number
  windowHours: number
  confidence: number
  failureProbability: number | null
}

export type LeverState = {
  windowHours: number
  vehicleFlexible: boolean
  dateShiftDays: number
  timeChangeCostPerHour: number
}

export const preferenceGroups: {
  id: PreferenceGroupId
  title: string
  shortTitle: string
  options: { label: string; detail?: string }[]
}[] = [
  {
    id: 'result',
    title: '배차 결과에서 중요해요',
    shortTitle: '배차 결과',
    options: [{ label: '빠른 배차' }, { label: '낮은 운임' }, { label: '많은 후보' }],
  },
  {
    id: 'schedule',
    title: '가능한 상차 일정이에요',
    shortTitle: '상차 일정',
    options: [
      { label: '오전 상차', detail: '06:00~12:00' },
      { label: '오후 상차', detail: '12:00~18:00' },
      { label: '야간 상차', detail: '18:00~06:00' },
      { label: '일정 조정 가능' },
    ],
  },
  {
    id: 'carrier',
    title: '운송인 선택에서 중요해요',
    shortTitle: '운송인 선택',
    options: [{ label: '안전 기록' }, { label: '정시성' }, { label: '품목 경험' }],
  },
]

export const emptyPreferences: PreferenceState = {
  result: [],
  schedule: [],
  carrier: [],
}

export const emptyCargo: CargoForm = {
  originRegion: '',
  origin: '',
  destinationRegion: '',
  destination: '',
  vehicle: '',
  item: '',
  cargoDescription: '',
  cargoWeight: '',
  loadingDate: '',
  startMinutes: null,
  endMinutes: null,
}

export const regionLocations: Record<string, string[]> = {
  수도권: ['안산', '인천항', '화성', '평택', '김포', '의왕 ICD'],
  영남: ['부산신항', '부산북항', '대구 달성', '울산', '창원 공단', '김해'],
  충청: ['대전 유성', '청주', '천안', '아산', '서산'],
  호남: ['광양항', '군산', '광주', '목포', '전주'],
  강원: ['원주', '강릉', '춘천'],
  제주: ['제주항', '서귀포'],
}

export const regionOptions = [...Object.keys(regionLocations), '기타']

export const vehicleOptions = [
  '1톤 카고',
  '2.5톤 카고',
  '5톤 카고',
  '5톤 윙바디',
  '11톤 윙바디',
  '25톤 카고',
  '냉동·냉장탑차',
  '트레일러',
  '기타',
]

export const itemOptions = [
  '냉동식품',
  '냉장식품',
  '생활용품',
  '전자부품',
  '자동차부품',
  '산업자재',
  '건축자재',
  '농산물',
  '의약품',
  '파렛트 화물',
  '기타',
]

export const sourceRouteCarbon: Record<string, number> = {
  '부산신항→이천': 126.9,
  '부산북항→화성': 103.1,
  '대전 유성→김해': 67.9,
  '인천항→김해': 65.9,
  '부산신항→김포': 60.7,
}

const vehicleCarbon: Record<string, number> = {
  '5톤 카고': 42.1,
  '5톤 윙바디': 42.1,
  '11톤 윙바디': 55.4,
  '25톤 카고': 68.7,
}

export function preferencesAreComplete(preferences: PreferenceState) {
  return Object.values(preferences).every((items) => items.length > 0)
}

export function getCargoWeightKg(description: string) {
  const normalized = description.trim().toLowerCase().replaceAll(',', '')
  const kilogramMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:kg|킬로그램)/)
  if (kilogramMatch) {
    const weightKg = Math.round(Number(kilogramMatch[1]) * 10) / 10
    return weightKg > 0 ? weightKg : null
  }

  const tonMatch = normalized.match(/(\d+(?:\.\d+)?)\s*톤/) ?? normalized.match(/(\d+(?:\.\d+)?)\s*(?:tons?|t)(?:\s|$|[,.()])/)
  if (tonMatch) {
    const weightKg = Math.round(Number(tonMatch[1]) * 10000) / 10
    return weightKg > 0 ? weightKg : null
  }
  return null
}

export function formatCargoWeight(weightKg: number | null) {
  if (weightKg === null) return '중량 미인식'
  if (weightKg >= 1000) return `${(weightKg / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 2 })}톤 (${weightKg.toLocaleString('ko-KR')}kg)`
  return `${weightKg.toLocaleString('ko-KR')}kg`
}

export function cargoIsComplete(cargo: CargoForm) {
  return Boolean(
    cargo.origin
      && cargo.destination
      && cargo.vehicle
      && cargo.item
      && cargo.cargoDescription.trim()
      && getCargoWeightKg(cargo.cargoWeight) !== null
      && cargo.loadingDate
      && cargo.startMinutes !== null
      && cargo.endMinutes !== null,
  )
}

export function formatMinutes(minutes: number | null) {
  if (minutes === null) return '미선택'
  const normalized = (minutes + 1440) % 1440
  const hour = Math.floor(normalized / 60)
  const minute = normalized % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function getWindowHours(start: number | null, end: number | null) {
  if (start === null || end === null) return null
  const difference = (end - start + 1440) % 1440
  return difference === 0 ? 24 : difference / 60
}

export function formatTimeWindow(cargo: CargoForm) {
  if (cargo.startMinutes === null || cargo.endMinutes === null) return '미선택'
  return `${formatMinutes(cargo.startMinutes)}~${formatMinutes(cargo.endMinutes)}`
}

export function interpolatePrediction(windowHours: number): Prediction {
  const boundedHours = Math.min(48, Math.max(3, windowHours))
  const ratio = (boundedHours - 3) / 45
  return {
    candidates: Math.round(111 + (1766 - 111) * ratio),
    fare: Math.round((420000 + (380000 - 420000) * ratio) / 1000) * 1000,
    dispatchMinutes: Math.round(40 + (15 - 40) * ratio),
    windowHours: boundedHours,
    confidence: 78,
    failureProbability: null,
  }
}

// 레버 계수는 가상데이터 12,000건(v13) 실측값입니다.
// 차종: 단일 대비 대체허용의 후보 3.1~3.5배·배차 0.70배가 시간창 구간과 무관하게 유지되어 상수로 씁니다.
// 날짜: 생성기와 동일하게 후보·배차는 그대로 두고 운임과 유찰 위험만 움직입니다.
export const vehicleFlexCandidateMultiplier = 3.3
export const vehicleFlexDispatchMultiplier = 0.7
export const vehicleFlexFareMultiplier = 0.97
export const dateShiftFareMultiplier = 0.97
export const dateShiftHours = 24
export const maxDateShiftDays = 2

// 시간변경비용 선택지는 원자료의 5개 구간(0/5천/8천/1.2만/2만원)을 그대로 씁니다.
export const timeChangeCostOptions = [0, 5000, 8000, 12000, 20000]

// 일반 콜 10,334건의 리드타임 구간별 실측 유찰률 (구간 중앙 리드타임 → 유찰률).
// 긴급 콜은 리드타임이 짧으면서 유찰 계수가 반대 방향이라 곡선이 꺾이므로 제외했습니다.
const failureRiskAnchors: [number, number][] = [
  [16.6, 0.176],
  [21, 0.131],
  [26.3, 0.08],
  [32.4, 0.033],
  [39.7, 0.024],
  [44.8, 0.017],
  [50.8, 0.012],
  [66.9, 0.01],
]

// 시간창 1일 이상 구간의 유찰률이 0.087→0.015로 떨어지는 실측치를 log 기울기로 환산한 값입니다.
const failureWindowExponent = -0.824

export const emptyLevers: LeverState = {
  windowHours: 12,
  vehicleFlexible: false,
  dateShiftDays: 0,
  timeChangeCostPerHour: 8000,
}

export function getLeadHours(cargo: CargoForm, now = new Date()) {
  if (!cargo.loadingDate || cargo.startMinutes === null) return null
  const loadingAt = new Date(`${cargo.loadingDate}T00:00:00`)
  loadingAt.setMinutes(loadingAt.getMinutes() + cargo.startMinutes)
  const hours = (loadingAt.getTime() - now.getTime()) / 3_600_000
  return Math.max(1, hours)
}

export function getFailureRisk(leadHours: number, windowHours: number) {
  const first = failureRiskAnchors[0]
  const last = failureRiskAnchors[failureRiskAnchors.length - 1]
  let base = leadHours <= first[0] ? first[1] : last[1]
  for (let index = 0; index < failureRiskAnchors.length - 1; index += 1) {
    const [leftHours, leftRisk] = failureRiskAnchors[index]
    const [rightHours, rightRisk] = failureRiskAnchors[index + 1]
    if (leadHours > leftHours && leadHours <= rightHours) {
      const ratio = (leadHours - leftHours) / (rightHours - leftHours)
      base = leftRisk + (rightRisk - leftRisk) * ratio
      break
    }
  }
  const windowFactor = Math.min(1, (Math.max(3, windowHours) / 3) ** failureWindowExponent)
  // 원자료에서 관측된 최저 구간 유찰률이 1.0%라 그보다 낮은 값은 표시하지 않습니다.
  return Math.min(0.25, Math.max(0.008, base * windowFactor))
}

export function predictWithLevers(leadHours: number, levers: LeverState): Prediction {
  const base = interpolatePrediction(levers.windowHours)
  const shiftedLead = leadHours + levers.dateShiftDays * dateShiftHours
  const fareMultiplier = (levers.vehicleFlexible ? vehicleFlexFareMultiplier : 1)
    * dateShiftFareMultiplier ** levers.dateShiftDays
  return {
    ...base,
    candidates: Math.round(base.candidates * (levers.vehicleFlexible ? vehicleFlexCandidateMultiplier : 1)),
    fare: Math.round((base.fare * fareMultiplier) / 1000) * 1000,
    dispatchMinutes: Math.max(1, Math.round(base.dispatchMinutes * (levers.vehicleFlexible ? vehicleFlexDispatchMultiplier : 1))),
    failureProbability: getFailureRisk(shiftedLead, levers.windowHours),
  }
}

export function getDateShiftCost(levers: LeverState) {
  return levers.timeChangeCostPerHour * dateShiftHours * levers.dateShiftDays
}

export function formatRisk(value: number | null) {
  return value === null ? '미산출' : `${(value * 100).toFixed(1)}%`
}

export function describeLevers(levers: LeverState, currentHours: number) {
  const applied: string[] = []
  if (levers.windowHours > currentHours) applied.push(`상차 시간창 ${levers.windowHours}시간`)
  if (levers.vehicleFlexible) applied.push('차종 대체 허용')
  if (levers.dateShiftDays > 0) applied.push(`상차일 ${levers.dateShiftDays}일 연기`)
  return applied
}

export function shiftLoadingDate(loadingDate: string, days: number) {
  if (!loadingDate || days <= 0) return loadingDate
  const date = new Date(`${loadingDate}T00:00:00`)
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function getCarbonReference(cargo: CargoForm) {
  const routeKey = `${cargo.origin}→${cargo.destination}`
  const routeValue = sourceRouteCarbon[routeKey]
  if (routeValue) {
    return { value: routeValue, basis: '탄소 보고서 노선별 방식 B', scope: '원본 노선 표본' }
  }
  const vehicleValue = vehicleCarbon[cargo.vehicle]
  if (vehicleValue) {
    return { value: vehicleValue, basis: '탄소 보고서 톤급별 방식 B', scope: '톤급 참조값' }
  }
  return { value: 56.1, basis: '탄소 보고서 전체 건당 평균 방식 B', scope: '전체 표본 참고' }
}

export function formatDate(date: string) {
  return date ? date.replaceAll('-', '.') : '미선택'
}

export function formatCurrency(value: number) {
  return `${value.toLocaleString('ko-KR')}원`
}

export function createOperation(title: string, detail: string): OperationLog {
  const now = new Date()
  return {
    id: `${now.getTime()}-${title}`,
    title,
    detail,
    time: new Intl.DateTimeFormat('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now),
  }
}
