# 개발자 2 연동 인계서

기준일: 2026-08-12  
목표: 프론트의 데모 화면을 유지하면서 하드코딩된 선택지와 계산 결과를 실제 v13 엑셀·매칭 API로 교체하고, 생성형 AI에는 계산이 끝난 사실만 전달한다.

## 1. 바로 사용할 API

| 화면 목적 | 호출 | 데이터 출처 |
|---|---|---|
| 콜 등록 선택지 | `GET {VITE_API_URL}/api/v1/catalog/options` | v13 엑셀 |
| 화주 조건 비교 | `POST {VITE_API_URL}/api/v1/matches/shipper` | v13 엑셀 + 모델 A/B |
| 운송인 추천 콜 | `GET {VITE_API_URL}/api/v1/matches/carrier/{carrierId}` | v13 엑셀 + 결정론적 점수·비용 |
| 사용자 반응 | `POST {VITE_API_URL}/api/v1/matches/feedback` | 피드백 JSONL |
| 자연어 설명 | `POST /api/insights` | 위 API가 계산한 구조화 사실 + Gemini |

FastAPI와 Vercel 함수의 오리진이 다르다. 앞의 네 호출은 `frontend/src/lib/api.ts`의 `API_URL`을 사용하고, `/api/insights`만 현재 프론트 오리진의 상대경로를 사용한다.

## 2. 하드코딩 위치와 교체 대상

| 현재 위치 | 하드코딩 내용 | 교체 방법 | 생성형 AI 대상 여부 |
|---|---|---|---|
| `frontend/src/features/shipper/shipperModel.ts:89` | 권역·출발지·도착지 배열 | 카탈로그의 `originRegions`, `origins`, `destinationRegions`, `destinations` | 아니오 |
| `frontend/src/features/shipper/shipperModel.ts:100` | 차량 배열 | 카탈로그의 `tonnages`, `bodyTypes`, `vehicleTypes` | 아니오 |
| `frontend/src/features/shipper/shipperModel.ts:112` | 품목 배열 | 카탈로그의 `items` | 아니오 |
| `frontend/src/features/shipper/shipperModel.ts:200` | `interpolatePrediction()`의 111→1766, 42만→38만, 40분→15분 | 화주 매칭 응답의 `current`, `timeWindowScenarios` | 아니오 |
| `frontend/src/data.ts:15` | 운송인 후보 3건 | 운송인 매칭 응답의 `recommendations` | 아니오 |
| `frontend/src/data.ts:92` | 운송인 콜 목록 5건 | 운송인 매칭 응답의 `recommendations`를 목록 화면 타입으로 변환 | 아니오 |
| `frontend/src/data.ts:110` | 복화 제안 2건 | MVP에서는 운송인 응답의 다음 추천 콜을 순차 표시. 실제 복화 경로 최적화로 표현하지 않는다 | 아니오 |
| `frontend/src/features/shipper/MonthlyReport.tsx:23` | 로컬 설명 템플릿 | API 실패 시 fallback으로만 유지 | 예 |
| `frontend/src/features/shipper/MonthlyReport.tsx:32` | 로컬 보간 예측 사용 | 화주 매칭 응답 사용 | 아니오 |
| `frontend/src/features/shipper/MonthlyReport.tsx:50` | Gemini 호출 | 아래 `match-insight-v1` 입력으로 변경 | 예 |
| `frontend/src/features/shipper/MonthlyReport.tsx:110` | 25분, 40→15분, 4만원 등 KPI | 선택한 두 시나리오의 차이로 표시 | 아니오 |
| `frontend/src/features/carrier/CarrierWorkspace.tsx:213` | 운송인 비교 문장 템플릿 | 아래 운송인 AI 입력으로 교체하고 실패 시 기존 템플릿 유지 | 예 |
| `frontend/src/features/shipper/shipperModel.ts:126` | 탄소 노선·차량 참조값 | 별도 탄소 계산 API가 생기기 전까지 근거가 표시된 정적 참조값으로 유지 | 아니오 |
| `frontend/src/data.ts:55`, `frontend/src/data.ts:63` | 탄소 표·계수 | 보고서 근거 데이터이므로 AI로 계산하거나 바꾸지 않음 | 아니오 |
| `frontend/src/data.ts:71` | 지도 좌표 | 지도 렌더링용 데이터. 카탈로그와 지명이 일치하도록 별도 보강 필요 | 아니오 |

