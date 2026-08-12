# Mov!n 매칭 API 계약 v1

상태: **합의안 / 개발 기준**  
소유자: 개발자 1(데이터·모델·매칭 API)  
변경 규칙: 응답 필드의 추가·삭제·이름·단위 변경은 개발자 2에게 먼저 알리고 합의한다.

## 1. 합의 사항

1. **유찰확률은 학습 모델 결과만 제공한다.** 모델 B의 유찰 분류기는 개입이 적용되지 않은 가상 콜 10,862건으로 학습한 `HistGradientBoostingClassifier`이며, 노트북의 5겹 교차검증 AUC는 0.742이다. 학습 모델 파일이 없거나 입력을 만들 수 없으면 휴리스틱 확률을 생성하지 않고 `failureProbability: null`을 반환한다. 프론트와 자연어 설명은 값이 숫자인 경우에만 이를 노출한다.
2. **모든 금액은 원(KRW) 단위 정수**로 전달한다. 표시용 만원 환산과 반올림은 프론트에서 한다. 거리는 km, 시간은 분 또는 명시된 시간 단위, 확률은 0~1이다.
3. `/api/insights`는 Vercel 자연어 설명 함수이며, 이 문서의 `/api/v1/matches/*`는 `{VITE_API_URL}`의 FastAPI 서버다.
4. 운송인 화면에는 운송인별 추천 콜 응답을 별도로 제공한다.
5. 상차 시간창 슬라이더는 한 번의 화주 요청에 `timeWindowOptionsMinutes` 배열을 보내고, 서버가 모든 시간창 결과를 배열로 반환한다. 옵션은 중복 제거 후 최대 12개까지 허용한다.
6. 개발자 1은 `frontend/vite.config.ts`, `frontend/src/vite-env.d.ts`, 저장소 루트의 `.env.example`을 수정하지 않는다. `backend/.env.example`은 백엔드 전용으로 개발자 1이 관리한다.
7. 병합은 UI mock 모드를 먼저 병합하고, 이후 매칭 엔진을 병합한다. 실제 API 전환은 프론트의 `VITE_USE_MOCK` 플래그로 제어한다.

## 2. 공통 규칙

- Base URL: `{VITE_API_URL}`
- Content-Type: `application/json`
- 성공 응답 필드명은 camelCase를 사용한다.
- ISO 일시는 타임존을 포함한다. 예: `2026-08-13T17:30:00+09:00`
- 예측값이 없을 때 `0`으로 대체하지 않고 `null`을 사용한다.
- `predictionSources`를 통해 각 숫자가 학습 모델, 공급 풀 계산 또는 결정론적 비용 계산 중 어디에서 나왔는지 구분한다.

## 3. POST /api/v1/matches/shipper

화물 조건과 여러 상차 시간창을 한 번에 평가하고, 화주용 조건 비교와 상위 운송인 후보를 반환한다.

### 요청 예시

```json
{
  "requestId": "shipper-demo-001",
  "cargo": {
    "callId": "C0042",
    "shipperId": "S018",
    "routeId": "R01",
    "origin": "부산신항",
    "originRegion": "영남",
    "destination": "김포",
    "destinationRegion": "수도권",
    "loadingAt": "2026-08-13T17:30:00+09:00",
    "loadingWindowMinutes": 180,
    "leadTimeHours": 26.0,
    "tonnage": 11,
    "bodyType": "카고",
    "allowCompatibleVehicle": false,
    "item": "철강재",
    "weightKg": 9500,
    "pallets": 10,
    "baseFare": 454000,
    "offeredFare": 454000,
    "registrationActor": "원화주직접",
    "adjustmentPermissionApproved": true,
    "splitAllowed": false,
    "concurrentLoadAllowed": false,
    "waypointAllowed": false,
    "orderChangeAllowed": false,
    "loadingMethod": "지게차",
    "paymentMethod": "인수증후불",
    "timeChangeCostPerHour": 0
  },
  "timeWindowOptionsMinutes": [180, 480, 1440, 2880],
  "carrierLimit": 5
}
```

### 응답 예시

아래 JSON은 프론트 mock의 기준 형태다. 실제 수치는 데이터와 모델 버전에 따라 달라진다.

