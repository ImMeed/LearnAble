# Phase 0 — Prerequisites & Setup

**Feature:** PDF-to-Structured-Course
**Source specs:** [PRD_learnable_pdf_courses.md](../PRD_learnable_pdf_courses.md) · [pdf-courses-roadmap.md](../pdf-courses-roadmap.md)
**Depends on:** nothing — this is the blocker for every other phase.

---

## Goal

Confirm the existing Gemini integration in this repo is usable. Add **no** new dependencies and **no** new config fields.

## Ground truth (verified in the codebase)

- Gemini is already wired via [backend/app/modules/ai/repository.py](../backend/app/modules/ai/repository.py) using direct `httpx` POSTs to `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`.
- `_GEMINI_MODEL` and `_GEMINI_BASE_URL` are already defined as module-level constants.
- `generate_text(prompt, locale, mode)` and `_fallback_completion(prompt, locale, mode)` already exist.
- `settings.gemini_api_key` is already defined at [backend/app/core/config.py:12](../backend/app/core/config.py#L12) with an empty default.
- `httpx==0.28.1` is already in [backend/requirements.txt](../backend/requirements.txt).
- [backend/.env.example](../backend/.env.example) already has `GEMINI_API_KEY=` (empty placeholder) with the comment "Optional: leave empty to use built-in fallback AI responses".

## Tasks

1. **Do not** add `google-generativeai` (or any other SDK) to `requirements.txt`. Stay with `httpx`.
2. **Do not** add a new setting to [backend/app/core/config.py](../backend/app/core/config.py). Reuse `settings.gemini_api_key`.
3. Check `backend/.env` (gitignored). If `GEMINI_API_KEY` is missing or empty, get a free-tier key from [aistudio.google.com](https://aistudio.google.com) and set it.
4. **Verify the model constant is still a live model.** Open [backend/app/modules/ai/repository.py](../backend/app/modules/ai/repository.py) and check `_GEMINI_MODEL`. The original value `"gemini-1.5-flash"` returns a 404 from the `v1beta` endpoint as of 2026 — it has been retired. Update it to `"gemini-2.0-flash"` (or `"gemini-2.5-flash"`). Confirm the model exists:

   ```bash
   # Quick check — replace YOUR_KEY with the actual key
   curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_KEY" | python -m json.tool | grep '"name"' | grep flash
   ```

   The constant must be changed in [backend/app/modules/ai/repository.py:9](../backend/app/modules/ai/repository.py#L9):
   ```python
   _GEMINI_MODEL: Final[str] = "gemini-2.0-flash"
   ```
5. Leave `backend/.env.example` as-is — its placeholder is already correct. The comment currently says the key is "optional"; leave that wording for now (Phase 2 will add a stricter failure mode in the new extraction function, but text generation retains its fallback).
6. Smoke-test the existing integration from a Python shell inside the backend venv:

   ```python
   from app.modules.ai.repository import generate_text
   print(generate_text("Say hi in one sentence.", locale="en", mode="explain"))
   ```

   You should see a real Gemini response — not the canned fallback string `"A simplified educational explanation to support your understanding step by step."`. If you get the fallback, the key isn't loading. If you get a `429 Too Many Requests`, the key is valid but temporarily rate-limited (free tier is ~15 requests/minute) — wait 60 seconds and retry. A `404` means the model name is wrong — revisit task 4. Fix any issue before continuing.

## Definition of Done

- [ ] `from app.core.config import settings; print(bool(settings.gemini_api_key))` prints `True` when the backend is running.
- [ ] `_GEMINI_MODEL` in [backend/app/modules/ai/repository.py](../backend/app/modules/ai/repository.py) is set to a live model (`gemini-2.0-flash` or newer). Verified by listing available models via the API.
- [ ] A real `generate_text()` call returns a non-fallback string.
- [ ] `git diff backend/requirements.txt backend/app/core/config.py backend/.env.example` shows **no changes**.

## Files touched

- `backend/app/modules/ai/repository.py` — one-line change to `_GEMINI_MODEL` if the original value is retired (expected).
- `backend/.env` — set `GEMINI_API_KEY` (gitignored, not committed).

## Notes / gotchas

- The existing `generate_text()` gracefully falls back when the key is missing. The new `extract_course_structure()` you'll add in Phase 2 must **not** have a fallback — structure extraction can't be faked. But that's Phase 2's concern, not Phase 0's.
