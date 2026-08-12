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

학습 모델 번들은 저장소의 `ai/models/`에 두며, 별도 경로를 사용할 때만 백엔드의 `MATCHING_MODEL_DIR` 환경변수를 지정한다. 생성 엑셀은 기본적으로 `ai/data/유연오더_가상데이터_v13.xlsx`에서 읽고, 배포 환경에서는 `MATCHING_DATA_FILE`로 경로를 지정할 수 있다.

## 2. 공통 규칙

- Base URL: `{VITE_API_URL}`
- Content-Type: `application/json`
- 성공 응답 필드명은 camelCase를 사용한다.
- ISO 일시는 타임존을 포함한다. 예: `2026-08-13T17:30:00+09:00`
- 예측값이 없을 때 `0`으로 대체하지 않고 `null`을 사용한다.
- `predictionSources`를 통해 각 숫자가 학습 모델, 공급 풀 계산 또는 결정론적 비용 계산 중 어디에서 나왔는지 구분한다.

## 3. GET /api/v1/catalog/options

콜 등록 선택창에 사용할 값을 생성 엑셀의 `콜등록이력`, `참조_노선`, `참조_기준운임`에서 읽어 반환한다. 프론트는 이 응답을 사용하고 별도의 출발지·도착지·차종·품목 배열을 유지하지 않는다.

선택 쿼리: `routeId`, `originRegion`, `origin`, `destinationRegion`, `destination`, `tonnage`, `bodyType`, `vehicleType`, `item`, `loadingMethod`, `unloadingMethod`, `paymentMethod`.

각 선택지는 현재 조건과 실제로 함께 존재했던 콜 수를 `callCount`로 제공한다. 특정 필드의 목록을 계산할 때는 그 필드 자신의 필터만 제외하므로, 잘못된 조합을 선택해도 프론트가 가능한 대체 선택지를 표시할 수 있다. 모든 필터가 일치한 콜이 없으면 `selectionValid`는 `false`, `matchedCallCount`는 `0`이다.

### 요청 예시

```text
GET {VITE_API_URL}/api/v1/catalog/options?origin=부산신항&destination=김포&tonnage=11&bodyType=카고&vehicleType=11t카고&item=철강재
```

### 실제 응답 예시

```json
{
  "source": "유연오더_가상데이터_v13.xlsx",
  "generatedAt": "2026-08-12T17:10:00+09:00",
  "totalCallCount": 12000,
  "matchedCallCount": 21,
  "selectionValid": true,
  "appliedFilters": {
    "routeId": null,
    "originRegion": null,
    "origin": "부산신항",
    "destinationRegion": null,
    "destination": "김포",
    "tonnage": 11,
    "bodyType": "카고",
    "vehicleType": "11t카고",
    "item": "철강재",
    "loadingMethod": null,
    "unloadingMethod": null,
    "paymentMethod": null
  },
  "originRegions": [
    { "value": "영남", "label": "영남", "callCount": 21 }
  ],
  "origins": [
    { "value": "부산신항", "label": "부산신항", "callCount": 21, "region": "영남" }
  ],
  "destinationRegions": [
    { "value": "수도권", "label": "수도권", "callCount": 21 }
  ],
  "destinations": [
    { "value": "김포", "label": "김포", "callCount": 21, "region": "수도권" },
    { "value": "이천", "label": "이천", "callCount": 14, "region": "수도권" }
  ],
  "tonnages": [
    { "value": 11, "label": "11톤", "callCount": 21 }
  ],
  "bodyTypes": [
    { "value": "카고", "label": "카고", "callCount": 21 }
  ],
  "vehicleTypes": [
    { "value": "11t카고", "label": "11t카고", "callCount": 21, "tonnage": 11, "bodyType": "카고" }
  ],
  "items": [
    { "value": "기계류", "label": "기계류", "callCount": 44 },
    { "value": "생활용품", "label": "생활용품", "callCount": 11 },
    { "value": "섬유원단", "label": "섬유원단", "callCount": 1 },
    { "value": "식품가공", "label": "식품가공", "callCount": 2 },
    { "value": "자동차부품", "label": "자동차부품", "callCount": 8 },
    { "value": "제과류", "label": "제과류", "callCount": 3 },
    { "value": "철강재", "label": "철강재", "callCount": 21 },
    { "value": "화학원료", "label": "화학원료", "callCount": 46 }
  ],
  "loadingMethods": [
    { "value": "수작업", "label": "수작업", "callCount": 7 },
    { "value": "지게차", "label": "지게차", "callCount": 12 },
    { "value": "호이스트", "label": "호이스트", "callCount": 2 }
  ],
  "unloadingMethods": [
    { "value": "수작업", "label": "수작업", "callCount": 7 },
    { "value": "지게차", "label": "지게차", "callCount": 13 },
    { "value": "호이스트", "label": "호이스트", "callCount": 1 }
  ],
  "paymentMethods": [
    { "value": "선불", "label": "선불", "callCount": 8 },
    { "value": "인수증후불", "label": "인수증후불", "callCount": 8 },
    { "value": "착불", "label": "착불", "callCount": 5 }
  ],
  "loadingWindowMinutes": [
    { "value": 30, "label": "30분", "callCount": 13 },
    { "value": 240, "label": "240분", "callCount": 3 }
  ],
  "routes": [
    {
      "routeId": "R01",
      "label": "부산신항 → 김포",
      "origin": "부산신항",
      "originRegion": "영남",
      "destination": "김포",
      "destinationRegion": "수도권",
      "distanceKm": 400,
      "standardHours": 6.5,
      "toll": 32800,
      "baseFareByTonnage": { "5": 368000, "11": 454000, "25": 596000 },
      "callCount": 21
    }
  ],
  "sampleCargo": {
    "callId": "C10373",
    "shipperId": "S260",
    "routeId": "R01",
    "origin": "부산신항",
    "originRegion": "영남",
    "destination": "김포",
    "destinationRegion": "수도권",
    "loadingAt": "2026-10-19T15:00:00+09:00",
    "loadingWindowMinutes": 30,
    "leadTimeHours": 28.3,
    "tonnage": 11,
    "bodyType": "카고",
    "vehicleType": "11t카고",
    "allowCompatibleVehicle": true,
    "item": "철강재",
    "weightKg": 6072,
    "pallets": 6,
    "baseFare": 454000,
    "offeredFare": 454000,
    "registrationActor": "원화주직접",
    "adjustmentPermissionApproved": true,
    "splitAllowed": false,
    "concurrentLoadAllowed": false,
    "waypointAllowed": false,
    "orderChangeAllowed": false,
    "loadingMethod": "지게차",
    "unloadingMethod": "수작업",
    "paymentMethod": "착불",
    "timeChangeCostPerHour": 12000
  },
  "warnings": []
}
```

