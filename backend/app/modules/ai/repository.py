from __future__ import annotations

import json
import time
from typing import Final

import httpx

from app.core.config import settings

_GEMINI_MODELS: Final[tuple[str, ...]] = ("gemini-2.5-flash-lite", "gemini-2.5-flash")
_GEMINI_BASE_URL: Final[str] = "https://generativelanguage.googleapis.com/v1beta/models"


def _fallback_completion(prompt: str, locale: str, mode: str) -> str:
    _ = prompt
    if mode == "translate":
        return (
            "[AR] Educational translation for the requested text."
            if locale == "ar"
            else "[EN] Educational translation for the requested text."
        )
    return (
        "Educational guidance only. Here is a simplified explanation that supports step-by-step understanding."
        if locale == "en"
        else "إرشاد تعليمي فقط. هذا شرح مبسط يساعد على الفهم خطوة بخطوة."
    )


def _extract_candidate_text(data: dict) -> str:
    candidates = data.get("candidates") or []
    if not candidates:
        return ""
    parts = ((candidates[0].get("content") or {}).get("parts") or [])
    text_parts = [part.get("text", "") for part in parts if part.get("text")]
    return "\n".join(text_parts).strip()


def _call_generate_content(payload: dict) -> dict:
    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": settings.gemini_api_key.strip(),
    }
    last_error: Exception | None = None
    with httpx.Client(timeout=30.0) as client:
        for model in _GEMINI_MODELS:
            endpoint = f"{_GEMINI_BASE_URL}/{model}:generateContent"
            for attempt in range(3):
                try:
                    response = client.post(endpoint, headers=headers, json=payload)
                    response.raise_for_status()
                    return response.json()
                except httpx.HTTPStatusError as exc:
                    last_error = exc
                    if exc.response.status_code in {429, 503} and attempt < 2:
                        time.sleep(1.0 * (attempt + 1))
                        continue
                    break
                except httpx.HTTPError as exc:
                    last_error = exc
                    break
    if last_error:
        raise last_error
    raise RuntimeError("Gemini request failed without a response.")


def generate_text(prompt: str, locale: str, mode: str) -> str:
    api_key = settings.gemini_api_key.strip()
    if not api_key:
        return _fallback_completion(prompt, locale, mode)

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 300,
        },
    }

    try:
        data = _call_generate_content(payload)
    except httpx.HTTPError:
        return _fallback_completion(prompt, locale, mode)

    rendered = _extract_candidate_text(data)
    return rendered or _fallback_completion(prompt, locale, mode)


def generate_json(
    prompt: str,
    schema: dict,
    *,
    temperature: float = 0.6,
    max_output_tokens: int = 1400,
) -> dict | None:
    api_key = settings.gemini_api_key.strip()
    if not api_key:
        return None

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_output_tokens,
            "responseMimeType": "application/json",
            "responseJsonSchema": schema,
        },
    }

    try:
        data = _call_generate_content(payload)
    except httpx.HTTPError:
        return None

    rendered = _extract_candidate_text(data)
    if not rendered:
        return None

    try:
        return json.loads(rendered)
    except json.JSONDecodeError:
        cleaned = rendered.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            return None
