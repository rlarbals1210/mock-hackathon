import { mockCarrierMatches, mockCatalogOptions, mockFeedbackResponse, mockShipperMatch } from './mock'
import type {
  ApiErrorResponse,
  CarrierMatchesResponse,
  CatalogFilters,
  CatalogOptionsResponse,
  FeedbackRequest,
  FeedbackResponse,
  ShipperMatchRequest,
  ShipperMatchResponse,
} from './types'

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

/** 1이면 네트워크 없이 lib/mock.ts의 고정 응답을 씁니다. */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === '1'

// 매칭 서버는 첫 요청에서 생성 데이터와 학습 모델을 읽어 약 6초가 걸리고,
// 이후 요청은 0.1초 안에 끝납니다. 첫 요청이 잘리지 않도록 넉넉히 둡니다.
const requestTimeoutMs = 15_000
const mockLatencyMs = 180

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly requestId: string | null
  readonly details: { field: string; reason: string }[]

  constructor(status: number, code: string, message: string, requestId: string | null, details: { field: string; reason: string }[]) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.requestId = requestId
    this.details = details
  }

  /** 사용자에게 그대로 보여줄 수 있는 문장입니다. */
  get userMessage() {
    if (this.code === 'TIMEOUT') return '예측 서버 응답이 늦어 결과를 가져오지 못했습니다.'
    if (this.code === 'NETWORK') return '예측 서버에 연결하지 못했습니다.'
    if (this.code === 'CARRIER_NOT_FOUND') return '해당 운송인 정보를 찾을 수 없습니다.'
    if (this.code === 'CALL_NOT_FOUND') return '선택한 노선의 참조 정보가 없습니다.'
    if (this.code === 'DATA_NOT_READY') return '예측 데이터가 아직 준비되지 않았습니다.'
    if (this.code === 'VALIDATION_ERROR' || this.code === 'INVALID_REQUEST') return '입력한 조건으로는 예측을 요청할 수 없습니다.'
    return '예측 결과를 가져오지 못했습니다.'
  }
}

function isErrorResponse(value: unknown): value is ApiErrorResponse {
  if (typeof value !== 'object' || value === null) return false
  const body = (value as { error?: unknown }).error
  return typeof body === 'object' && body !== null && typeof (body as { code?: unknown }).code === 'string'
}

function delay<T>(value: T, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => resolve(value), mockLatencyMs)
    signal?.addEventListener('abort', () => {
      window.clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })
}

async function request<T>(path: string, init: RequestInit, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), requestTimeoutMs)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, signal: controller.signal })
  } catch (error) {
    // 호출한 쪽에서 취소한 경우는 그대로 올려보내 화면이 상태를 되돌리지 않게 합니다.
    if (signal?.aborted) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(0, 'TIMEOUT', `${requestTimeoutMs}ms 안에 응답이 오지 않았습니다.`, null, [])
    }
    throw new ApiError(0, 'NETWORK', '예측 서버에 연결하지 못했습니다.', null, [])
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }

  const text = await response.text()
  let payload: unknown = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = null
  }

  if (!response.ok) {
    if (isErrorResponse(payload)) {
      const { code, message, requestId, details } = payload.error
      throw new ApiError(response.status, code, message, requestId ?? null, details ?? [])
    }
    throw new ApiError(response.status, 'INTERNAL_ERROR', text.slice(0, 200) || `HTTP ${response.status}`, null, [])
  }

  return payload as T
}

/**
 * 콜 등록 화면의 선택지를 v13 엑셀에서 가져옵니다.
 * 현재 선택값을 필터로 함께 보내면 실제 콜에 존재하는 조합만 돌아옵니다.
 */
export function fetchCatalogOptions(filters: CatalogFilters = {}, signal?: AbortSignal): Promise<CatalogOptionsResponse> {
  if (USE_MOCK) return delay(mockCatalogOptions(filters), signal)
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== null && value !== undefined && value !== '') query.set(key, String(value))
  }
  const suffix = query.size ? `?${query.toString()}` : ''
  return request<CatalogOptionsResponse>(`/api/v1/catalog/options${suffix}`, { method: 'GET' }, signal)
}

export function requestShipperMatch(body: ShipperMatchRequest, signal?: AbortSignal): Promise<ShipperMatchResponse> {
  if (USE_MOCK) return delay(mockShipperMatch(body), signal)
  return request<ShipperMatchResponse>(
    '/api/v1/matches/shipper',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    signal,
  )
}

export function fetchCarrierMatches(carrierId: string, limit = 3, signal?: AbortSignal): Promise<CarrierMatchesResponse> {
  if (USE_MOCK) return delay(mockCarrierMatches(carrierId, limit), signal)
  return request<CarrierMatchesResponse>(
    `/api/v1/matches/carrier/${encodeURIComponent(carrierId)}?limit=${limit}`,
    { method: 'GET' },
    signal,
  )
}

export function sendFeedback(body: FeedbackRequest, signal?: AbortSignal): Promise<FeedbackResponse> {
  if (USE_MOCK) return delay(mockFeedbackResponse(), signal)
  return request<FeedbackResponse>(
    '/api/v1/matches/feedback',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    signal,
  )
}

/**
 * 배포 직후 첫 요청이 약 6초 걸리는 것을 피하기 위한 사전 예열입니다.
 * /api/health는 엑셀을 읽지 않아 예열되지 않으므로 카탈로그를 호출합니다. 실패해도 무시합니다.
 */
export function warmUpApi() {
  if (USE_MOCK) return
  fetch(`${API_URL}/api/v1/catalog/options`).catch(() => undefined)
}