핵심 원칙은 **AI가 숫자를 대체하지 않는 것**이다. 선택지, 후보 수, 운임, 비용, 확률, 점수와 차이는 FastAPI 또는 프론트의 단순 산술로 확정하고, Gemini는 문장 표현만 담당한다.

## 3. 선택창 연동 순서

1. 콜 등록 화면 진입 시 필터 없이 카탈로그를 한 번 호출한다.
2. 버튼에는 각 옵션의 `label`을 표시하고 상태에는 `value`를 저장한다.
3. 출발지·도착지·톤급·적재형태·차종·품목 중 하나가 바뀔 때 현재 선택값을 쿼리로 다시 보낸다.
4. 새 응답에서 `selectionValid === false`이면 바뀐 필드보다 하위의 선택값을 지운다. 가능한 대안은 해당 배열에 남아 있다.
5. `routes`가 한 건이면 그 항목의 `routeId`, 권역, `baseFareByTonnage[tonnage]`을 매칭 요청에 사용한다.
6. MVP의 빠른 시험 버튼은 `sampleCargo`를 폼에 채우면 된다. 이 객체는 실제 엑셀 행이며 그대로 화주 매칭 API의 `cargo`가 된다.
7. 사용자가 입력한 품목 상세는 `cargo.cargoNote`에 최대 200자로 보낸다. 이 값은 모델 계산에는 사용하지 않고 화면과 생성형 설명의 문맥으로만 사용한다.

카탈로그는 전체 엑셀값의 단순 합집합이 아니라 현재 선택과 함께 실제 콜에 존재하는 조합만 반환한다. 예를 들어 부산신항을 고르면 해당 출발지에서 실제로 연결된 도착지만 표시된다.

## 4. 화주 매칭 연결

카탈로그의 `sampleCargo` 또는 사용자가 고른 값으로 다음 형태를 전송한다.

```json
{
  "requestId": "web-고유값",
  "cargo": "catalog.sampleCargo 또는 동일 스키마의 사용자 입력",
  "timeWindowOptionsMinutes": [30, 480, 1440, 2880],
  "carrierLimit": 5
}
```

`timeWindowOptionsMinutes`에는 현재 시간창을 반드시 포함한다. 서버가 중복 제거와 정렬을 수행한다. 슬라이더는 서버가 한 번에 반환한 `timeWindowScenarios` 안에서 전환하고, 배열에 없는 시간창을 사용자가 확정할 때만 다시 호출한다.

프론트 변환 기준:

- 기존 `Prediction.candidates` ← `Scenario.candidateCount`
- 기존 `Prediction.fare` ← `Scenario.expectedFare.point`
- 기존 `Prediction.dispatchMinutes` ← `Scenario.expectedDispatchMinutes`
- 기존 `Prediction.confidence` ← `Scenario.confidence === null ? null : Scenario.confidence * 100`
- 신규 유찰확률 표시 ← `Scenario.failureProbability`가 숫자인 경우에만 표시
- 기존 후보 카드 ← `response.carriers`

## 5. 운송인 화면 연결

`GET /api/v1/matches/carrier/{carrierId}?limit=3`의 `recommendations`를 사용한다. 백엔드가 같은 노선을 제거하므로 `limit=20`으로 받은 뒤 프론트에서 중복을 제거하는 우회는 필요 없다. 현재 프론트의 만원 단위 필드는 제거하고 API의 원 단위 정수를 보관한 뒤 표시할 때만 만원으로 환산한다.

화면의 선호 조건은 선택된 값만 쿼리로 전달한다.

- `preferredRegion`: 선호 권역
- `preferredSubRegion`: 선호 세부 지역
- `maxEmptyKm`: 최대 공차거리(km)
- `maxDurationHours`: 최대 운행시간(시간)
- `preferredLoadingPeriod`: `MORNING`, `AFTERNOON`, `NIGHT`; 여러 개면 쿼리 키를 반복
- `prioritizeIncome`: 많은 수익 우선 선택 시 `true`
- `prioritizeBackhaul`: 복화 가능성 선택 시 `true`

