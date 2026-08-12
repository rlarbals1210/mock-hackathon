declare const process: { env: Record<string, string | undefined> }

type RequestLike = {
  method?: string
  body?: unknown
}

type ResponseLike = {
  status: (statusCode: number) => ResponseLike
  json: (body: unknown) => void
  setHeader: (name: string, value: string) => void
}

type InsightPayload = {
  choice?: 'current' | 'adjusted'
  route?: string
  vehicle?: string
  item?: string
  loadingWindow?: string
  candidates?: number
  fare?: number
  dispatchMinutes?: number
  fareDelta?: number
  dispatchDelta?: number
  carbonKgPerOrder?: number
  carbonBasis?: string
}

function cleanText(value: unknown, fallback: string) {
  return typeof value === 'string' ? value.slice(0, 120) : fallback
}

function cleanNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export default async function handler(request: RequestLike, response: ResponseLike) {
  response.setHeader('Cache-Control', 'no-store')
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'POST 요청만 지원합니다.' })
    return
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    response.status(503).json({ error: 'GEMINI_API_KEY가 설정되지 않았습니다.' })
    return
  }

  let body: InsightPayload = {}
  try {
    body = typeof request.body === 'string' ? JSON.parse(request.body) as InsightPayload : (request.body ?? {}) as InsightPayload
  } catch {
    response.status(400).json({ error: '요청 본문을 읽을 수 없습니다.' })
    return
  }

  const facts = {
    choice: body.choice === 'adjusted' ? '상차 시간 조정안' : '현재 조건 유지',
    route: cleanText(body.route, '미선택'),
    vehicle: cleanText(body.vehicle, '미선택'),
    item: cleanText(body.item, '미선택'),
    loadingWindow: cleanText(body.loadingWindow, '미선택'),
    candidates: cleanNumber(body.candidates),
    fare: cleanNumber(body.fare),
    dispatchMinutes: cleanNumber(body.dispatchMinutes),
    fareDelta: cleanNumber(body.fareDelta),
    dispatchDelta: cleanNumber(body.dispatchDelta),
    carbonKgPerOrder: cleanNumber(body.carbonKgPerOrder),
    carbonBasis: cleanText(body.carbonBasis, '탄소 보고서 방식 B'),
  }

  const prompt = `당신은 화주용 물류 의사결정 리포트 작성자입니다. 아래 제공 사실만 사용해 한국어로 2개 문단, 총 220자 이내의 자연스러운 설명을 작성하세요.

제공 사실:
${JSON.stringify(facts, null, 2)}

근거 범위:
- 후보 수·운임·배차시간은 기획자료의 3시간↔48시간 끝점 사이 참조값입니다.
- 탄소는 12,000건 가상 오더와 국내계수판 방식 B의 참고값입니다.
- 유찰 확률은 원자료 근거가 없어 말하지 않습니다.

규칙:
- 새로운 수치, 인과관계, 실제 거래 이력, 안전 기록을 만들지 마세요.
- 첫 문단은 최근 선택과 배차 의미, 둘째 문단은 비용·탄소 근거와 한계를 설명하세요.
- 마크다운, 제목, 목록 없이 본문만 출력하세요.`

  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash'
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`

  try {
    const geminiResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 800,
          thinkingConfig: {
            thinkingLevel: 'low',
          },
        },
      }),
    })
    const result = await geminiResponse.json() as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
      error?: { message?: string }
    }
    if (!geminiResponse.ok) {
      response.status(geminiResponse.status).json({ error: result.error?.message || 'Gemini 요청에 실패했습니다.' })
      return
    }
    const text = result.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim()
    if (!text) {
      response.status(502).json({ error: 'Gemini가 빈 응답을 반환했습니다.' })
      return
    }
    response.status(200).json({ text, model })
  } catch {
    response.status(502).json({ error: 'Gemini 요청을 완료하지 못했습니다.' })
  }
}
