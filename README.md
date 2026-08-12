# mock-hackathon

## 구조

```
.
├── ai/          # AI 모델/추론 스크립트 (Python)
├── backend/     # FastAPI 서버
└── frontend/    # React + Vite + TS
```

## 실행

### backend
```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

### frontend
```bash
cd frontend
npm install
npm run dev
```

### ai
```bash
cd ai
uv sync
uv run python src/main.py
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
