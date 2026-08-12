# Mov!n — AI 배차 코파일럿

화주·주선사가 화물 조건을 입력하는 순간 조건 완화에 따른 수락가능 차주, 예상 운임, 배차 시간을 비교하고, 운송인은 정차 후 다음 콜의 실수령·공차·귀가 가능성을 비교하는 해커톤 데모입니다.

## 구현 화면

- 화주·주선사: 대시보드, 화물 조건 수정, 조건 비교, 등록 완료 상태, 월간 탄소 리포트, 도움말
- 운송인: 운행 브리핑, 다음 콜 3건 기회비용 비교, 콜 선택, 운행 현황, 월간 성과, 선호 정보
- 탄소 리포트: 국내 경유 배출계수 2.609 kg CO₂/L, 톤급별 연비 환산, 방식 B 조건 개방 실현량 673.5 tCO₂

프론트엔드는 React + Vite + TypeScript로 구성됩니다. 선호 조건·콜 정보·최근 선택은 브라우저 로컬 상태로 동작하고, 리포트의 자연어 설명은 Vercel 서버 함수에서 Gemini Flash를 호출합니다. 키가 없는 로컬 환경에서는 같은 자료 범위의 고정 근거 요약으로 자동 대체됩니다.

## 로컬 실행

```bash
cd frontend
pnpm install
pnpm dev
```

프로덕션 빌드 확인:

```bash
cd frontend
pnpm build
pnpm lint
```

## Vercel 배포

저장소 루트를 Vercel 프로젝트에 연결하면 루트 `vercel.json`이 `frontend` 설치·빌드·출력 경로를 자동으로 사용합니다. Gemini 서버 함수가 루트 `api/insights.ts`에 있으므로 Vercel의 Root Directory는 `frontend`가 아니라 **저장소 루트**로 두세요.

Vercel 프로젝트의 환경 변수에 아래 두 값을 설정합니다. API 키는 `VITE_` 접두사를 붙이지 않으며 브라우저 번들에 포함되지 않습니다.

```text
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.6-flash
```

현재 Gemini API 지원 모델 기준으로 기본값은 `gemini-3.6-flash`입니다. 다른 Flash 모델을 사용할 때는 코드 수정 없이 `GEMINI_MODEL`만 변경할 수 있습니다.

실제 FastAPI 예측 서버를 연결할 때는 프론트엔드에 공개 API 주소만 주입하고, 모델 키와 데이터베이스 자격증명은 Vercel 또는 백엔드 서버의 비밀 환경변수로 유지하세요.

## 구조

```text
.
├── ai/               # 모델·추론 확장 영역
│   ├── generate_data.py  # 가상데이터 생성기
│   └── notebooks/         # phase1~5 분석 노트북
├── backend/     # FastAPI API 골격
├── frontend/    # React 제품 데모
├── api/         # Vercel Gemini 자료 해석 함수
└── vercel.json  # 저장소 루트 배포 설정
```

## 배포

모노레포이므로 각 플랫폼에서 서비스별 Root Directory를 지정해야 합니다.

### Railway (backend)
- Root Directory: `backend`
- 빌드: Nixpacks가 `pyproject.toml` + `uv.lock`을 감지해 자동으로 `uv sync` 실행
- 시작 커맨드: `backend/Procfile`에 정의됨 (`uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT`)
- 환경 변수: `backend/.env.example` 참고, `CORS_ORIGINS`에 Vercel 배포 URL 추가

### Vercel (frontend)
- Root Directory: 저장소 루트
- 빌드 설정: 루트 `vercel.json` 사용
- 환경 변수: `GEMINI_API_KEY`, `GEMINI_MODEL=gemini-3.6-flash`
- 이유: Gemini 호출 함수가 루트의 `api/insights.ts`에 있고, 키를 브라우저에 노출하지 않기 위해서입니다.