```json
{
  "requestId": "shipper-demo-001",
  "matchId": "M-20260812-000001",
  "generatedAt": "2026-08-12T16:20:00+09:00",
  "cargo": {
    "callId": "C0042",
    "route": "부산신항 → 김포",
    "loadingAt": "2026-08-13T17:30:00+09:00",
    "tonnage": 11,
    "bodyType": "카고",
    "item": "철강재",
    "weightKg": 9500
  },
  "current": {
    "scenarioId": "CURRENT",
    "loadingWindowMinutes": 180,
    "candidateCount": 111,
    "expectedDispatchMinutes": 40,
    "expectedFare": {
      "point": 420000,
      "min": 398000,
      "max": 447000
    },
    "failureProbability": 0.14,
    "confidence": 0.78
  },
  "timeWindowScenarios": [
    {
      "scenarioId": "WINDOW_180",
      "loadingWindowMinutes": 180,
      "candidateCount": 111,
      "expectedDispatchMinutes": 40,
      "expectedFare": {
        "point": 420000,
        "min": 398000,
        "max": 447000
      },
      "failureProbability": 0.14,
      "confidence": 0.78
    },
    {
      "scenarioId": "WINDOW_480",
      "loadingWindowMinutes": 480,
      "candidateCount": 294,
      "expectedDispatchMinutes": 29,
      "expectedFare": {
        "point": 411000,
        "min": 390000,
        "max": 438000
      },
      "failureProbability": 0.09,
      "confidence": 0.78
    },
    {
      "scenarioId": "WINDOW_1440",
      "loadingWindowMinutes": 1440,
      "candidateCount": 883,
      "expectedDispatchMinutes": 19,
      "expectedFare": {
        "point": 397000,
        "min": 377000,
        "max": 424000
      },
      "failureProbability": 0.05,
      "confidence": 0.76
    },
    {
      "scenarioId": "WINDOW_2880",
      "loadingWindowMinutes": 2880,
      "candidateCount": 1766,
      "expectedDispatchMinutes": 15,
      "expectedFare": {
        "point": 380000,
        "min": 361000,
        "max": 407000
      },
      "failureProbability": 0.03,
      "confidence": 0.74
    }
  ],
  "recommendations": [
    {
      "type": "TIME_WINDOW",
      "description": "상차 가능 시간을 3시간에서 8시간으로 확대",
      "shipperAcceptanceProbability": 0.71,
      "scenarioId": "WINDOW_480",
      "candidateIncrease": 183,
      "dispatchMinutesChange": -11,
      "fareChange": -9000
    }
  ],
  "carriers": [
    {
      "carrierId": "D00127",
      "score": 87,
      "emptyDistanceKm": 12,
      "estimatedNetIncome": 340000,
      "preferenceMatches": ["영남 출발 선호", "수도권 도착 선호"],
      "warning": null
    },
    {
      "carrierId": "D00481",
      "score": 82,
      "emptyDistanceKm": 18,
      "estimatedNetIncome": 331000,
      "preferenceMatches": ["호환 차종", "주간 상차 선호"],
      "warning": "상차지까지 예상 이동 35분"
    }
  ],
  "explanationFacts": [
    "상차 가능 시간을 3시간에서 8시간으로 넓히면 후보 운송인이 111명에서 294명으로 증가합니다.",
    "같은 비교에서 예상 배차시간은 40분에서 29분으로 줄어듭니다.",
    "예상 운임은 420000원에서 411000원으로 낮아지는 방향입니다."
  ],
  "predictionSources": {
    "candidateCount": "supply_pool_v13",
    "expectedDispatchMinutes": "dispatch_curve_v13",
    "expectedFare": "hist_gradient_boosting_v13",
    "failureProbability": "hist_gradient_boosting_v13",
    "shipperAcceptanceProbability": "hist_gradient_boosting_v13",
    "carrierScore": "rule_based_v1"
  },
  "warnings": []
}
```

학습 모델 파일이 준비되지 않은 환경에서는 관련 필드와 출처가 다음처럼 반환된다.

```json
{
  "failureProbability": null,
  "shipperAcceptanceProbability": null,
  "predictionSources": {
    "failureProbability": "unavailable",
    "shipperAcceptanceProbability": "unavailable"
  },
  "warnings": ["학습 모델 파일이 없어 유찰확률과 화주 수락확률을 제공하지 않습니다."]
}
```

## 4. GET /api/v1/matches/carrier/{carrier_id}

운송인 한 명에게 추천할 콜 목록을 점수 내림차순으로 반환한다.

선택 쿼리:

- `limit`: 1~20, 기본값 3

### 응답 예시

