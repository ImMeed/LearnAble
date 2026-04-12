from __future__ import annotations

import base64
import io
import json
from typing import Final

import httpx
from pypdf import PdfReader

from app.core.config import settings

_GEMINI_MODEL: Final[str] = "gemini-2.5-flash"
_GEMINI_BASE_URL: Final[str] = "https://generativelanguage.googleapis.com/v1beta/models"
_EXTRACTION_TIMEOUT_S: Final[float] = 120.0
_EXTRACTION_MAX_TOKENS: Final[int] = 65536


class GeminiError(Exception):
    """Raised when the Gemini API call fails (network, auth, rate limit, bad status)."""


class GeminiParseError(GeminiError):
    """Raised when Gemini returns data that is not valid JSON or not the expected shape."""


def _fallback_completion(prompt: str, locale: str, mode: str) -> str:
    _ = prompt
    if mode == "translate":
        return (
            "[AR] ترجمة تعليمية مبسطة للنص المطلوب."
            if locale == "ar"
            else "[EN] Educational translation for the requested text."
        )
    return (
        "شرح تعليمي مبسط يساعدك على الفهم خطوة بخطوة."
        if locale == "ar"
        else "A simplified educational explanation to support your understanding step by step."
    )


def _build_extraction_prompt(language: str, page_count: int) -> str:
    return f"""
Extract the structure of this document ({page_count} pages).

Return JSON only (no markdown fences, no explanation), using this schema:
{{
  "page_count": {page_count},
  "chapters": [
    {{
      "title": "string",
      "sections": [
        {{
          "title": "string",
          "content": "string",
          "subsections": [
            {{
              "title": "string",
              "content": "string"
            }}
          ]
        }}
      ]
    }}
  ]
}}

Rules:
- page_count MUST be exactly {page_count}.
- Use the document's own chapter and section headings. Do not invent structure.
- Remove page number markers like [Page N], running headers, and footers from content.
- Keep all text in its original language. Do not translate. The document is in {language}.
- Preserve meaningful educational content and heading hierarchy.
- Return valid JSON only.
""".strip()


def _strip_json_fence(raw_text: str) -> str:
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned.rsplit("```", 1)[0]
        cleaned = cleaned.strip()
    return cleaned


def _extract_text_from_pdf(pdf_bytes: bytes) -> tuple[str, int]:
    """Extract plain text and page count from PDF bytes using pypdf."""
    reader = PdfReader(io.BytesIO(pdf_bytes))
    page_count = len(reader.pages)
    pages_text = []
    for i, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        if text.strip():
            pages_text.append(f"[Page {i}]\n{text.strip()}")
    return "\n\n".join(pages_text), page_count


def extract_course_structure(pdf_bytes: bytes, language: str) -> dict:
    """
    Extract course structure from a PDF using Gemini.

    For text-based PDFs: extracts text locally with pypdf, sends text to Gemini.
    For image/scanned PDFs: sends the PDF as inline base64 for Gemini to OCR.

    Raises:
        GeminiError: if the API key is missing, the HTTP call fails, the response
            has no candidates, or the API returns a non-2xx status.
        GeminiParseError: if the returned text is not valid JSON.
    """
    api_key = settings.gemini_api_key.strip()
    if not api_key:
        raise GeminiError("GEMINI_API_KEY is not configured")

    try:
        pdf_text, page_count = _extract_text_from_pdf(pdf_bytes)
    except Exception as exc:
        raise GeminiError(f"Failed to read PDF: {exc}") from exc

    prompt = _build_extraction_prompt(language, page_count)

    if pdf_text.strip():
        # Text-based PDF: send extracted text only (cheap, low token usage)
        parts = [{"text": f"{prompt}\n\nExtracted text:\n\n{pdf_text}"}]
    else:
        # Scanned/image-based PDF: send as inline base64 for Gemini to OCR
        encoded_pdf = base64.b64encode(pdf_bytes).decode("ascii")
        parts = [
            {"inlineData": {"mimeType": "application/pdf", "data": encoded_pdf}},
            {"text": prompt},
        ]

    endpoint = f"{_GEMINI_BASE_URL}/{_GEMINI_MODEL}:generateContent"
    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json",
            "maxOutputTokens": _EXTRACTION_MAX_TOKENS,
        },
    }

    try:
        with httpx.Client(timeout=_EXTRACTION_TIMEOUT_S) as client:
            response = client.post(endpoint, params={"key": api_key}, json=payload)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPError as exc:
        raise GeminiError(str(exc)) from exc

    candidates = data.get("candidates") or []
    if not candidates:
        raise GeminiError("Gemini returned no candidates")

    parts = ((candidates[0].get("content") or {}).get("parts") or [])
    text_parts = [part.get("text", "") for part in parts if part.get("text")]
    raw_text = "\n".join(text_parts).strip()
    if not raw_text:
        raise GeminiError("Gemini returned no text content")

    cleaned = _strip_json_fence(raw_text)
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise GeminiParseError(f"Failed to parse Gemini JSON response: {exc}") from exc

    if not isinstance(parsed, dict):
        raise GeminiParseError("Gemini JSON response must be an object")
    return parsed


def generate_text(prompt: str, locale: str, mode: str) -> str:
    api_key = settings.gemini_api_key.strip()
    if not api_key:
        return _fallback_completion(prompt, locale, mode)

    endpoint = f"{_GEMINI_BASE_URL}/{_GEMINI_MODEL}:generateContent"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 300,
        },
    }

    with httpx.Client(timeout=20.0) as client:
        response = client.post(endpoint, params={"key": api_key}, json=payload)
        response.raise_for_status()
        data = response.json()

    candidates = data.get("candidates") or []
    if not candidates:
        return _fallback_completion(prompt, locale, mode)

    parts = ((candidates[0].get("content") or {}).get("parts") or [])
    text_parts = [part.get("text", "") for part in parts if part.get("text")]
    rendered = "\n".join(text_parts).strip()
    return rendered or _fallback_completion(prompt, locale, mode)
