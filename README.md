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
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
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
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python src/main.py
```