```json
{
  "carrierId": "D00127",
  "generatedAt": "2026-08-12T16:20:00+09:00",
  "recommendations": [
    {
      "callId": "C0042",
      "route": "부산신항 → 김포",
      "loadingTime": "2026-08-13T17:30:00+09:00",
      "emptyDistanceKm": 12,
      "durationHours": 7.1,
      "fare": 454000,
      "fuelCost": 74000,
      "emptyCost": 14000,
      "netIncome": 366000,
      "tags": ["수도권 도착", "선호 권역 일치"],
      "warning": null,
      "score": 87
    },
    {
      "callId": "C0178",
      "route": "대전유성 → 김해",
      "loadingTime": "2026-08-13T19:00:00+09:00",
      "emptyDistanceKm": 34,
      "durationHours": 4.8,
      "fare": 350000,
      "fuelCost": 51000,
      "emptyCost": 37000,
      "netIncome": 262000,
      "tags": ["영남 귀가 방향", "야간 운행 가능"],
      "warning": "공차거리가 30km를 초과합니다.",
      "score": 76
    },
    {
      "callId": "C0224",
      "route": "창원공단 → 평택",
      "loadingTime": "2026-08-14T09:00:00+09:00",
      "emptyDistanceKm": 19,
      "durationHours": 6.0,
      "fare": 406000,
      "fuelCost": 63000,
      "emptyCost": 21000,
      "netIncome": 322000,
      "tags": ["호환 차종", "주간 상차"],
      "warning": null,
      "score": 74
    }
  ],
  "predictionSources": {
    "score": "rule_based_v1",
    "emptyDistanceKm": "carrier_history_estimate_v1",
    "costs": "deterministic_cost_v1"
  },
  "warnings": []
}
```

## 5. POST /api/v1/matches/feedback

화주 또는 운송인의 추천 반응을 기록한다. 같은 `matchId + actorId + action + callId + scenarioId` 조합은 중복 저장하지 않고 기존 결과를 반환한다.

### 요청 예시

```json
{
  "matchId": "M-20260812-000001",
  "actorType": "CARRIER",
  "actorId": "D00127",
  "action": "ACCEPT",
  "callId": "C0042",
  "scenarioId": null,
  "recommendationType": null,
  "reasonCode": null,
  "occurredAt": "2026-08-12T16:22:14+09:00"
}
```

### 응답 예시

```json
{
  "feedbackId": "F-20260812-000001",
  "status": "recorded",
  "recordedAt": "2026-08-12T16:22:15+09:00"
}
```

`status`는 `recorded` 또는 `duplicate`다.

## 6. 공통 에러 응답

모든 4xx·5xx 응답은 같은 본문 형태를 사용한다.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "요청값을 확인해 주세요.",
    "requestId": "shipper-demo-001",
    "details": [
      {
        "field": "cargo.loadingWindowMinutes",
        "reason": "값은 30 이상 2880 이하여야 합니다."
      }
    ]
  }
}
```

| HTTP | code | 의미 |
|---:|---|---|
| 400 | `INVALID_REQUEST` | JSON은 유효하지만 조합이 잘못됨 |
| 404 | `CARRIER_NOT_FOUND` / `CALL_NOT_FOUND` | 대상 없음 |
| 422 | `VALIDATION_ERROR` | 필드 타입·범위 오류 |
| 503 | `DATA_NOT_READY` | 생성 데이터가 준비되지 않아 요청 수행 불가 |
| 500 | `INTERNAL_ERROR` | 예상하지 못한 서버 오류 |

## 7. 숫자 단위와 범위

| 필드 | 단위 | 허용 범위 |
|---|---|---|
| `baseFare`, `offeredFare`, `fare`, `fuelCost`, `emptyCost`, `netIncome`, `fareChange`, `estimatedNetIncome` | KRW 원 | 정수, 비용은 0 이상. `fareChange`는 음수 가능 |
| `expectedFare.point/min/max` | KRW 원 | 정수, 0 이상, `min ≤ point ≤ max` |
| `candidateCount`, `candidateIncrease` | 명 | 정수. 후보 수는 0 이상, 증감은 음수 가능 |
| `loadingWindowMinutes`, `expectedDispatchMinutes`, `dispatchMinutesChange` | 분 | 시간창 30~2880. 증감은 음수 가능 |
| `leadTimeHours`, `durationHours` | 시간 | 0 이상 |
| `emptyDistanceKm` | km | 정수, 0 이상 |
| `weightKg` | kg | 1 이상 |
| `tonnage` | 톤 | `5`, `11`, `25` |
| `failureProbability`, `shipperAcceptanceProbability`, `confidence` | 비율 | `null` 또는 0~1 |
| `score` | 점 | 정수 0~100 |

## 8. 프론트 표시 규칙

- `failureProbability === null`이면 유찰확률 UI와 자연어 문장을 표시하지 않는다.
- `shipperAcceptanceProbability === null`이면 수락확률을 표시하지 않는다.
- `warnings`는 사용자에게 그대로 보여주는 문장이 아니라 기능 비활성화·대체 문구 선택에 사용한다.
- 생성형 AI에는 `explanationFacts`와 구조화된 숫자만 전달하며, 새 숫자 계산을 요청하지 않는다.