- `Candidate.id` ← `callId`로 타입 변경
- `time` ← `loadingTime`
- `emptyKm` ← `emptyDistanceKm`
- `duration` ← `durationHours`
- `fare`, `fuelCost`, `emptyCost`, `net` ← 각각 `fare`, `fuelCost`, `emptyCost`, `netIncome`
- 추천 순위는 배열 순서, 추천 라벨은 `score` 최고값에 표시
- 피드백의 `matchId` ← 운송인 응답 최상위의 `matchId`; 프론트에서 임의 문자열을 만들지 않는다.

현재 백엔드는 다음 콜 추천까지 제공하지만 진짜 복화 연결 최적화 모델은 아니다. 따라서 `backhaulOffers`를 교체할 때 화면 문구는 “다음 추천 콜”로 표시하고 “복화 최적 경로”라고 단정하지 않는다.

## 6. 생성형 AI 실제 연결 계약

`api/insights.ts`의 기존 입력은 로컬 보간값을 전제로 한다. 개발자 2는 이를 다음 구조로 교체한다.

### 화주 설명 입력

```json
{
  "schemaVersion": "match-insight-v1",
  "audience": "SHIPPER",
  "intent": "MATCH_SUMMARY",
  "facts": {
    "requestId": "shipper-demo-001",
    "matchId": "M-20260812-000001",
    "cargo": {},
    "current": {},
    "selectedScenario": {},
    "recommendation": {},
    "explanationFacts": [],
    "predictionSources": {},
    "warnings": []
  }
}
```

`cargo`, `current`, `selectedScenario`, `recommendation`, `explanationFacts`, `predictionSources`, `warnings`는 화주 매칭 응답에서 수정 없이 복사한다. 사용자가 현재 조건을 택하면 `selectedScenario`에는 `current`를 넣고, 조정안을 택하면 해당 `scenarioId` 객체를 넣는다.

### 운송인 비교 설명 입력

```json
{
  "schemaVersion": "match-insight-v1",
  "audience": "CARRIER",
  "intent": "CANDIDATE_COMPARISON",
  "facts": {
    "carrierId": "D00051",
    "baseline": {},
    "selected": {},
    "differences": {
      "fare": 0,
      "fuelCost": 0,
      "emptyCost": 0,
      "netIncome": 0,
      "durationHours": 0,
      "emptyDistanceKm": 0
    },
    "predictionSources": {},
    "warnings": []
  }
}
```

`baseline`과 `selected`는 운송인 응답의 추천 객체 전체다. `differences`는 `selected - baseline`의 단순 산술이며 단위는 원·시간·km를 그대로 유지한다.

Gemini 프롬프트 규칙:

- 입력에 있는 사실과 숫자만 사용한다.
- `failureProbability`가 `null`이면 유찰확률을 언급하지 않는다.
- `predictionSources`가 `unavailable`인 항목은 사실처럼 설명하지 않는다.
- 경력, 안전기록, 귀가 가능성, 복화 가능성처럼 입력에 없는 정보를 만들지 않는다.
- 응답은 설명 문자열만 반환한다. 숫자 필드를 다시 생성하거나 JSON을 재구성하지 않는다.
- Gemini 실패·타임아웃 시 화주는 `explanationFacts.join(' ')`, 운송인은 기존 규칙 템플릿을 fallback으로 사용한다.

## 7. 병합 직후 확인할 시나리오

1. mock 모드에서 기존 데모가 계속 동작한다.
2. 실제 모드에서 카탈로그 초기 호출이 10개 출발지, 10개 도착지, 15개 차종, 11개 품목을 반환한다.
3. `부산신항 / 김포 / 11 / 카고 / 11t카고 / 철강재` 선택 시 `matchedCallCount`가 21이고 `routeId`가 `R01`이다.
4. `sampleCargo`로 화주 매칭을 호출했을 때 여러 시간창과 추천 운송인이 표시된다.
5. 운송인 ID `D00051`의 추천 콜이 서로 다른 노선으로, 원 단위로 표시된다.
6. 운송인 선호 조건을 바꾸면 쿼리 파라미터와 추천 점수·태그가 함께 바뀐다.
7. Gemini 키가 있으면 AI 문장, 키가 없거나 호출 실패면 숫자를 유지한 fallback 문장이 표시된다.
8. AI 문장 속 모든 숫자가 FastAPI 응답 또는 `differences`에 실제로 존재한다.
