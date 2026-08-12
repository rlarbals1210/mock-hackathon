# Mov!n — AI 배차 코파일럿

화주·주선사가 화물 조건을 입력하는 순간 조건 완화에 따른 수락가능 차주, 예상 운임, 배차 시간을 비교하고, 운송인은 정차 후 다음 콜의 실수령·공차·귀가 가능성을 비교하는 해커톤 데모입니다.

## 구현 화면

- 화주·주선사: 대시보드, 화물 조건 수정, 조건 비교, 등록 완료 상태, 월간 탄소 리포트, 도움말
- 운송인: 운행 브리핑, 다음 콜 3건 기회비용 비교, 콜 선택, 운행 현황, 월간 성과, 선호 정보
- 탄소 리포트: 국내 경유 배출계수 2.609 kg CO₂/L, 톤급별 연비 환산, 방식 B 조건 개방 실현량 673.5 tCO₂

프론트엔드는 React + Vite + TypeScript로 구성되며, 데모 상호작용은 브라우저 로컬 상태로 동작합니다. 백엔드와 AI 폴더는 이후 실제 예측 API 연결을 위한 골격입니다.

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

저장소 루트를 Vercel 프로젝트에 연결하면 루트 `vercel.json`이 `frontend` 설치·빌드·출력 경로를 자동으로 사용합니다. 현재 버전은 정적 SPA라 별도 환경변수나 서버 비밀값이 필요하지 않습니다.

실제 FastAPI 예측 서버를 연결할 때는 프론트엔드에 `VITE_API_BASE_URL` 같은 공개 API 주소만 주입하고, 모델 키와 데이터베이스 자격증명은 Vercel 또는 백엔드 서버의 비밀 환경변수로 유지하세요.

## 구조

```text
.
├── ai/               # 모델·추론 확장 영역
│   ├── generate_data.py  # 가상데이터 생성기
│   └── notebooks/         # phase1~5 분석 노트북
├── backend/     # FastAPI API 골격
├── frontend/    # React 제품 데모
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
- Root Directory: `frontend`
- Framework: Vite (자동 감지, `frontend/vercel.json`에 명시)
- 환경 변수: `VITE_API_URL`을 Railway 백엔드 URL로 설정 (`frontend/.env.example` 참고)
