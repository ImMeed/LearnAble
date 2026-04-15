from __future__ import annotations

import json
import base64
from typing import Final

import httpx
from pypdf import PdfReader

from app.core.config import settings


_GEMINI_MODEL: Final[str] = "gemini-2.5-flash"
_GEMINI_COURSE_MODEL: Final[str] = "gemini-2.5-flash"
_GEMINI_BASE_URL: Final[str] = "https://generativelanguage.googleapis.com/v1beta/models"


class GeminiError(Exception):
    """Raised for Gemini API failures."""


class GeminiParseError(Exception):
    """Raised when Gemini response is not valid JSON or wrong structure."""


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


def _strip_json_fence(text: str) -> str:
    """Remove ```json ... ``` wrappers that Gemini sometimes adds."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]
    if text.endswith("```"):
        text = text.rsplit("```", 1)[0]
    return text.strip()


def _extract_text_from_pdf(pdf_bytes: bytes) -> tuple[str, int]:
    """Extract full text and page count from a PDF using pypdf."""
    from io import BytesIO
    reader = PdfReader(BytesIO(pdf_bytes))
    page_count = len(reader.pages)
    pages_text = []
    for page in reader.pages:
        text = page.extract_text() or ""
        pages_text.append(text)
    return "\n".join(pages_text), page_count


def _is_scanned_pdf(pdf_bytes: bytes) -> tuple[bool, int]:
    """Return (is_scanned, page_count). Scanned = fewer than 20% of pages have text."""
    from io import BytesIO
    reader = PdfReader(BytesIO(pdf_bytes))
    page_count = len(reader.pages)
    if page_count == 0:
        return True, 0
    pages_with_text = sum(
        1 for page in reader.pages if (page.extract_text() or "").strip()
    )
    return (pages_with_text / page_count) < 0.2, page_count


def _get_mock_course_structure(page_count: int, language: str) -> dict:
    """Return mock course structure for testing when GEMINI_MOCK=true."""
    if language == "ar":
        return {
            "page_count": page_count,
            "chapters": [
                {
                    "id": "",
                    "title": "الفصل 1: المقدمة",
                    "sections": [
                        {
                            "id": "",
                            "title": "1.1 الخلفية التاريخية",
                            "content": "نص تعليمي مبسط عن الخلفية التاريخية للموضوع.",
                            "subsections": [
                                {
                                    "id": "",
                                    "title": "السياق العام",
                                    "content": "شرح الظروف التاريخية والاجتماعية."
                                }
                            ]
                        },
                        {
                            "id": "",
                            "title": "1.2 الأساسيات",
                            "content": "شرح المفاهيم الأساسية للدرس بطريقة سهلة.",
                            "subsections": []
                        }
                    ]
                },
                {
                    "id": "",
                    "title": "الفصل 2: المواضيع المتقدمة",
                    "sections": [
                        {
                            "id": "",
                            "title": "2.1 التطبيقات العملية",
                            "content": "أمثلة عملية وتطبيقات واقعية للمفاهيم.",
                            "subsections": []
                        }
                    ]
                }
            ]
        }
    else:  # English
        return {
            "page_count": page_count,
            "chapters": [
                {
                    "id": "",
                    "title": "Chapter 1: Introduction",
                    "sections": [
                        {
                            "id": "",
                            "title": "1.1 Historical Background",
                            "content": "A simplified educational text about the historical background of the topic.",
                            "subsections": [
                                {
                                    "id": "",
                                    "title": "General Context",
                                    "content": "An explanation of the historical and social circumstances."
                                }
                            ]
                        },
                        {
                            "id": "",
                            "title": "1.2 Fundamentals",
                            "content": "An explanation of the basic concepts of the lesson in an easy way.",
                            "subsections": []
                        }
                    ]
                },
                {
                    "id": "",
                    "title": "Chapter 2: Advanced Topics",
                    "sections": [
                        {
                            "id": "",
                            "title": "2.1 Practical Applications",
                            "content": "Real-world examples and practical applications of the concepts.",
                            "subsections": []
                        }
                    ]
                }
            ]
        }


def extract_course_structure(pdf_bytes: bytes, language: str) -> dict:
    """
    Send PDF to Gemini and return a structured course JSON dict.
    Returns a dict matching CourseStructure schema:
      { "page_count": int, "chapters": [...] }
    Raises GeminiError on API failure, GeminiParseError on bad response.
    """
    # Check if mock mode is enabled
    if settings.gemini_mock:
        _, page_count = _is_scanned_pdf(pdf_bytes)
        return _get_mock_course_structure(page_count, language)
    
    api_key = settings.gemini_api_key.strip()
    if not api_key:
        raise GeminiError("GEMINI_API_KEY is not configured.")

    is_scanned, page_count = _is_scanned_pdf(pdf_bytes)
    endpoint = f"{_GEMINI_BASE_URL}/{_GEMINI_COURSE_MODEL}:generateContent"

    schema_hint = (
        '{"page_count": <int>, "chapters": [{"id": "", "title": "", "sections": '
        '[{"id": "", "title": "", "content": "", "subsections": '
        '[{"id": "", "title": "", "content": ""}]}]}]}'
    )

    prompt_text = (
        f"You are an educational content structurer. Extract the content of this document "
        f"into a hierarchical JSON course structure. Return ONLY a valid JSON object with no "
        f"markdown fences. The language of the response must be {language}.\n\n"
        f"Rules:\n"
        f"- Do not translate content — preserve the original language.\n"
        f"- Remove page numbers, headers, and footers.\n"
        f"- Every section and subsection must have non-empty content.\n"
        f"- Set page_count to the actual number of pages ({page_count}).\n"
        f"- IDs will be assigned later — leave id fields as empty strings.\n\n"
        f"Required JSON schema:\n{schema_hint}"
    )

    if is_scanned:
        encoded = base64.b64encode(pdf_bytes).decode("utf-8")
        contents = [
            {
                "parts": [
                    {"text": prompt_text},
                    {"inline_data": {"mime_type": "application/pdf", "data": encoded}},
                ]
            }
        ]
    else:
        full_text, _ = _extract_text_from_pdf(pdf_bytes)
        contents = [
            {
                "parts": [
                    {"text": f"{prompt_text}\n\n--- DOCUMENT TEXT ---\n{full_text}"}
                ]
            }
        ]

    payload = {
        "contents": contents,
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 65536,
            "responseMimeType": "application/json",
        },
    }

    try:
        with httpx.Client(timeout=120.0) as client:
            response = client.post(endpoint, params={"key": api_key}, json=payload)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPStatusError as exc:
        raise GeminiError(f"Gemini API HTTP error: {exc.response.status_code}") from exc
    except httpx.RequestError as exc:
        raise GeminiError(f"Gemini API request error: {exc}") from exc

    candidates = data.get("candidates") or []
    if not candidates:
        raise GeminiParseError("Gemini returned no candidates.")

    parts = (candidates[0].get("content") or {}).get("parts") or []
    raw_text = "\n".join(p.get("text", "") for p in parts if p.get("text")).strip()
    if not raw_text:
        raise GeminiParseError("Gemini returned empty content.")

    cleaned = _strip_json_fence(raw_text)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise GeminiParseError(f"Gemini response is not valid JSON: {exc}") from exc


def generate_flashcards(course_title: str, course_content: str, locale: str) -> list:
    """Generate exactly 8 flashcards from course content."""
    # Return mock flashcards if mock mode is enabled
    if settings.gemini_mock:
        if locale == "ar":
            return [
                {"front": "ما هي المفاهيم الرئيسية؟", "back": "المفاهيم الأساسية للدرس."},
                {"front": "كيف نطبق هذا؟", "back": "نحتاج إلى فهم الأساسيات أولاً."},
                {"front": "ما الفرق بين الأنواع؟", "back": "لكل نوع خصائصه الفريدة."},
                {"front": "متى نستخدم هذا؟", "back": "في الحالات التي تتطلب هذه المهارة."},
                {"front": "ما الفوائد؟", "back": "يحسن من الفهم والقدرة على التطبيق."},
                {"front": "هل هناك أمثلة؟", "back": "نعم، هناك عدة أمثلة عملية."},
                {"front": "كيف نتذكر هذا؟", "back": "بالممارسة المستمرة والمراجعة."},
                {"front": "ما التطبيقات المتقدمة؟", "back": "تطبيقات أكثر تعقيداً من الأساسيات."}
            ]
        else:
            return [
                {"front": "What are the main concepts?", "back": "The fundamental concepts of the lesson."},
                {"front": "How do we apply this?", "back": "We need to understand the basics first."},
                {"front": "What's the difference between types?", "back": "Each type has its unique characteristics."},
                {"front": "When do we use this?", "back": "In cases that require this skill."},
                {"front": "What are the benefits?", "back": "It improves understanding and application ability."},
                {"front": "Are there examples?", "back": "Yes, there are several practical examples."},
                {"front": "How do we remember this?", "back": "Through continuous practice and review."},
                {"front": "What are advanced applications?", "back": "More complex applications than basics."}
            ]
    
    api_key = settings.gemini_api_key.strip()
    if not api_key:
        return [{"front": "Sample question?", "back": "Sample answer."} for _ in range(8)]

    truncated = course_content[:6000]
    prompt = (
        f"Generate exactly 8 flashcards for the course '{course_title}'.\n"
        f"Language: {locale}. Keep answers 1-2 sentences max (dyslexia/ADHD friendly).\n"
        f"Return ONLY a JSON array: "
        f'[{{"front": "question", "back": "answer"}}, ...]\n\n'
        f"Course content:\n{truncated}"
    )

    endpoint = f"{_GEMINI_BASE_URL}/{_GEMINI_COURSE_MODEL}:generateContent"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 2048,
            "responseMimeType": "application/json",
        },
    }

    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(endpoint, params={"key": api_key}, json=payload)
            response.raise_for_status()
            data = response.json()
    except Exception:
        return [{"front": "Review question", "back": "Review answer"} for _ in range(8)]

    candidates = data.get("candidates") or []
    if not candidates:
        return [{"front": "Review question", "back": "Review answer"} for _ in range(8)]

    parts = (candidates[0].get("content") or {}).get("parts") or []
    raw = "\n".join(p.get("text", "") for p in parts if p.get("text")).strip()
    try:
        return json.loads(_strip_json_fence(raw))
    except Exception:
        return [{"front": "Review question", "back": "Review answer"} for _ in range(8)]


def generate_quiz(course_title: str, course_content: str, locale: str) -> list:
    """Generate exactly 6 MCQ questions from course content."""
    # Return mock quiz if mock mode is enabled
    if settings.gemini_mock:
        if locale == "ar":
            return [
                {
                    "question": "ما هو التعريف الصحيح؟",
                    "options": ["أ) المفهوم الأول", "ب) المفهوم الثاني", "ج) المفهوم الثالث", "د) جميع ما سبق"],
                    "correct": "ب",
                    "explanation": "المفهوم الثاني هو الأصح بناءً على المحتوى المدروس."
                },
                {
                    "question": "أي من التالي يعتبر تطبيق صحيح؟",
                    "options": ["أ) الطريقة الأولى", "ب) الطريقة الثانية", "ج) الطريقة الثالثة", "د) لا توجد طريقة صحيحة"],
                    "correct": "أ",
                    "explanation": "الطريقة الأولى هي الأكثر فعالية."
                },
                {
                    "question": "متى يجب استخدام هذا المفهوم؟",
                    "options": ["أ) دائماً", "ب) أحياناً", "ج) في حالات محددة", "د) أبداً"],
                    "correct": "ج",
                    "explanation": "يجب استخدامه فقط في الحالات المحددة."
                },
                {
                    "question": "ما هو التأثير الرئيسي؟",
                    "options": ["أ) تأثير إيجابي", "ب) تأثير سلبي", "ج) لا يوجد تأثير", "د) تأثير محايد"],
                    "correct": "أ",
                    "explanation": "التأثير الإيجابي هو النتيجة الرئيسية."
                },
                {
                    "question": "أي من الخيارات يمثل الاستثناء؟",
                    "options": ["أ) الحالة الأولى", "ب) الحالة الثانية", "ج) الحالة الثالثة", "د) الحالة الرابعة"],
                    "correct": "د",
                    "explanation": "الحالة الرابعة تمثل استثناءً للقاعدة العامة."
                },
                {
                    "question": "ما هي النتيجة المتوقعة؟",
                    "options": ["أ) نتيجة أولى", "ب) نتيجة ثانية", "ج) نتيجة ثالثة", "د) لا توجد نتائج"],
                    "correct": "ب",
                    "explanation": "النتيجة الثانية هي الأكثر احتمالاً بناءً على المعطيات."
                }
            ]
        else:
            return [
                {
                    "question": "What is the correct definition?",
                    "options": ["A) First concept", "B) Second concept", "C) Third concept", "D) All of the above"],
                    "correct": "B",
                    "explanation": "The second concept is correct based on the learning material."
                },
                {
                    "question": "Which of the following is a correct application?",
                    "options": ["A) First method", "B) Second method", "C) Third method", "D) No correct method"],
                    "correct": "A",
                    "explanation": "The first method is the most effective."
                },
                {
                    "question": "When should this concept be used?",
                    "options": ["A) Always", "B) Sometimes", "C) In specific cases", "D) Never"],
                    "correct": "C",
                    "explanation": "It should only be used in specific cases."
                },
                {
                    "question": "What is the primary impact?",
                    "options": ["A) Positive impact", "B) Negative impact", "C) No impact", "D) Neutral impact"],
                    "correct": "A",
                    "explanation": "The positive impact is the main result."
                },
                {
                    "question": "Which option represents the exception?",
                    "options": ["A) First case", "B) Second case", "C) Third case", "D) Fourth case"],
                    "correct": "D",
                    "explanation": "The fourth case is an exception to the general rule."
                },
                {
                    "question": "What is the expected outcome?",
                    "options": ["A) First outcome", "B) Second outcome", "C) Third outcome", "D) No outcomes"],
                    "correct": "B",
                    "explanation": "The second outcome is most likely based on the given information."
                }
            ]
    
    api_key = settings.gemini_api_key.strip()
    if not api_key:
        return []

    truncated = course_content[:6000]
    prompt = (
        f"Generate exactly 6 multiple-choice questions for the course '{course_title}'.\n"
        f"Language: {locale}. Use simple, clear language (accessible for dyslexia/ADHD).\n"
        f"Return ONLY a JSON array:\n"
        f'[{{"question": "...", "options": ["A...", "B...", "C...", "D..."], '
        f'"correct": "A", "explanation": "..."}}]\n\n'
        f"Course content:\n{truncated}"
    )

    endpoint = f"{_GEMINI_BASE_URL}/{_GEMINI_COURSE_MODEL}:generateContent"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 3000,
            "responseMimeType": "application/json",
        },
    }

    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(endpoint, params={"key": api_key}, json=payload)
            response.raise_for_status()
            data = response.json()
    except Exception:
        return []

    candidates = data.get("candidates") or []
    if not candidates:
        return []

    parts = (candidates[0].get("content") or {}).get("parts") or []
    raw = "\n".join(p.get("text", "") for p in parts if p.get("text")).strip()
    try:
        return json.loads(_strip_json_fence(raw))
    except Exception:
        return []


def generate_course_assist(
    question: str,
    course_title: str,
    section_title: str,
    section_content: str,
    locale: str,
) -> str:
    """Answer a student's question scoped to a specific course section."""
    # Return mock answer if mock mode is enabled
    if settings.gemini_mock:
        if locale == "ar":
            return f"شكراً على السؤال حول '{section_title}'. بناءً على المحتوى، الإجابة هي نص تعليمي مبسط يشرح المفهوم بطريقة سهلة الفهم."
        else:
            return f"Thank you for your question about '{section_title}'. Based on the content, the answer is a simplified educational explanation that makes the concept easy to understand."
    
    api_key = settings.gemini_api_key.strip()
    if not api_key:
        return "Simplified explanation." if locale == "en" else "شرح مبسط."

    system_context = (
        f"You are a helpful tutor for the course '{course_title}'.\n"
        f"Current section: '{section_title}'.\n"
        f"Section content: {section_content[:2000]}\n\n"
        f"Answer the student's question generously — interpret topic-relevance broadly. "
        f"If clearly off-topic, gently redirect to the lesson material. "
        f"Keep your answer concise. Respond in {locale}."
    )

    prompt = f"{system_context}\n\nStudent question: {question}"
    endpoint = f"{_GEMINI_BASE_URL}/{_GEMINI_COURSE_MODEL}:generateContent"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 512,
        },
    }

    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(endpoint, params={"key": api_key}, json=payload)
            response.raise_for_status()
            data = response.json()
    except Exception:
        return "Could not get a response." if locale == "en" else "تعذر الحصول على رد."

    candidates = data.get("candidates") or []
    if not candidates:
        return ""

    parts = (candidates[0].get("content") or {}).get("parts") or []
    return "\n".join(p.get("text", "") for p in parts if p.get("text")).strip()
