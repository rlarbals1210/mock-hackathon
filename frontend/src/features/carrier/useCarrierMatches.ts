import { useCallback, useEffect, useMemo, useState } from 'react'
import { toCarrierCandidate, type CarrierCandidate } from '../../lib/adapters'
import { ApiError, fetchCarrierMatches, type CarrierMatchQuery } from '../../lib/api'
import type { CarrierRecommendation, RouteOption } from '../../lib/types'

/**
 * 데모에서 사용할 운송인입니다.
 * 매칭 API는 운송인 목록을 제공하지 않고 v13 엑셀의 실제 운송인 ID를 요구합니다.
 * D00051은 서로 다른 3개 노선이 상위 추천에 올라와 콜 비교 화면이 의미 있게 동작합니다.
 */
export const demoCarrierId = 'D00051'

const fetchLimit = 3
const candidateCount = 3

export type CarrierMatchPreferenceInput = {
  region: string
  subRegion: string
  time: string[]
  priorities: string[]
}

const loadingPeriodByLabel: Record<string, 'MORNING' | 'AFTERNOON' | 'NIGHT'> = {
  '오전 상차': 'MORNING',
  '오후 상차': 'AFTERNOON',
  '야간 상차': 'NIGHT',
}

function toMatchQuery(preferences: CarrierMatchPreferenceInput | null): CarrierMatchQuery {
  if (!preferences) return {}
  const preferredLoadingPeriod = preferences.time
    .map((value) => loadingPeriodByLabel[value])
    .filter((value): value is 'MORNING' | 'AFTERNOON' | 'NIGHT' => Boolean(value))
  return {
    preferredRegion: preferences.region,
    preferredSubRegion: preferences.subRegion,
    preferredLoadingPeriod,
    maxEmptyKm: preferences.priorities.includes('공차 30km 이내') ? 30 : undefined,
    maxDurationHours: preferences.priorities.includes('8시간 이내의 거리') ? 8 : undefined,
    prioritizeIncome: preferences.priorities.includes('많은 수익'),
    prioritizeBackhaul: preferences.priorities.includes('복화 가능성'),
  }
}

export type CarrierCall = CarrierCandidate & {
  /** 적재 구간 거리(km)입니다. 카탈로그 노선표에서 찾습니다. 못 찾으면 0입니다. */
  distanceKm: number
  /** 원 단위 그대로의 서버 응답입니다. 생성형 설명에는 이 값을 넘깁니다. */
  source?: CarrierRecommendation
  predictionSources: Record<string, string>
}

export type CarrierMatchesState = {
  status: 'loading' | 'ready' | 'error'
  /** 콜 비교 화면에 쓸 노선이 서로 다른 상위 후보입니다. */
  calls: CarrierCall[]
  /** 오더 게시판에 쓸 전체 추천 목록입니다. */
  board: CarrierCall[]
  message: string
  /** 피드백 전송에 쓸 식별자입니다. */
  matchId: string
  retry: () => void
}

/** 운송인 한 명에게 추천할 콜을 가져옵니다. */
export function useCarrierMatches(
  routes: RouteOption[] | undefined,
  preferences: CarrierMatchPreferenceInput | null,
  carrierId = demoCarrierId,
): CarrierMatchesState {
  const [status, setStatus] = useState<CarrierMatchesState['status']>('loading')
  const [raw, setRaw] = useState<CarrierCall[]>([])
  const [message, setMessage] = useState('')
  const [matchId, setMatchId] = useState(`carrier-${carrierId}`)
  const [attempt, setAttempt] = useState(0)

  const retry = useCallback(() => setAttempt((current) => current + 1), [])
  const matchQuery = useMemo(() => toMatchQuery(preferences), [preferences])

  const distanceByRoute = useMemo(() => {
    const table = new Map<string, number>()
    for (const route of routes ?? []) table.set(route.label, route.distanceKm)
    return table
  }, [routes])

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setMessage('')

    fetchCarrierMatches(carrierId, fetchLimit, matchQuery, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return
        setRaw(response.recommendations.map((recommendation, index) => ({
          ...toCarrierCandidate(recommendation, index),
          distanceKm: 0,
          source: recommendation,
          predictionSources: response.predictionSources,
        })))
        setMatchId(response.matchId)
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setMessage(error instanceof ApiError ? error.userMessage : '추천 콜을 가져오지 못했습니다.')
        setStatus('error')
      })

    return () => controller.abort()
  }, [attempt, carrierId, matchQuery])

  const board = useMemo(
    () => raw.map((call) => ({ ...call, distanceKm: distanceByRoute.get(call.route) ?? 0 })),
    [distanceByRoute, raw],
  )
  const calls = useMemo(() => board.slice(0, candidateCount), [board])

  return { status, calls, board, message, matchId, retry }
}
