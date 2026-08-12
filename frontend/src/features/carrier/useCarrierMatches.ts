import { useCallback, useEffect, useMemo, useState } from 'react'
import { toCarrierCandidate, type CarrierCandidate } from '../../lib/adapters'
import { ApiError, fetchCarrierMatches } from '../../lib/api'
import type { CarrierRecommendation, RouteOption } from '../../lib/types'

/**
 * 데모에서 사용할 운송인입니다.
 * 매칭 API는 운송인 목록을 제공하지 않고 v13 엑셀의 실제 운송인 ID를 요구합니다.
 * D00051은 서로 다른 3개 노선이 상위 추천에 올라와 콜 비교 화면이 의미 있게 동작합니다.
 */
export const demoCarrierId = 'D00051'

// 추천은 점수 내림차순이라 같은 노선의 다른 날짜 콜이 연달아 나옵니다.
// 노선이 다른 후보를 3건 확보하려고 넉넉히 받은 뒤 노선별로 최고 점수만 남깁니다.
const fetchLimit = 20
const candidateCount = 3

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

function dedupeByRoute(calls: CarrierCall[]) {
  const best = new Map<string, CarrierCall>()
  for (const call of calls) {
    const current = best.get(call.route)
    if (!current || call.score > current.score) best.set(call.route, call)
  }
  return [...best.values()].sort((left, right) => right.score - left.score)
}

/** 운송인 한 명에게 추천할 콜을 가져옵니다. */
export function useCarrierMatches(routes: RouteOption[] | undefined, carrierId = demoCarrierId): CarrierMatchesState {
  const [status, setStatus] = useState<CarrierMatchesState['status']>('loading')
  const [raw, setRaw] = useState<CarrierCall[]>([])
  const [message, setMessage] = useState('')
  const [matchId, setMatchId] = useState(`carrier-${carrierId}`)
  const [attempt, setAttempt] = useState(0)

  const retry = useCallback(() => setAttempt((current) => current + 1), [])

  const distanceByRoute = useMemo(() => {
    const table = new Map<string, number>()
    for (const route of routes ?? []) table.set(route.label, route.distanceKm)
    return table
  }, [routes])

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setMessage('')

    fetchCarrierMatches(carrierId, fetchLimit, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return
        setRaw(response.recommendations.map((recommendation, index) => ({
          ...toCarrierCandidate(recommendation, index),
          distanceKm: 0,
          source: recommendation,
          predictionSources: response.predictionSources,
        })))
        setMatchId(`carrier-${response.carrierId}-${response.generatedAt}`)
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setMessage(error instanceof ApiError ? error.userMessage : '추천 콜을 가져오지 못했습니다.')
        setStatus('error')
      })

    return () => controller.abort()
  }, [attempt, carrierId])

  const board = useMemo(
    () => raw.map((call) => ({ ...call, distanceKm: distanceByRoute.get(call.route) ?? 0 })),
    [distanceByRoute, raw],
  )
  const calls = useMemo(() => dedupeByRoute(board).slice(0, candidateCount), [board])

  return { status, calls, board, message, matchId, retry }
}