`sampleCargo`는 현재 필터와 일치하면서 매칭 API의 입력 범위를 만족하는 실제 엑셀 콜 하나다. MVP에서는 여기에 `requestId`, `timeWindowOptionsMinutes`, `carrierLimit`만 더해 화주 매칭 API를 바로 시험할 수 있다.

## 4. POST /api/v1/matches/shipper

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
    "vehicleType": "11t카고",
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
    "unloadingMethod": "지게차",
    "paymentMethod": "인수증후불",
    "timeChangeCostPerHour": 0
  },
  "timeWindowOptionsMinutes": [180, 480, 1440, 2880],
  "carrierLimit": 5
}
```

### 응답 예시

아래 JSON은 이 문서의 요청 예시를 v13 생성 데이터와 저장된 학습 모델에 입력해 얻은 실제 응답이다. `generatedAt`만 문서 재현성을 위해 고정했다. 모델이나 데이터 버전이 바뀌면 수치는 달라질 수 있다.

```json
{
  "requestId": "shipper-demo-001",
  "matchId": "M-20260812-000001",
  "generatedAt": "2026-08-12T16:40:12+09:00",
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
    "candidateCount": 44,
    "expectedDispatchMinutes": 70,
    "expectedFare": {
      "point": 513579,
      "min": 454000,
      "max": 577212
    },
    "failureProbability": 0.10199407308190772,
    "confidence": 0.78
  },
  "timeWindowScenarios": [
    {
      "scenarioId": "WINDOW_180",
      "loadingWindowMinutes": 180,
      "candidateCount": 44,
      "expectedDispatchMinutes": 70,
      "expectedFare": {
        "point": 513579,
        "min": 454000,
        "max": 577212
      },
      "failureProbability": 0.10199407308190772,
      "confidence": 0.78
    },
    {
      "scenarioId": "WINDOW_480",
      "loadingWindowMinutes": 480,
      "candidateCount": 111,
      "expectedDispatchMinutes": 50,
      "expectedFare": {
        "point": 512910,
        "min": 454000,
        "max": 573493
      },
      "failureProbability": 0.09555396551106422,
      "confidence": 0.78
    },
    {
      "scenarioId": "WINDOW_1440",
      "loadingWindowMinutes": 1440,
      "candidateCount": 353,
      "expectedDispatchMinutes": 33,
      "expectedFare": {
        "point": 482714,
        "min": 454000,
        "max": 508891
      },
      "failureProbability": 0.014465205582949699,
      "confidence": 0.78
    },
    {
      "scenarioId": "WINDOW_2880",
      "loadingWindowMinutes": 2880,
      "candidateCount": 652,
      "expectedDispatchMinutes": 27,
      "expectedFare": {
        "point": 475342,
        "min": 454000,
        "max": 507252
      },
      "failureProbability": 0.004534240324079735,
      "confidence": 0.78
    }
  ],
  "recommendations": [
    {
      "type": "TIME_WINDOW",
      "description": "상차 가능 시간을 3시간에서 24시간으로 확대",
      "shipperAcceptanceProbability": 0.0498740259299625,
      "scenarioId": "WINDOW_1440",
      "candidateIncrease": 309,
      "dispatchMinutesChange": -37,
      "fareChange": -30865
    }
  ],
  "carriers": [
    {
      "carrierId": "D00051",
      "score": 87,
      "emptyDistanceKm": 6,
      "estimatedNetIncome": 237364,
      "preferenceMatches": ["영남 출발 적합", "수도권 도착 선호"],
      "warning": null
    },
    {
      "carrierId": "D04989",
      "score": 86,
      "emptyDistanceKm": 8,
      "estimatedNetIncome": 235264,
      "preferenceMatches": ["영남 출발 적합", "수도권 도착 선호"],
      "warning": null
    },
    {
      "carrierId": "D10450",
      "score": 86,
      "emptyDistanceKm": 8,
      "estimatedNetIncome": 235264,
      "preferenceMatches": ["영남 출발 적합", "수도권 도착 선호"],
      "warning": null
    },
    {
      "carrierId": "D03537",
      "score": 85,
      "emptyDistanceKm": 6,
      "estimatedNetIncome": 237364,
      "preferenceMatches": ["영남 출발 적합", "수도권 도착 선호"],
      "warning": null
    },
    {
      "carrierId": "D03629",
      "score": 85,
      "emptyDistanceKm": 7,
      "estimatedNetIncome": 236314,
      "preferenceMatches": ["영남 출발 적합", "수도권 도착 선호"],
      "warning": null
    }
  ],
  "explanationFacts": [
    "상차 가능 시간을 3시간에서 24시간으로 넓히면 후보 운송인이 44명에서 353명으로 증가합니다.",
    "같은 비교에서 예상 배차시간은 70분에서 33분으로 바뀝니다.",
    "예상 운임은 513579원에서 482714원으로 바뀌는 방향입니다."
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

## 5. GET /api/v1/matches/carrier/{carrier_id}

운송인 한 명에게 추천할 콜 목록을 점수 내림차순으로 반환한다.

선택 쿼리:

- `limit`: 1~20, 기본값 3

### 응답 예시

```json
{
  "carrierId": "D00051",
  "generatedAt": "2026-08-12T16:40:12+09:00",
  "recommendations": [
    {
      "callId": "C2890",
      "route": "대전유성 → 이천",
      "loadingTime": "2026-08-14T17:00:00+09:00",
      "emptyDistanceKm": 11,
      "durationHours": 3.3,
      "fare": 234000,
      "fuelCost": 77731,
      "emptyCost": 11550,
      "netIncome": 144719,
      "tags": ["선호 권역 일치"],
      "warning": null,
      "score": 88
    },
    {
      "callId": "C6197",
      "route": "대전유성 → 이천",
      "loadingTime": "2026-08-22T09:00:00+09:00",
      "emptyDistanceKm": 11,
      "durationHours": 3.3,
      "fare": 234000,
      "fuelCost": 77731,
      "emptyCost": 11550,
      "netIncome": 144719,
      "tags": ["선호 권역 일치"],
      "warning": null,
      "score": 88
    },
    {
      "callId": "C6247",
      "route": "대전유성 → 이천",
      "loadingTime": "2026-08-24T12:00:00+09:00",
      "emptyDistanceKm": 11,
      "durationHours": 3.3,
      "fare": 234000,
      "fuelCost": 77731,
      "emptyCost": 11550,
      "netIncome": 144719,
      "tags": ["선호 권역 일치"],
      "warning": null,
      "score": 88
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

## 6. POST /api/v1/matches/feedback

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

## 7. 공통 에러 응답

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

## 8. 숫자 단위와 범위

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

## 9. 프론트 표시 규칙

- `failureProbability === null`이면 유찰확률 UI와 자연어 문장을 표시하지 않는다.
- `shipperAcceptanceProbability === null`이면 수락확률을 표시하지 않는다.
- `warnings`는 사용자에게 그대로 보여주는 문장이 아니라 기능 비활성화·대체 문구 선택에 사용한다.
- 생성형 AI에는 `explanationFacts`와 구조화된 숫자만 전달하며, 새 숫자 계산을 요청하지 않는다.
- 콜 등록 선택지는 `/api/v1/catalog/options`의 `value`를 저장하고 `label`을 화면에 표시한다. 임의의 `기타` 값은 MVP 매칭 요청에 보내지 않는다.
- 사용자가 상위 선택을 바꾸어 기존 조합의 `selectionValid`가 `false`가 되면, 종속 선택값을 지우고 새 응답의 선택지만 표시한다.
