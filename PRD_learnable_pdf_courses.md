# PRD: PDF-to-Structured-Course Feature
### LearnAble Platform — MVP Feature

**Version:** 1.0
**Status:** Ready for Development
**Scope:** MVP — Teachers upload a PDF, Gemini converts it into a structured, navigable web course. No PDF file storage, single-language per course, Gemini-powered structure detection.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Goals & Non-Goals](#2-goals--non-goals)
3. [User Stories](#3-user-stories)
4. [System Architecture](#4-system-architecture)
5. [Data Model](#5-data-model)
6. [Backend API Surface](#6-backend-api-surface)
7. [Gemini Integration](#7-gemini-integration)
8. [Frontend UX](#8-frontend-ux)
9. [Constraints & Limits](#9-constraints--limits)
10. [Out of Scope (MVP)](#10-out-of-scope-mvp)
11. [Success Criteria](#11-success-criteria)
12. [Future Improvements](#12-future-improvements)

---

## 1. Overview

### Problem Definition

Teachers on LearnAble currently have no way to publish long-form structured learning material. The existing `Lesson` entity holds a single short text body (`String(4000)`) split into paragraphs on the frontend — enough for a micro-lesson, but not for a real chapter or textbook section.

Teachers already have their teaching material as PDFs (textbook chapters, handouts, lecture notes). Today they would have to manually copy-paste and re-format that content to make it a lesson. This is friction that blocks content creation.

### What This Feature Does

A teacher uploads a PDF through the Teacher Dashboard. The backend sends the PDF directly to the Google Gemini API, which returns a structured JSON tree of chapters → sections → subsections with their text content. The teacher lands on a review page where they can rename, reorder, or delete nodes and edit section text. When satisfied, they publish the course. Students can then navigate the course as a web page with a chapter sidebar and section content — never seeing the PDF itself.

### Why Gemini

- Gemini's vision model reads PDFs directly, preserving layout, font-size hierarchy, and crucially **correct Arabic text rendering** (a known weakness of pure text extractors like `pdfplumber`).
- One API call replaces a two-step pipeline (extract → detect).
- The same Gemini integration will later power the per-course AI assistant, so the investment is reused.
- The free tier comfortably covers MVP traffic (~1500 req/day, ~1M tokens/min).

---

## 2. Goals & Non-Goals

### Goals

- Teachers can upload a PDF and get a working, navigable course in under a minute.
- Students see clean, structured content — chapters, sections, subsections — not a PDF embed.
- The generated structure is editable by the teacher before publish, so imperfect auto-detection is always recoverable.
- Works for both Arabic and English PDFs.
- No new infrastructure services (no object storage, no queue, no worker).

### Non-Goals

- Not aiming for 100% auto-detection accuracy. The review-and-edit step is the safety net.
- No automatic translation between languages on upload.
- No OCR for scanned/handwritten PDFs (Gemini handles clean digital PDFs only).
- No rich media extraction (images, tables, equations) — text content only.
- No real-time collaborative editing of the course structure.

---

## 3. User Stories

### Teacher

- **As a teacher**, I want to upload a PDF textbook chapter so that I can turn it into a course for my students without manual copy-pasting.
- **As a teacher**, I want to review and edit the auto-detected chapter/section titles so that I can fix any mistakes before publishing.
- **As a teacher**, I want to edit the text of any section so that I can clean up noise from the PDF (headers, footers, page numbers).
- **As a teacher**, I want to delete chapters or sections I don't need so that the course matches what I actually want to teach.
- **As a teacher**, I want to see a list of my draft and published courses so that I can manage them over time.
- **As a teacher**, I want clear feedback when my PDF is too large or can't be processed so that I understand what went wrong.

### Student

- **As a student**, I want to browse available courses so that I can pick what to study.
- **As a student**, I want to navigate a course by chapter and section in a sidebar so that I can jump around easily.
- **As a student**, I want to see each section as a clean, readable web page so that I don't have to wrestle with a PDF viewer.
- **As a student**, I want the course shown in the language it was written in, with a clear label, so that I know what to expect.

---

## 4. System Architecture

```
┌──────────────────┐        multipart/form-data        ┌──────────────────────┐
│ Teacher Browser  │  ──────────────────────────────►  │  FastAPI Backend     │
│ (upload form)    │                                    │                      │
└──────────────────┘                                    │  1. Validate size    │
                                                        │  2. Read bytes       │
                                                        │  3. Send to Gemini   │
                                                        │  4. Parse JSON       │
                                                        │  5. Save Course row  │
                                                        │     (status=DRAFT)   │
                                                        │  6. Discard bytes    │
                                                        └──────────┬───────────┘
                                                                   │
                                                        ┌──────────▼───────────┐
                                                        │  Google Gemini API   │
                                                        │  (PDF → JSON tree)   │
                                                        └──────────────────────┘

  Teacher reviews ──► PATCH /teacher/courses/{id}/structure ──► POST .../publish

  Student views  ──► GET /courses/{id} ──► structure_json ──► tree UI
```

### Key Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| PDF storage | **Not stored** — only filename kept | User requirement: no raw files on disk. Bytes live in memory only during the Gemini call. |
| Extraction engine | **Gemini 1.5 Flash (PDF direct mode)** via existing `ai/repository.py` | Best Arabic support; reuses existing Gemini integration — no new SDK or config. |
| Structure storage | **Single JSONB column** (`structure_json`) | Simple nested tree, no joins, no migrations when shape evolves. |
| Processing model | **Synchronous** (blocks the upload request) | MVP simplicity. 10 MB / 30-page cap keeps this comfortably under 30s. |
| New entity | **New `Course` table**, separate from `Lesson` | Different shape (tree vs. flat), different use case, avoids breaking existing lessons. |
| Languages | **One PDF, one language, no auto-translate** | Avoids burning tokens on content no one may read. |
| Ownership | **Uploader-owned, visible to all students** | Matches existing platform model; no class/enrollment plumbing. |
| File storage backend | **None** (memory-only processing) | See "PDF storage" above. |

---

## 5. Data Model

### New table: `courses`

```python
class CourseStatus(StrEnum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"


class Course(Base):
    __tablename__ = "courses"

    id: UUID (PK, default uuid4)
    title: str (max 255, required)                 # teacher-editable
    language: str (max 2, required)                # "ar" | "en"
    owner_user_id: UUID (FK users.id, CASCADE)
    source_filename: str (max 255, required)       # e.g. "biology_ch3.pdf" — display only
    source_page_count: int (required)              # stored for teacher reference
    structure_json: JSONB (required, default {})   # full tree — see shape below
    status: CourseStatus (required, default DRAFT)
    created_at: datetime
    updated_at: datetime
```

### `structure_json` shape

```json
{
  "chapters": [
    {
      "id": "c1",
      "title": "Introduction to Cells",
      "sections": [
        {
          "id": "c1s1",
          "title": "What is a cell?",
          "content": "Plain text content of this section...",
          "subsections": [
            {
              "id": "c1s1_1",
              "title": "Prokaryotic vs eukaryotic",
              "content": "..."
            }
          ]
        }
      ]
    }
  ]
}
```

**Rules:**
- `id` values are generated by the backend after Gemini returns, using stable path-based keys (`c{n}`, `c{n}s{m}`, `c{n}s{m}_{k}`). These IDs are what the frontend uses for navigation.
- `subsections` is always present but may be empty.
- `content` is plain text. No Markdown parsing in MVP (can be added later without migration).
- Empty chapters/sections are allowed (a chapter can have just subsections, a section can have just a title).

### No new indexes needed for MVP

Queries are by `id`, by `owner_user_id`, and by `status`. All served by the primary key and a lightweight index on `(owner_user_id, status)` in the migration.

---

## 6. Backend API Surface

All endpoints live under a new module: `backend/app/modules/courses/`.

### Teacher endpoints (require `ROLE_TUTOR`)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/teacher/courses` | Multipart upload. Fields: `file` (PDF), `title` (str), `language` (`ar`\|`en`). Returns created course with `status=DRAFT`. |
| `GET` | `/teacher/courses` | List the current teacher's courses (both draft and published). |
| `GET` | `/teacher/courses/{id}` | Get a single course (including `structure_json`) for the review page. |
| `PATCH` | `/teacher/courses/{id}` | Update course metadata (`title`) and/or full `structure_json`. Used by the review/edit UI. |
| `POST` | `/teacher/courses/{id}/publish` | Flip status from `DRAFT` to `PUBLISHED`. Idempotent. |
| `DELETE` | `/teacher/courses/{id}` | Delete course. Owner-only. |

### Student endpoints (authenticated user)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/courses` | List all `PUBLISHED` courses. Optional `?language=ar` filter. |
| `GET` | `/courses/{id}` | Get a single `PUBLISHED` course's structure for rendering. |

### Error responses

| Case | HTTP | `detail` |
|---|---|---|
| File not a PDF | 400 | `"File must be a PDF"` |
| File > 10 MB | 413 | `"File exceeds 10 MB size limit"` |
| Page count > 30 | 413 | `"PDF exceeds 30 page limit"` |
| Gemini returns invalid JSON | 502 | `"Failed to parse course structure, please try again"` |
| Gemini API unreachable | 502 | `"Course analysis service unavailable"` |
| Non-owner tries to edit/delete | 403 | `"You do not own this course"` |
| Student tries to view DRAFT | 404 | (treat as not found to avoid leaking existence) |

---

## 7. Gemini Integration

### Reuse existing infrastructure

Gemini is **already wired into the codebase**. No new SDK, no new config, no new module file.

- **Existing file:** [backend/app/modules/ai/repository.py](backend/app/modules/ai/repository.py) already calls `gemini-1.5-flash` via direct `httpx` calls to `generativelanguage.googleapis.com/v1beta/models`.
- **Existing config:** `settings.gemini_api_key` is already defined in [backend/app/core/config.py:12](backend/app/core/config.py#L12) (reads `GEMINI_API_KEY` from `.env`).
- **Existing pattern:** the current `generate_text(prompt, locale, mode)` function includes a `_fallback_completion` helper that returns a canned string when the key is missing. We keep this pattern for structure extraction, but with a stricter failure mode (see below).
- **No new pip dependency** is needed. Do **not** add `google-generativeai`. Stay with `httpx` for consistency.

### What to add

A single new function in the same `ai/repository.py` file, alongside `generate_text()`:

```python
def extract_course_structure(pdf_bytes: bytes, language: str) -> dict:
    """
    Send a PDF to Gemini and return a raw structure dict.
    Raises GeminiError on API failure.
    Raises GeminiParseError if the response is not valid JSON matching the expected schema.

    No fallback: if the key is missing or the call fails, this raises. The PDF upload
    endpoint turns these into HTTP 502 for the user to retry.
    """
```

A thin service-layer wrapper in `app/modules/courses/service.py` validates the returned dict against Pydantic schemas (`CourseStructure` / `Chapter` / `Section` / `Subsection`) and assigns stable IDs.

### Model choice

- **`gemini-1.5-flash`** — matches the existing `_GEMINI_MODEL` constant in `ai/repository.py`. Vision-capable, supports PDF input via inline `inlineData` with `mime_type: "application/pdf"`.
- If the constant is later bumped to a newer model (e.g. `gemini-2.0-flash`), the PDF extraction path automatically benefits with no code change.

### HTTP request shape

Same endpoint as the existing `generate_text()`, different `contents` payload:

```python
payload = {
    "contents": [{
        "parts": [
            {"inlineData": {"mimeType": "application/pdf", "data": base64_pdf}},
            {"text": extraction_prompt},
        ]
    }],
    "generationConfig": {
        "temperature": 0.1,
        "responseMimeType": "application/json",
        "maxOutputTokens": 8192,
    },
}
```

### Prompt (MVP)

The prompt instructs Gemini to return JSON only, matching a fixed schema, using the document's own headings, dropping page numbers/headers/footers, and keeping content in its original language.

Key prompt elements:
1. "You are given a PDF document. Extract its structure."
2. The target JSON schema as an inline example.
3. "Use the document's own chapter and section headings. Do not invent structure."
4. "Remove page numbers, running headers, and footers from content."
5. "Keep all text in its original language. Do not translate."
6. "Return JSON only, no explanations, no markdown fences."

### Response handling

- Strip any accidental markdown code fences (` ```json ... ``` `).
- `json.loads` with strict parsing.
- Validate against a Pydantic schema (`CourseStructure` / `Chapter` / `Section` / `Subsection`).
- Assign stable `id` values (`c1`, `c1s1`, `c1s1_1`) after validation.
- On any failure, return HTTP 502 — do not retry automatically in MVP (teacher can re-upload).

### Token budget (MVP)

- ~258 tokens per page × 30 pages = ~7,750 tokens for the PDF.
- Prompt overhead: ~500 tokens.
- Expected output: ~3,000–8,000 tokens.
- **Total per upload: ~12k–17k tokens.** Well under free-tier per-minute and per-day caps for any realistic MVP traffic.
- Note: the existing `generate_text()` call sets `maxOutputTokens: 300` for short explanations. The new extraction call uses `maxOutputTokens: 8192` — set per-call in `generationConfig`, no global change.

---

## 8. Frontend UX

### Teacher Dashboard — new "Courses" tab

Added to the existing tab list in [TeacherDashboard.tsx](frontend/src/app/pages/TeacherDashboard.tsx).

**Contents:**
- Upload form: title input, language selector (`ar`/`en`), file input (PDF only), submit button.
- Loading state: "Analyzing your PDF… (this takes about 10–30 seconds)" with a spinner. Button disabled.
- List of teacher's courses below the form: title, status badge (`DRAFT`/`PUBLISHED`), page count, created date, and actions (Review, Publish, Delete).

### Teacher Course Review Page — new route

Route: `/teacher/courses/:id/review`

**Layout:**
- **Left sidebar:** the chapter/section/subsection tree. Each node is clickable to select it. Hover actions: rename, delete. Drag-to-reorder is **out of scope** for MVP — users can delete and re-add if order is wrong.
- **Right panel:** the selected node's editor. Title input + a plain `<textarea>` for `content`. "Save" button commits changes to the draft (`PATCH /teacher/courses/{id}`).
- **Header:** course title (editable) + "Publish Course" button (disabled if nothing in the tree).

### Student Course List — new route

Route: `/courses`

- Grid of published courses: title, language badge, page count, "Open" button.
- Locale filter: optional query param `?language=ar`.

### Student Course Page — new route

Route: `/courses/:id`

**Reuses the layout of [CoursePage.tsx](frontend/src/app/pages/CoursePage.tsx)** with these differences:
- Sidebar renders the full chapter → section → subsection tree instead of a flat `parseSections` list.
- Clicking a section or subsection swaps the main panel content.
- The existing "Read aloud", "Ask for help", "AI chat" features can be wired up later; not required for MVP view.
- Language badge at the top if the current locale differs from `course.language`.

---

## 9. Constraints & Limits

| Limit | Value | Enforcement |
|---|---|---|
| Max file size | **10 MB** | Backend checks `file.size` before reading. HTTP 413 on violation. |
| Max page count | **30 pages** | Backend checks after Gemini returns `source_page_count`. HTTP 413 on violation. |
| File type | **PDF only** | Backend checks content-type and file extension. HTTP 400 on violation. |
| Languages | **`ar` or `en` only** | Enum-validated on the schema. |
| One upload at a time per teacher | Enforced by the UI disabling the button during processing. No backend lock needed for MVP. |

### Security

- Authenticated teachers only (`ROLE_TUTOR`) for all `/teacher/courses/*` endpoints.
- Owner check on PATCH / DELETE / publish — non-owner gets 403.
- Draft courses are never visible via student endpoints.
- PDF bytes are never written to disk and never logged. Only the filename and page count are persisted.
- `GEMINI_API_KEY` is read from env, never committed to git, never returned in any API response.

### Privacy

Teachers are responsible for only uploading content they have the right to share. The platform adds a one-line disclaimer on the upload form: *"Only upload content you own or have permission to use."*

---

## 10. Out of Scope (MVP)

Explicitly deferred:

- **Auto-translation** of a course into other languages. (Translate on demand later if needed.)
- **OCR** for scanned/image-based PDFs. Gemini may partially handle these but results will be poor — not supported.
- **Image, table, or formula extraction.** Text only.
- **Rich text / Markdown** in section content. Plain text for MVP.
- **Drag-to-reorder** in the review UI. Delete + re-add or re-upload.
- **Progress tracking per section** for students. Viewing only, no "mark complete".
- **Per-course AI assistant.** Data model supports it, but the feature itself is a separate follow-up.
- **Per-course quiz or flashcard generation.**
- **Course versioning / edit history.**
- **Async processing / background jobs / Celery.** Synchronous only.
- **Cloud object storage (S3/MinIO).** Not needed since PDFs aren't stored.
- **Class/enrollment scoping.** All published courses are visible to all students.
- **Course search or categories.** Simple list for MVP.

---

## 11. Success Criteria

The feature is considered MVP-ready when:

1. A teacher can upload a 30-page English PDF and see a DRAFT course within ~30 seconds.
2. A teacher can upload a 30-page Arabic PDF and the content renders with correct RTL text.
3. The teacher can rename, edit, and delete nodes in the review UI and the changes persist.
4. The teacher can publish a course and a student can navigate it from `/courses`.
5. Files over 10 MB or 30 pages are rejected with clear error messages.
6. Non-PDF files are rejected.
7. A student cannot see draft courses.
8. A teacher cannot edit or delete another teacher's course.
9. Gemini API failures surface as user-friendly errors (not 500s).
10. No PDF bytes are persisted anywhere on the server after the request completes.

---

## 12. Future Improvements

Post-MVP candidates, roughly in priority order:

1. **Per-course AI assistant** (reusing the Gemini client) — "ask a question about this course", grounded in `structure_json`.
2. **On-demand translation** — when a student opens a course in a different locale, translate the tree once and cache.
3. **Student progress tracking** — mark sections complete, resume where you left off.
4. **Auto-generate flashcards and quizzes** from course content (reusing the existing `LessonFlashcard` / quiz modules).
5. **Async processing with status polling** — lift the 30-page cap.
6. **Drag-to-reorder** in the review UI.
7. **Rich text / Markdown** support in section content.
8. **Image extraction** for diagrams and figures.
9. **OCR fallback** for scanned PDFs.
10. **Class/enrollment scoping** so teachers can publish to specific groups.
11. **Course versioning** — edit history, rollback.
12. **Object storage (S3)** — if later versions need to keep the original PDF for download.
