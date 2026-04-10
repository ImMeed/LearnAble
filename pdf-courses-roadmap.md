# PDF-to-Course Feature — Implementation Roadmap

**Companion document to:** [PRD_learnable_pdf_courses.md](PRD_learnable_pdf_courses.md)
**Approach:** Backend-first, then frontend. Each phase is independently testable — do not start phase N+1 until phase N is verified working.

> **Heads-up:** This roadmap assumes you're reusing the existing Gemini integration in [backend/app/modules/ai/repository.py](backend/app/modules/ai/repository.py) and the existing `settings.gemini_api_key` config field. No new SDK, no new config, no new module file in `ai/`. See Phase 0 and Phase 2.

---

## Phase 0 — Prerequisites & Setup

**Goal:** Confirm the existing Gemini integration is usable; no new dependencies.

> **Important:** Gemini is already wired into this codebase via [backend/app/modules/ai/repository.py](backend/app/modules/ai/repository.py) and `settings.gemini_api_key` already exists in [backend/app/core/config.py:12](backend/app/core/config.py#L12). **Do not add `google-generativeai` to `requirements.txt`.** Do not create a new config field. Reuse what's there.

### Tasks
1. Check `backend/.env` — if `GEMINI_API_KEY` is **not** already set, get a key from [aistudio.google.com](https://aistudio.google.com) (free tier) and add it.
2. Make sure `backend/.env.example` has `GEMINI_API_KEY=your_key_here` as a placeholder. Add it if missing.
3. Smoke-test the existing integration: from a Python shell inside the backend venv, call `app.modules.ai.repository.generate_text("Say hi", locale="en", mode="explain")` and confirm a real Gemini response comes back (not the fallback string). If you get the fallback, the key isn't loading — fix that before continuing.
4. **No pip install needed.** `httpx` is already in the dependency tree.
5. **No `config.py` change needed.** `settings.gemini_api_key` is already defined.

### Definition of Done
- `settings.gemini_api_key` is a non-empty string at runtime.
- A real Gemini text call succeeds from the backend shell.
- `requirements.txt` is unchanged from main.

---

## Phase 1 — Database Model & Migration

**Goal:** A `courses` table exists and can be inserted into manually.

### Tasks
1. Create `backend/app/db/models/course.py` with the `Course` SQLAlchemy model and `CourseStatus` enum (see PRD §5).
2. Import `Course` in `backend/app/db/models/__init__.py` so Alembic picks it up.
3. Generate the migration: `alembic revision --autogenerate -m "add courses table"`.
4. **Review the generated migration by hand** — check the enum type, JSONB column, foreign key, and the `(owner_user_id, status)` index.
5. Apply the migration: `alembic upgrade head`.
6. Verify with a manual insert via `psql` or a Python shell: insert one row with an empty `structure_json`, select it back.

### Definition of Done
- Migration runs cleanly up and down (`alembic downgrade -1 && alembic upgrade head`).
- Manual insert/select round-trip works.
- No other tables affected.

### Files touched
- `backend/app/db/models/course.py` (new)
- `backend/app/db/models/__init__.py`
- `backend/alembic/versions/<timestamp>_add_courses_table.py` (new)

---

## Phase 2 — Extend the Existing AI Module

**Goal:** Add a single `extract_course_structure(pdf_bytes, language)` function **inside the existing** [backend/app/modules/ai/repository.py](backend/app/modules/ai/repository.py), alongside `generate_text()`. No new files in the `ai` module.

### Tasks
1. Open `backend/app/modules/ai/repository.py` and add:
   - New custom exceptions: `GeminiError(Exception)`, `GeminiParseError(GeminiError)`.
   - New function `extract_course_structure(pdf_bytes: bytes, language: str) -> dict` that:
     - Checks `settings.gemini_api_key` — raises `GeminiError("missing api key")` if empty. **No fallback** like `_fallback_completion` — structure extraction cannot be faked.
     - Base64-encodes the PDF bytes.
     - Builds the request body with `inlineData` (PDF) + `text` (prompt) parts in `contents[0].parts`, and sets `generationConfig.responseMimeType = "application/json"`, `temperature = 0.1`, `maxOutputTokens = 8192`.
     - POSTs to the same `_GEMINI_BASE_URL` + `_GEMINI_MODEL` endpoint pattern already in the file.
     - Uses a longer `httpx` timeout (e.g. `60.0`) since PDF analysis is slower than short text generation. Keep `generate_text()`'s `20.0` timeout unchanged.
     - Extracts `candidates[0].content.parts[0].text` the same way the existing function does.
     - Strips any accidental ` ```json ... ``` ` fences as a safety net.
     - `json.loads` the result — on failure, raise `GeminiParseError`.
     - Returns the raw dict. **Validation into Pydantic schemas happens in the service layer**, not here — keeps this module free of domain types.
2. Extract the shared prompt text into a small module-level constant or a tiny helper (`_build_extraction_prompt(language: str) -> str`) so it's easy to tune without touching the HTTP logic. Prompt content: see PRD §7.
3. Add module-level constants if it helps readability: `_EXTRACTION_TIMEOUT_S: Final = 60.0`, `_EXTRACTION_MAX_TOKENS: Final = 8192`.
4. **Do not** change or touch the existing `generate_text()` or `_fallback_completion()` — additive only.
5. Write a **manual** test script `backend/scripts/test_gemini_extract.py` that reads a real PDF from disk and prints the returned dict. Not added to `pytest` — it hits the real API and is gitignored via existing `scripts/` patterns if any, otherwise add it to `.gitignore`.

### Definition of Done
- `from app.modules.ai.repository import extract_course_structure, GeminiError, GeminiParseError` works.
- Running the test script on a small **English** PDF prints a sensible chapter/section dict.
- Running it on a small **Arabic** PDF returns Arabic text, correctly rendered (no RTL mangling).
- Running it on a non-PDF file (e.g. a `.txt` renamed to `.pdf`) raises `GeminiError` or `GeminiParseError` — does not crash the process.
- Running it with an empty `GEMINI_API_KEY` raises `GeminiError` immediately (no network call).
- The existing `generate_text()` path still works — quick smoke test from the shell confirms it.
- `requirements.txt` is still unchanged.

### Files touched
- `backend/app/modules/ai/repository.py` (extended — additive only)
- `backend/scripts/test_gemini_extract.py` (new, manual test)

---

## Phase 3 — Courses Module (Repository + Service + Schemas)

**Goal:** All business logic for courses exists as plain Python functions, unit-testable without FastAPI.

### Tasks
1. Create `backend/app/modules/courses/` directory with `__init__.py`, `schemas.py`, `repository.py`, `service.py`, `router.py`.
2. `schemas.py` — Pydantic request/response models:
   - `CourseCreateResponse`, `CourseListItem`, `CourseDetailResponse`
   - `CourseStructureUpdate` (for PATCH), `CourseMetadataUpdate`
   - Reuse `CourseStructure` from the Gemini module for validation of structure updates.
3. `repository.py` — thin SQLAlchemy functions:
   - `create_course(session, owner_id, title, language, filename, page_count, structure) -> Course`
   - `get_course_by_id(session, id) -> Course | None`
   - `list_courses_by_owner(session, owner_id) -> list[Course]`
   - `list_published_courses(session, language: str | None) -> list[Course]`
   - `update_course(session, course, **fields) -> Course`
   - `delete_course(session, course) -> None`
4. `service.py` — orchestration layer called by the router:
   - `create_course_from_pdf(session, current_user, file, title, language)`:
     - Validate file type / size (raise HTTP-mapped exceptions).
     - Read bytes into memory.
     - Call `ai.repository.extract_course_structure(pdf_bytes, language)` → raw dict.
     - **Validate the raw dict against Pydantic schemas** (`CourseStructure` / `Chapter` / `Section` / `Subsection`) defined in `courses/schemas.py`. On failure, raise `HTTPException(502, "Failed to parse course structure, please try again")`.
     - Validate page count ≤ 30; reject otherwise.
     - Call a local helper `assign_ids(validated_structure) -> dict` to assign stable `c{n}`, `c{n}s{m}`, `c{n}s{m}_{k}` IDs. This helper lives in `courses/service.py` — not in the `ai` module.
     - Persist via repository.
     - Return the response model.
     - **Discard bytes** (Python GC handles this — no explicit cleanup needed).
   - `get_course_for_teacher(session, current_user, id)` — owner check.
   - `list_teacher_courses(session, current_user)`.
   - `update_course_structure(session, current_user, id, payload)` — owner check.
   - `publish_course(session, current_user, id)` — owner check, idempotent.
   - `delete_course(session, current_user, id)` — owner check.
   - `list_published_courses(session, language)`.
   - `get_published_course(session, id)` — raises 404 for DRAFT.

### Definition of Done
- Each service function has a docstring describing its inputs, outputs, and which exceptions it raises.
- All owner checks raise a clear `HTTPException(403)`.
- Nothing in this phase touches FastAPI request/response objects directly — all inputs come in as plain types.

### Files touched
- `backend/app/modules/courses/__init__.py` (new)
- `backend/app/modules/courses/schemas.py` (new)
- `backend/app/modules/courses/repository.py` (new)
- `backend/app/modules/courses/service.py` (new)

---

## Phase 4 — Courses Module (Router)

**Goal:** All endpoints from PRD §6 work end-to-end via `curl` or the FastAPI `/docs` UI.

### Tasks
1. Implement all teacher endpoints in `backend/app/modules/courses/router.py`:
   - `POST /teacher/courses` — multipart with `UploadFile`, calls `create_course_from_pdf`.
   - `GET /teacher/courses`
   - `GET /teacher/courses/{id}`
   - `PATCH /teacher/courses/{id}`
   - `POST /teacher/courses/{id}/publish`
   - `DELETE /teacher/courses/{id}`
2. Implement student endpoints:
   - `GET /courses` (with optional `language` query param)
   - `GET /courses/{id}`
3. All endpoints use `Depends(require_roles(...))` as existing modules do.
4. Register the router in `backend/app/api.py` (or wherever routers are registered — match existing pattern).
5. **Manual test via `/docs`:**
   - Log in as a teacher, upload a PDF, verify DRAFT course is created.
   - Edit the structure via PATCH, verify it persists.
   - Publish, verify status changes.
   - Log in as a student, verify the course appears in `/courses` and is fetchable by id.
   - Verify a second teacher cannot edit or delete the first teacher's course (403).
   - Verify a student cannot GET a DRAFT course (404).
   - Verify uploading an 11 MB file returns 413.
   - Verify uploading a non-PDF returns 400.

### Definition of Done
- All manual test scenarios above pass.
- `backend/app/api.py` includes the new router.
- No 500s for any of the documented error cases — all return 4xx/5xx with a meaningful `detail`.

### Files touched
- `backend/app/modules/courses/router.py` (new)
- `backend/app/api.py`

---

## Phase 5 — Automated Tests (Backend)

**Goal:** A minimal but real test suite for the courses module, following existing test patterns in `backend/tests/`.

### Tasks
1. Look at an existing test file in `backend/tests/` to match the fixtures and DB setup style.
2. Write tests for the **repository layer** — pure DB round-trips, no mocks.
3. Write tests for the **service layer** with Gemini **mocked** (monkeypatch `extract_course_structure`). Cover:
   - Happy path: creates a course, assigns IDs, returns the response.
   - File too big → 413.
   - Non-PDF → 400.
   - Owner check rejections → 403.
   - Publish is idempotent.
4. Write tests for the **router layer** using FastAPI's `TestClient`, also with Gemini mocked. Cover:
   - Teacher happy path: upload → list → review → publish.
   - Student happy path: list → get published.
   - Student cannot see DRAFT (404).
5. Skip: anything that requires hitting the real Gemini API. Those stay in `scripts/` as manual tests.

### Definition of Done
- `pytest backend/tests/test_courses.py` passes.
- No tests hit the real Gemini API.
- Coverage includes all error paths listed in PRD §6.

### Files touched
- `backend/tests/test_courses.py` (new)

---

## Phase 6 — Frontend: Teacher Upload UI

**Goal:** A teacher can upload a PDF from the dashboard and land on the review page.

### Tasks
1. Add a new "Courses" tab key to the `TeacherTab` type and `TeacherTabs` list in [roleDashboardShared.tsx](frontend/src/app/pages/roleDashboardShared.tsx).
2. Add a new `courses` case in [TeacherDashboard.tsx](frontend/src/app/pages/TeacherDashboard.tsx)'s tab switcher.
3. Create a new component `frontend/src/app/pages/teacher/CoursesTab.tsx` containing:
   - Upload form: title input, language `<select>`, `<input type="file" accept="application/pdf">`, submit button.
   - Client-side validation: file exists, is PDF, ≤ 10 MB. Show error inline before submitting.
   - Loading state: spinner + "Analyzing your PDF…" while the request is in flight. Button disabled.
   - On success: `navigate` to `/teacher/courses/{id}/review`.
   - On failure: show the error detail from the backend response.
4. Below the form: fetch and display the teacher's courses list.
   - For each course row: title, status badge, page count, created date, and action buttons (Review, Publish if draft, Delete).
5. Add i18n keys for all new strings in both `ar` and `en` in [i18n.ts](frontend/src/app/i18n.ts).

### Definition of Done
- Upload → success → browser navigates to the review page (which may be a placeholder until Phase 7).
- Upload → failure → error displayed cleanly.
- Existing teacher dashboard tabs still work.
- No console errors.
- Strings work in both AR and EN.

### Files touched
- `frontend/src/app/pages/teacher/CoursesTab.tsx` (new)
- `frontend/src/app/pages/TeacherDashboard.tsx`
- `frontend/src/app/pages/roleDashboardShared.tsx`
- `frontend/src/app/i18n.ts`
- `frontend/src/app/router.tsx` (if new routes need to be registered)

---

## Phase 7 — Frontend: Teacher Review/Edit UI

**Goal:** A teacher can review the auto-detected structure, edit it, save, and publish.

### Tasks
1. Create `frontend/src/app/pages/teacher/CourseReviewPage.tsx` and register it in [router.tsx](frontend/src/app/router.tsx) at `/teacher/courses/:id/review`.
2. Fetch the course via `GET /teacher/courses/:id` on mount.
3. Build the tree sidebar:
   - Chapters at the top level, sections nested, subsections nested under sections.
   - Clicking any node selects it (updates right-panel state).
   - Hover actions on each node: rename (inline input), delete (with confirm).
4. Build the right-panel editor:
   - Title input for the selected node.
   - `<textarea>` for `content` (sections and subsections only — chapters are title-only).
   - "Save" button → `PATCH /teacher/courses/:id` with the full updated `structure_json`. (Sending the whole tree is fine at MVP scale; no diffing needed.)
5. Header: editable course title, "Publish Course" button.
   - Publish button → `POST /teacher/courses/:id/publish` → navigates back to the dashboard courses tab.
6. Add i18n keys for all new strings in both languages.

### Definition of Done
- A teacher can upload a PDF, land on the review page, rename a chapter, edit a section's content, save, and publish — and the changes are visible to students.
- Deleting a node works and updates the tree immediately.
- No state is lost on save (the page refetches the server's version after each PATCH).
- RTL layout works when editing an Arabic course.

### Files touched
- `frontend/src/app/pages/teacher/CourseReviewPage.tsx` (new)
- `frontend/src/app/router.tsx`
- `frontend/src/app/i18n.ts`

---

## Phase 8 — Frontend: Student Course List & View

**Goal:** Students can browse and navigate published courses.

### Tasks
1. Create `frontend/src/app/pages/student/CourseListPage.tsx` at `/courses`.
   - Fetch `GET /courses`, render a grid of cards (title, language badge, page count, "Open" button).
   - Optional filter by language (the user's current locale by default, with a toggle to "show all languages").
2. Create `frontend/src/app/pages/student/CourseViewPage.tsx` at `/courses/:id`.
   - Fetch `GET /courses/:id`.
   - Reuse the layout of [CoursePage.tsx](frontend/src/app/pages/CoursePage.tsx) — same header, sidebar, content panel.
   - Replace the flat `parseSections` logic with a recursive tree renderer:
     - Sidebar shows chapters → sections → subsections in a nested expandable list.
     - Main panel shows the selected node's `title` + `content`.
   - Show a banner at the top if `course.language` differs from the user's current locale ("This course is available in Arabic.").
3. Register both routes in [router.tsx](frontend/src/app/router.tsx) for both `ar` and `en` locale prefixes.
4. Add i18n keys.
5. Add a link to `/courses` from the Student Dashboard.

### Definition of Done
- A student can click the new "Courses" link, see the list, open a course, and navigate all chapters/sections/subsections.
- The language banner appears only when the course language ≠ current locale.
- Layout is not broken in RTL mode.
- Reading flow matches the existing lesson CoursePage "feel" — sidebar + main content.

### Files touched
- `frontend/src/app/pages/student/CourseListPage.tsx` (new)
- `frontend/src/app/pages/student/CourseViewPage.tsx` (new)
- `frontend/src/app/pages/StudentDashboard.tsx` (add link)
- `frontend/src/app/router.tsx`
- `frontend/src/app/i18n.ts`

---

## Phase 9 — End-to-End Verification

**Goal:** Walk the entire flow as a real user, in both languages, and catch anything the earlier phases missed.

### Manual test checklist

**English PDF flow:**
- [ ] Log in as a teacher.
- [ ] Upload a 5–15 page English PDF textbook chapter.
- [ ] See the loading state. Wait for success.
- [ ] Land on the review page. Verify the chapters/sections match the source.
- [ ] Rename one chapter.
- [ ] Edit one section's content.
- [ ] Delete one subsection.
- [ ] Save. Refresh the page. Verify changes persisted.
- [ ] Publish.
- [ ] Log out, log in as a student.
- [ ] Open `/courses`. See the new course.
- [ ] Open the course. Navigate chapters → sections → subsections. All content displays correctly.

**Arabic PDF flow:**
- [ ] Repeat the full flow with a 5–15 page Arabic PDF.
- [ ] Verify text is rendered correctly (RTL, no broken ligatures).
- [ ] Verify the review page layout works in RTL.
- [ ] Verify the student view layout works in RTL.

**Error cases:**
- [ ] Upload a 12 MB file → clear error, no crash.
- [ ] Upload a .docx file → clear error, no crash.
- [ ] Upload a 50-page PDF → clear error after Gemini returns.
- [ ] Second teacher tries to edit first teacher's course via direct API call → 403.
- [ ] Student tries to open a DRAFT course via direct URL → 404.

**Ownership:**
- [ ] Verify that a teacher only sees their own courses in the Courses tab.
- [ ] Verify that all students see all published courses.

### Definition of Done
- Every checklist item passes.
- No 500 errors in the backend logs during the test run.
- No uncaught exceptions in the browser console.

---

## Phase 10 — Polish & Cleanup

**Goal:** Merge-ready.

### Tasks
1. Remove any `print()` statements or debug logging left in the Gemini module.
2. Make sure `backend/media/` is **not** created or referenced anywhere (we're not storing PDFs).
3. Double-check `.env.example` has the `GEMINI_API_KEY` placeholder.
4. Verify `backend/.env` is still gitignored.
5. Update `README.md` with a one-paragraph description of the new feature and where to get a Gemini API key.
6. Run the full backend test suite one last time.
7. Run the frontend build (`npm run build`) to catch TypeScript errors.
8. Commit in logical chunks (model + migration, Gemini client, courses module, frontend upload, frontend review, frontend student view).

### Definition of Done
- `pytest` passes.
- `npm run build` succeeds without warnings related to the new code.
- README mentions the feature.
- No stray files in the working tree.
- All commits follow the repo's existing commit message style.

---

## Rough phase ordering summary

```
Phase 0: Setup                     ── blocker for everything
Phase 1: DB model                  ── blocker for Phase 3+
Phase 2: Gemini client             ── can be done in parallel with Phase 1
Phase 3: Courses service/repo      ── needs Phases 1 and 2
Phase 4: Courses router            ── needs Phase 3
Phase 5: Backend tests             ── needs Phase 4
Phase 6: Frontend upload           ── needs Phase 4 (backend must work)
Phase 7: Frontend review           ── needs Phase 6 (landing point)
Phase 8: Frontend student view     ── can be done in parallel with Phase 7
Phase 9: E2E verification          ── needs Phases 6, 7, 8
Phase 10: Polish                   ── last
```

## What can go wrong, and what to do

| Risk | Mitigation |
|---|---|
| Gemini returns malformed JSON | `GeminiParseError` → HTTP 502, teacher retries. Don't auto-retry in MVP. |
| Gemini takes > 60s on a 30-page PDF | Cap at 30 pages and watch during Phase 2 testing. If consistently slow, drop the cap to 20. |
| Arabic text comes back mangled | Unlikely with Gemini vision, but if it happens → test with explicit `"The document is in Arabic"` line in the prompt. |
| Gemini free tier rate limit hit during testing | Add a log line on each call; if you see 429s, space out test uploads. |
| Teacher uploads sensitive content | Out of scope for MVP. The disclaimer on the upload form is the MVP answer. |
| PDF is a scanned image | Gemini may return empty structure or low-quality extraction. The review UI lets the teacher see and delete it. |
| Review UI's full-tree PATCH has race conditions (two tabs open) | Last-write-wins. Acceptable for MVP since only the owner can edit. |

---

## Out of this roadmap

Anything listed in PRD §10 ("Out of Scope") and PRD §12 ("Future Improvements") is **not** part of this roadmap. Do not let scope drift into those items during implementation — file them as follow-up issues instead.
