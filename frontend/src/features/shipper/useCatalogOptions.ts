import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError, fetchCatalogOptions } from '../../lib/api'
import type { CatalogOptionsResponse, RouteOption } from '../../lib/types'

export type CatalogStatus = 'loading' | 'ready' | 'error'

export type CatalogState = {
  status: CatalogStatus
  data: CatalogOptionsResponse | null
  message: string
  reload: () => void
}

/**
 * 콜 등록 화면의 선택지를 v13 엑셀에서 한 번 받아옵니다.
 *
 * 서버는 필터를 함께 보내면 실제 콜에 존재하는 조합만 돌려주지만,
 * 응답의 routes 배열에 12개 노선이 모두 들어 있어 출발지에 따른 도착지 좁히기는
 * 추가 호출 없이 아래 헬퍼로 계산할 수 있습니다. 선택할 때마다 왕복하지 않아 더 빠릅니다.
 */
export function useCatalogOptions(): CatalogState {
  const [status, setStatus] = useState<CatalogStatus>('loading')
  const [data, setData] = useState<CatalogOptionsResponse | null>(null)
  const [message, setMessage] = useState('')
  const [attempt, setAttempt] = useState(0)

  const reload = useCallback(() => setAttempt((current) => current + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setMessage('')

    fetchCatalogOptions({}, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return
        setData(response)
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setMessage(error instanceof ApiError ? error.userMessage : '선택지를 불러오지 못했습니다.')
        setStatus('error')
      })

    return () => controller.abort()
  }, [attempt])

  return { status, data, message, reload }
}

export type LocationChoices = {
  regions: string[]
  byRegion: Record<string, string[]>
}

function groupByRegion(entries: { value: string; region: string }[]): LocationChoices {
  const byRegion: Record<string, string[]> = {}
  for (const entry of entries) {
    const bucket = byRegion[entry.region] ?? []
    if (!bucket.includes(entry.value)) bucket.push(entry.value)
    byRegion[entry.region] = bucket
  }
  return { regions: Object.keys(byRegion), byRegion }
}

/** 노선이 존재하는 출발지를 권역별로 묶습니다. */
export function useOriginChoices(routes: RouteOption[] | undefined): LocationChoices {
  return useMemo(() => {
    if (!routes?.length) return { regions: [], byRegion: {} }
    return groupByRegion(routes.map((route) => ({ value: route.origin, region: route.originRegion })))
  }, [routes])
}

/** 선택한 출발지에서 실제로 연결된 도착지만 권역별로 묶습니다. */
export function useDestinationChoices(routes: RouteOption[] | undefined, origin: string): LocationChoices {
  return useMemo(() => {
    if (!routes?.length) return { regions: [], byRegion: {} }
    const reachable = origin ? routes.filter((route) => route.origin === origin) : routes
    return groupByRegion(reachable.map((route) => ({ value: route.destination, region: route.destinationRegion })))
  }, [origin, routes])
}
