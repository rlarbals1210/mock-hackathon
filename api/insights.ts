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

// docs/frontend-integration-handoff.md 6절 match-insight-v1.
// 이 함수는 숫자를 만들지 않습니다. 매칭 API가 확정한 사실만 문장으로 바꿉니다.
type InsightRequest = {
  schemaVersion?: string
  audience?: 'SHIPPER' | 'CARRIER'
  intent?: string
  facts?: Record<string, unknown>
}

const maxPromptFactsLength = 8000

/** 문자열에서 숫자만 뽑습니다. 천 단위 구분과 소수점을 함께 처리합니다. */
function extractNumbers(text: string): string[] {
  const matches = text.match(/-?\d[\d,]*(?:\.\d+)?/g) ?? []
  return matches.map((value) => value.replaceAll(',', ''))
}

/** 입력 사실에 등장하는 모든 숫자를 모읍니다. 생성 문장 검증의 기준이 됩니다. */
function collectAllowedNumbers(value: unknown, sink: Set<string>) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    // 음수 차이값은 문장에서 "28,544원 적습니다"처럼 절댓값과 말로 표현되므로 양쪽 다 허용합니다.
    for (const form of [value, Math.abs(value)]) {
      sink.add(String(form))
      sink.add(String(Math.round(form)))
      // 화면과 문장은 보통 반올림한 값을 쓰므로 소수 1자리 표기도 허용합니다.
      sink.add(form.toFixed(1))
      if (form >= 0 && form <= 1) {
        // 확률은 문장에서 백분율로 바뀌므로 자릿수별 표기를 함께 허용합니다.
        const percent = form * 100
        sink.add(String(Math.round(percent)))
        sink.add(percent.toFixed(1))
        sink.add(percent.toFixed(2))
      }
    }
    return
  }
  if (typeof value === 'string') {
    for (const number of extractNumbers(value)) sink.add(number)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectAllowedNumbers(item, sink)
    return
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectAllowedNumbers(item, sink)
  }
}

/**
 * 생성 문장이 입력에 없는 숫자를 만들어냈는지 확인합니다.
 * 연도·월처럼 문맥 숫자까지 막지 않도록, 허용 목록에 없는 숫자가 하나라도 있으면 실패로 봅니다.
 */
function findInventedNumbers(text: string, allowed: Set<string>): string[] {
  const invented: string[] = []
  for (const number of extractNumbers(text)) {
    if (allowed.has(number)) continue
    // 문장 순서를 나타내는 한 자리 숫자는 사실 주장으로 보지 않습니다.
    if (number.length === 1) continue
    invented.push(number)
  }
  return [...new Set(invented)]
}

const sharedRules = `규칙:
- 아래 제공 사실에 있는 값만 사용하세요. 새로운 수치를 만들거나 계산하지 마세요.
- 제공 사실에 없는 경력, 안전기록, 귀가 가능성, 복화 가능성, 실제 거래 이력을 언급하지 마세요.
- predictionSources의 값이 "unavailable"인 항목은 사실처럼 설명하지 마세요.
- 마크다운, 제목, 목록 없이 본문만 출력하세요.
- 설명 문장만 반환하고 JSON이나 숫자 표를 다시 만들지 마세요.`

function buildShipperPrompt(facts: Record<string, unknown>) {
  const scenario = facts.selectedScenario as { failureProbability?: unknown } | undefined
  const hasFailureProbability = typeof scenario?.failureProbability === 'number'
  return `당신은 화주용 물류 의사결정 리포트 작성자입니다. 아래 제공 사실만 사용해 한국어로 2개 문단, 총 220자 이내의 설명을 작성하세요.

제공 사실:
${JSON.stringify(facts, null, 2).slice(0, maxPromptFactsLength)}

${sharedRules}
- ${hasFailureProbability ? '유찰확률은 제공된 값 그대로만 언급하세요.' : 'failureProbability가 없으므로 유찰확률을 언급하지 마세요.'}
- 첫 문단은 선택한 조건과 배차 의미, 둘째 문단은 후보 수·운임·배차시간의 변화와 한계를 설명하세요.
- 확률은 소수를 그대로 쓰지 말고 백분율로 소수 첫째 자리까지 표기하세요. 예: 0.0676 이면 6.8%.
- loadingWindowMinutes 같은 분 단위 값은 분 그대로 쓰고 시간으로 환산하지 마세요.
- 금액은 원 단위 숫자를 그대로 쓰세요.
- 변화를 말할 때는 반드시 current와 selectedScenario를 비교하고, differences의 부호를 그대로 따르세요.
- 음수 차이는 "-46분"처럼 부호를 붙이지 말고 "46분 줄어" 처럼 말로 방향을 표현하세요.
- confidence 같은 내부 지표는 문장에 넣지 마세요.
- recommendation과 explanationFacts가 비어 있으면 서버 추천을 언급하지 말고 current와 selectedScenario 비교만 설명하세요.`
}

