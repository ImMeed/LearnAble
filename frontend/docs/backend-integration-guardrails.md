# Frontend Backend Integration Guardrails

This document freezes the backend-facing contracts that the frontend must preserve during the UI polish and CSS-to-Tailwind migration work.

## Do Not Change Without Explicit Review

- API base env var: `VITE_API_BASE_URL`
- ICE server env var: `VITE_ICE_SERVERS`
- Session storage key: `learnable_session`
- Locale storage key: `learnable_locale`
- Onboarding storage keys:
  - `learnable_onboarding_name`
  - `learnable_onboarding_answers`
  - `learnable_onboarding_pending`
- Accessibility storage key: `learnable_accessibility_settings`
- Active route names:
  - `/`
  - `/login`
  - `/call`
  - `/call/:roomId`
  - `/student/onboarding`
  - `/student/dashboard`
  - `/student/course/:id`
  - `/teacher/dashboard`
  - `/parent/dashboard`
  - `/psychologist/dashboard`
  - `/admin/dashboard`
- Locale-prefixed route variants:
  - `/ar/...`
  - `/en/...`
- Session payload shape persisted by the frontend:
  - `{ accessToken: string, role: string }`
- Locale request header:
  - `x-lang: "ar" | "en"`

## Contract-Sensitive Frontend Files

These files should be treated as backend-touching and refactored carefully:

- `src/api/client.ts`
- `src/api/callApi.ts`
- `src/state/auth.ts`
- `src/app/router.tsx`
- `src/features/auth/ProtectedRoute.tsx`
- `src/app/pages/LoginPage.tsx`
- `src/app/pages/StudentOnboarding.tsx`
- `src/app/pages/StudentDashboard.tsx`
- `src/app/pages/CoursePage.tsx`
- `src/app/pages/TeacherDashboard.tsx`
- `src/app/pages/ParentDashboard.tsx`
- `src/app/pages/PsychologistDashboard.tsx`
- `src/app/pages/AdminDashboard.tsx`
- `src/pages/CallPage.tsx`
- `src/hooks/useSignaling.ts`
- `src/hooks/useWebRTC.ts`

## Current Backend Endpoints Used by the Active Frontend

### Auth and Session

- `POST /auth/register`
  - Request body:
    - `email: string`
    - `password: string`
    - `role: string`
  - Response:
    - `access_token: string`
    - `role: string`
- `POST /auth/login`
  - Request body:
    - `email: string`
    - `password: string`
  - Response:
    - `access_token: string`
    - `role: string`

### Call Flow

- `POST /calls/rooms`
  - Response:
    - `room_id: string`
- `GET /teacher/presence/active`
  - Response:
    - `{ items: Array<{ tutor_user_id: string, updated_at: string }> }`
- `POST /teacher/assistance/requests`
  - Request body may include:
    - `topic: string`
    - `message: string`
    - `preferred_at?: string`
    - `lesson_id?: string`
- `GET /teacher/assistance/requests`
  - Response:
    - `{ items: AssistanceRequestItem[] }`
- `PATCH /teacher/assistance/requests/:id/schedule`
  - Request body:
    - `scheduled_at: string`
    - `meeting_url: string`
- `PATCH /teacher/assistance/requests/:id/complete`
- WebSocket:
  - `/ws/call/:roomId`
  - Optional token query param from `learnable_session.accessToken`

### Study

- `POST /study/screening/complete`
  - Request body:
    - `focus_score: number`
    - `reading_score: number`
    - `memory_score: number`
    - `notes: string`
- `GET /study/lessons`
- `GET /study/lessons/:id`
- `GET /study/lessons/:id/flashcards`
- `GET /study/lessons/:id/games`
- `POST /study/lessons/:id/assist`
  - Request body:
    - `mode: string`
    - `question: string`

### Gamification

- `GET /gamification/progression/me`

### User and Notifications

- `GET /me`
- `GET /tutor/profile`
- `GET /parent/profile`
- `GET /notifications`
- `PATCH /notifications/:id/read`

### Psychologist

- `GET /psychologist/reviews/students`
- `GET /psychologist/reviews/students/:id`
- `POST /psychologist/support/:id/confirm`
  - Request body:
    - `support_level: string`
    - `notes: string`

### Admin and Forum

- `GET /forum/spaces`
- `GET /forum/reports`
- `POST /forum/reports/:id/moderate`
  - Request body:
    - `action: "HIDE" | "RESTORE" | "REMOVE" | "DISMISS"`
    - `review_notes: string`

## Refactor Rules

- Reuse the existing axios client and interceptor.
- Do not rename routes or route parameters.
- Do not rename env vars.
- Do not change persisted storage key names.
- Do not change request or response field names without backend review.
- Keep locale behavior based on `x-lang` and `/ar` `/en` path prefixes.
- Treat `CallPage`, signaling, and WebRTC as isolated high-risk surfaces.
- Remove legacy frontend code only after the active route path has already been migrated and verified.
