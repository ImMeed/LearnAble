# LearnAble (MVP)

Arabic-first learning platform for neurodivergent learners.

## Stack

- Frontend: React + Vite + TypeScript
- Backend: FastAPI
- Database: PostgreSQL

## Local Development

1. Start PostgreSQL:

```bash
docker compose up -d
```

2. Run backend:

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:asgi_app --reload
```

3. Run frontend:

```bash
cd frontend
npm install
npm run dev
```

## Implemented in this phase

- FastAPI app scaffold with module routers
- JWT auth (register/login)
- Single-role model and role-aware profile endpoints
- Core SQLAlchemy models (users, links, wallet/ledger, notifications)
- React Arabic RTL shell with feature route placeholders
