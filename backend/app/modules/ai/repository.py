from __future__ import annotations

from typing import Final

import httpx

from app.core.config import settings

_GEMINI_MODEL: Final[str] = "gemini-1.5-flash"
_GEMINI_BASE_URL: Final[str] = "https://generativelanguage.googleapis.com/v1beta/models"


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