function buildCarrierPrompt(facts: Record<string, unknown>) {
  return `당신은 운송인용 콜 비교 안내 작성자입니다. 아래 제공 사실만 사용해 한국어로 2~3문장, 총 160자 이내의 설명을 작성하세요.

제공 사실:
${JSON.stringify(facts, null, 2).slice(0, maxPromptFactsLength)}

${sharedRules}
- differences는 selected에서 baseline을 뺀 값입니다. 부호를 그대로 해석하세요.
- 운임보다 실수령(netIncome)과 운행시간의 관계를 중심으로 설명하세요.
- 어떤 콜을 선택하라고 지시하지 말고 판단 재료만 제시하세요.`
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

  let body: InsightRequest = {}
  try {
    body = typeof request.body === 'string' ? JSON.parse(request.body) as InsightRequest : (request.body ?? {}) as InsightRequest
  } catch {
    response.status(400).json({ error: '요청 본문을 읽을 수 없습니다.' })
    return
  }

  if (body.schemaVersion !== 'match-insight-v1') {
    response.status(400).json({ error: 'schemaVersion은 match-insight-v1이어야 합니다.' })
    return
  }
  if (body.audience !== 'SHIPPER' && body.audience !== 'CARRIER') {
    response.status(400).json({ error: 'audience는 SHIPPER 또는 CARRIER여야 합니다.' })
    return
  }
  if (!body.facts || typeof body.facts !== 'object') {
    response.status(400).json({ error: 'facts가 필요합니다.' })
    return
  }

  const facts = body.facts
  const prompt = body.audience === 'SHIPPER' ? buildShipperPrompt(facts) : buildCarrierPrompt(facts)

  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest'
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
          // 사고 토큰이 함께 소비되므로 본문 220자를 확보할 수 있게 넉넉히 둡니다.
          maxOutputTokens: 3000,
          thinkingConfig: {
            thinkingLevel: 'low',
          },
        },
      }),
    })
    const result = await geminiResponse.json() as {
      candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[]
      error?: { message?: string }
    }
    if (!geminiResponse.ok) {
      response.status(geminiResponse.status).json({ error: result.error?.message || 'Gemini 요청에 실패했습니다.' })
      return
    }
    // 모델이 사고 과정을 thought 파트로 함께 돌려주므로 최종 답변 파트만 씁니다.
    const text = result.candidates?.[0]?.content?.parts
      ?.filter((part) => part.thought !== true)
      .map((part) => part.text ?? '')
      .join('')
      .trim()
    if (!text) {
      response.status(502).json({ error: 'Gemini가 빈 응답을 반환했습니다.' })
      return
    }

    // 생성 문장이 제공 사실에 없는 숫자를 만들어내면 버립니다.
    // 화면은 이 응답 대신 확정된 사실 문장을 그대로 보여줍니다.
    const allowed = new Set<string>()
    collectAllowedNumbers(facts, allowed)
    const invented = findInventedNumbers(text, allowed)
    if (invented.length > 0) {
      response.status(200).json({ text: '', model, rejected: true, invented })
      return
    }

    response.status(200).json({ text, model })
  } catch {
    response.status(502).json({ error: 'Gemini 요청을 완료하지 못했습니다.' })
  }
}
