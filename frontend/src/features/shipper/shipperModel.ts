export type ShipperSection = 'preferences' | 'register' | 'compare' | 'report' | 'profile'

export type PreferenceGroupId = 'result' | 'schedule' | 'carrier'
export type PreferenceState = Record<PreferenceGroupId, string[]>

export type CargoForm = {
  originRegion: string
  origin: string
  destinationRegion: string
  destination: string
  vehicle: string
  item: string
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
  failureProbability: null
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

export function cargoIsComplete(cargo: CargoForm) {
  return Boolean(
    cargo.origin
      && cargo.destination
      && cargo.vehicle
      && cargo.item
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
