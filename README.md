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
