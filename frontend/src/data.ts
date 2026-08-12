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
