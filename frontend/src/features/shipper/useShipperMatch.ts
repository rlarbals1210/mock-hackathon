import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, requestShipperMatch } from '../../lib/api'
import { buildShipperRequest, type RequestBlockReason } from '../../lib/adapters'
import type { CatalogOptionsResponse, ShipperMatchResponse } from '../../lib/types'
import type { CargoForm, LeverState } from './shipperModel'

export type MatchStatus = 'idle' | 'loading' | 'ready' | 'error' | 'unavailable'

export type MatchState = {
  status: MatchStatus
  data: ShipperMatchResponse | null
  /** status가 'error' 또는 'unavailable'일 때 화면에 보여줄 문장입니다. */
  message: string
  /** 'unavailable'인 이유입니다. 노선·차종 미지원 등 사용자가 고칠 수 있는 경우를 구분합니다. */
  reason: RequestBlockReason | null
  retry: () => void
}

// 레버를 연달아 움직일 때 매번 요청하지 않도록 잠깐 모읍니다.
// 웜 상태의 서버 응답이 0.1초 수준이라 짧게 잡아도 충분합니다.
const debounceMs = 250

/**
 * 화주 조건 비교에 쓸 매칭 결과를 가져옵니다.
 *
 * 상차 시간창은 서버가 timeWindowScenarios 배열로 한 번에 돌려주므로 요청 조건에 넣지 않습니다.
 * 슬라이더는 그 배열 안에서 전환하고, 차종·상차일·기회비용이 바뀔 때만 다시 요청합니다.
 */
export function useShipperMatch(
  cargo: CargoForm,
  levers: LeverState,
  catalog: CatalogOptionsResponse | null,
  enabled: boolean,
): MatchState {
  const [status, setStatus] = useState<MatchStatus>('idle')
  const [data, setData] = useState<ShipperMatchResponse | null>(null)
  const [message, setMessage] = useState('')
  const [reason, setReason] = useState<RequestBlockReason | null>(null)
  const [attempt, setAttempt] = useState(0)
  const requestSequence = useRef(0)

  const retry = useCallback(() => setAttempt((current) => current + 1), [])

  // 요청에 실제로 영향을 주는 값만 의존성으로 둡니다. windowHours는 제외합니다.
  const { vehicleFlexible, dateShiftDays, timeChangeCostPerHour } = levers

  useEffect(() => {
    if (!enabled || !catalog) {
      setStatus('idle')
      return
    }

    const built = buildShipperRequest(
      cargo,
      { windowHours: 0, vehicleFlexible, dateShiftDays, timeChangeCostPerHour },
      { routes: catalog.routes, vehicleTypes: catalog.vehicleTypes },
      `web-${Date.now()}`,
    )

    if (!built.ok) {
      setStatus('unavailable')
      setReason(built.reason)
      setMessage(built.message)
      setData(null)
      return
    }

    const controller = new AbortController()
    const sequence = requestSequence.current + 1
    requestSequence.current = sequence

    setStatus('loading')
    setReason(null)
    setMessage('')

    const timer = window.setTimeout(() => {
      requestShipperMatch(built.request, controller.signal)
        .then((response) => {
          // 늦게 도착한 이전 응답이 최신 결과를 덮어쓰지 않게 합니다.
          if (controller.signal.aborted || sequence !== requestSequence.current) return
          setData(response)
          setStatus('ready')
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted || sequence !== requestSequence.current) return
          setMessage(error instanceof ApiError ? error.userMessage : '예측 결과를 가져오지 못했습니다.')
          setStatus('error')
        })
    }, debounceMs)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [attempt, cargo, catalog, dateShiftDays, enabled, timeChangeCostPerHour, vehicleFlexible])

  return { status, data, message, reason, retry }
}
