export type Candidate = {
  id: number
  route: string
  time: string
  emptyKm: number
  duration: number
  fare: number
  fuelCost: number
  emptyCost: number
  net: number
  tags: string[]
  warning?: string
}

export const candidates: Candidate[] = [
  {
    id: 1,
    route: '부산 → 서울',
    time: '17:30',
    emptyKm: 12,
    duration: 8,
    fare: 47,
    fuelCost: 7.4,
    emptyCost: 1.4,
    net: 38.2,
    tags: ['내일 귀가 가능', '서울 복화 많음'],
  },
  {
    id: 2,
    route: '대구 → 인천',
    time: '19:00',
    emptyKm: 88,
    duration: 11,
    fare: 52,
    fuelCost: 9.1,
    emptyCost: 8.3,
    net: 34.6,
    tags: [],
    warning: '운임은 높지만 귀가 어려움',
  },
  {
    id: 3,
    route: '부산 → 포항',
    time: '17:00',
    emptyKm: 9,
    duration: 4,
    fare: 24,
    fuelCost: 3.2,
    emptyCost: 1,
    net: 19.8,
    tags: ['짧고 일찍 끝남'],
  },
]

export const routeReductions = [
  { route: '부산신항 → 이천', value: 126.9, width: 100 },
  { route: '부산북항 → 화성', value: 103.1, width: 81 },
  { route: '대전유성 → 김해', value: 67.9, width: 54 },
  { route: '인천항 → 김해', value: 65.9, width: 52 },
  { route: '부산신항 → 김포', value: 60.7, width: 48 },
]

export const emissionFactors = [
  { ton: '5t', loaded: '0.474', empty: '0.373' },
  { ton: '11t', loaded: '0.652', empty: '0.522' },
  { ton: '25t', loaded: '0.815', empty: '0.652' },
]

export type LatLng = { lat: number; lng: number }

export const cityCoords: Record<string, LatLng> = {
  부산: { lat: 35.1796, lng: 129.0756 },
  서울: { lat: 37.5665, lng: 126.978 },
  대구: { lat: 35.8714, lng: 128.6014 },
  인천: { lat: 37.4563, lng: 126.7052 },
  포항: { lat: 36.019, lng: 129.3435 },
  대전: { lat: 36.3504, lng: 127.3845 },
  광주: { lat: 35.1595, lng: 126.8526 },
  창원: { lat: 35.2281, lng: 128.6811 },
}

export type Order = {
  id: number
  route: string
  cargo: string
  weight: string
  loadTime: string
  price: number
  distance: number
}

export const orders: Order[] = [
  { id: 1, route: '부산 → 서울', cargo: '가전 부품', weight: '11톤', loadTime: '오늘 17:30', price: 47, distance: 420 },
  { id: 2, route: '대구 → 인천', cargo: '식품 원자재', weight: '8톤', loadTime: '오늘 19:00', price: 52, distance: 380 },
  { id: 3, route: '부산 → 포항', cargo: '철강 자재', weight: '15톤', loadTime: '오늘 17:00', price: 24, distance: 130 },
  { id: 4, route: '광주 → 대전', cargo: '생활용품', weight: '5톤', loadTime: '오늘 20:00', price: 28, distance: 170 },
  { id: 5, route: '창원 → 부산', cargo: '자동차 부품', weight: '11톤', loadTime: '오늘 16:00', price: 18, distance: 45 },
]

export type BackhaulOffer = {
  id: number
  route: string
  time: string
  distance: number
  duration: number
  emptyKm: number
  expectedEmptyKmWithoutBackhaul: number
  fare: number
  net: number
  tags: string[]
}

export const backhaulOffers: BackhaulOffer[] = [
  { id: 1, route: '서울 → 대전', time: '18:40', distance: 143, duration: 2.5, emptyKm: 6, expectedEmptyKmWithoutBackhaul: 160, fare: 31, net: 26.4, tags: ['복화 연결', '귀가 방향'] },
  { id: 2, route: '대전 → 부산', time: '21:10', distance: 285, duration: 4, emptyKm: 4, expectedEmptyKmWithoutBackhaul: 200, fare: 29, net: 24.1, tags: ['복화 연결', '오늘 귀가 가능'] },
]

// ai/generate_data.py의 make_carriers() 표집 확률(국토부 영업용 화물차 등록통계 기반)에서
// 톤급은 5톤(50%), 적재형태는 카고(33.5%), 차고지는 수도권(33%)이 각각 최빈값이다.
export const virtualCarrierProfile = {
  name: '김무빈',
  tonnage: 5,
  form: '카고',
  vehicleType: '5톤 카고',
  baseRegion: '수도권',
}
