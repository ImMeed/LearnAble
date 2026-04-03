# LearnAble (MVP)

Arabic-first learning platform for neurodivergent learners.

## Stack

- Frontend: React + Vite + TypeScript
- Backend: FastAPI
- Database: PostgreSQL

## Backend Status (Implemented Now)

Phase status in repository reports: Phase 1 through Phase 10 are marked READY.

### 1. Core API, Security, and Localization

- FastAPI app with modular routers for auth, users, study, quiz, gamification, forum, library, notifications, AI, teacher, and psychologist flows.
- JWT authentication with role-aware authorization model.
- Supported roles: student, tutor, admin, parent, psychologist.
- Localized backend responses with AR/EN locale resolution middleware and structured error payloads.
- Startup security hardening for JWT secret validation.

### 2. Study and Accessibility Learning Flow

- Student screening completion flow.
- Lessons listing and detail retrieval.
- Lesson assist endpoint (learning support modes).
- Flashcards generation/read APIs for lessons.
- Reading games APIs for lessons.
- Educational awareness content endpoint.

### 3. Quiz, Economy, and XP

- Quiz domain with quiz/question/attempt persistence.
- Authenticated quiz play lifecycle endpoints.
- Backend-authoritative reward operations.
- Wallet + points ledger + XP ledger write path.
- Hint penalty transaction support.
- Core economy invariants enforced in backend transaction flow.

### 4. Library and Entitlements

- Books catalog and book details endpoints.
- Atomic redeem flow in one transaction:
	- points debit
	- points ledger append
	- purchase entitlement creation
- My library listing and read entitlement checks.

### 5. Teacher Supervision

- Teacher dashboard endpoints for supervision signals.
- Assistance request and scheduling workflow endpoints.
- End-of-lesson and assessment feedback prompt APIs.
- Teacher presence indicator support.

### 6. Psychologist + Parent Workflow

- Teacher questionnaire submission for psychologist review.
- Psychologist student review endpoint.
- Psychologist support confirmation endpoint.
- Parent notification gating enforced: parent-facing support notifications are created only after psychologist confirmation.

### 7. Notifications

- Real authenticated notification APIs:
	- list notifications
	- mark notification as read
- AR/EN localized notification messaging support.

### 8. Forum Collaboration (MVP)

- Forum spaces, posts, comments, votes, and moderation reports.
- Moderation-oriented role guards.
- Vote uniqueness and core forum indexes in schema.

### 9. AI Educational Support

- Explain and translate endpoints with locale-aware behavior.
- AI policy layer enforcing educational-only and no-diagnosis constraints.
- Input and output policy checks applied before response.

### 10. Data, Migrations, and Verification

- Alembic migration chain through forum and psychologist workflows.
- Bilingual seed scripts (Arabic-primary and English-primary).
- Phase verification suite includes:
	- transaction integrity
	- role guard checks
	- entitlement checks
	- psychologist-parent gating checks
	- localization checks
	- AI policy checks

## Backend Features Planned for Future (Post-MVP)

- Advanced auth hardening:
	- email verification
	- password reset flows
	- optional CAPTCHA and 2FA
	- login audit history
- Advanced gamification:
	- richer level progression logic
	- badge and reward chain expansion
	- milestone and achievement depth
- Forum parity enhancements:
	- accepted solution workflows
	- richer filtering/search
	- optional OpenGraph preview support
	- optional moderation/censorship pipeline upgrades
- Teacher and psychologist workflow scaling:
	- automated scheduler execution for questionnaire cadence
	- async/batched notification fan-out for high-volume usage
- Optional emotional recognition during teacher-assisted calls (feature-flag candidate).
- Phase 11+ platform enhancements:
	- analytics and deeper reporting
	- admin operations enhancements
	- performance optimization and observability improvements

## Local Development

### First Pull Setup (Required)

Run this once after your first clone/pull so your local DB schema matches the current backend head.

1. Start PostgreSQL (Docker):

```bash
docker compose up -d
```

2. Configure backend environment:

```bash
cd backend
cp ../.env.example .env
```

PowerShell equivalent:

```powershell
Set-Location backend
Copy-Item ..\.env.example .env
```

3. Install backend dependencies:

```bash
cd backend
pip install -r requirements.txt
```

4. Apply migrations to latest head:

```bash
cd backend
alembic upgrade head
```

5. Verify migration state (optional but recommended):

```bash
cd backend
alembic current
alembic heads
```

6. Run backend:

```bash
cd backend
uvicorn app.main:app --reload
```

7. Run frontend:

```bash
cd frontend
npm install
npm run dev
```

Notes:

- `DATABASE_URL` is read from `backend/.env` via app settings (used by Alembic and runtime).
- Docker maps PostgreSQL to `localhost:5433`, which matches `.env.example`.
- `JWT_SECRET_KEY` must be present in `.env` and at least 32 characters.

## Implemented in this phase

- FastAPI app scaffold with module routers
- JWT auth (register/login)
- Single-role model and role-aware profile endpoints
- Core SQLAlchemy models (users, links, wallet/ledger, notifications)
- React Arabic RTL shell with feature route placeholders
