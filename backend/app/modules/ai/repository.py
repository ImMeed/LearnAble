from __future__ import annotations

import json
import base64
import time
from typing import Final

import httpx
from pypdf import PdfReader

from app.core.config import settings


_GEMINI_MODEL: Final[str] = "gemini-2.5-flash"
_GEMINI_COURSE_MODEL: Final[str] = "gemini-2.5-flash"
_GEMINI_BASE_URL: Final[str] = "https://generativelanguage.googleapis.com/v1beta/models"
_RETRYABLE_STATUS_CODES: Final[set[int]] = {429, 500, 503, 504}


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


def _extract_candidate_text(data: dict) -> str:
    candidates = data.get("candidates") or []
    if not candidates:
        return ""
    parts = (candidates[0].get("content") or {}).get("parts") or []
    return "\n".join(p.get("text", "") for p in parts if p.get("text")).strip()


def _post_gemini_with_retries(
    *,
    endpoint: str,
    api_key: str,
    payload: dict,
    timeout_seconds: float,
    max_attempts: int = 4,
) -> dict:
    last_exc: Exception | None = None

    for attempt in range(max_attempts):
        try:
            with httpx.Client(timeout=timeout_seconds) as client:
                response = client.post(endpoint, params={"key": api_key}, json=payload)

            if response.status_code in _RETRYABLE_STATUS_CODES and attempt < max_attempts - 1:
                time.sleep(2 ** attempt)
                continue

            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as exc:
            last_exc = exc
            code = exc.response.status_code
            if code in _RETRYABLE_STATUS_CODES and attempt < max_attempts - 1:
                time.sleep(2 ** attempt)
                continue
            raise GeminiError(f"Gemini API HTTP error: {code}") from exc
        except httpx.RequestError as exc:
            last_exc = exc
            if attempt < max_attempts - 1:
                time.sleep(2 ** attempt)
                continue
            raise GeminiError(f"Gemini API request error: {exc}") from exc

    raise GeminiError(f"Gemini API unavailable after retries: {last_exc}")


def _fallback_flashcards(locale: str) -> list[dict[str, str]]:
    if locale == "ar":
        return [
            {"front": "ما الفكرة الرئيسية لهذا الدرس؟", "back": "الفكرة الرئيسية تركز على فهم الأساسيات ثم تطبيقها بشكل عملي."},
            {"front": "لماذا هذا الموضوع مهم؟", "back": "لأنه يساعدك على بناء فهم واضح يمكن استخدامه في مواقف دراسية مختلفة."},
            {"front": "ما أول خطوة للتطبيق؟", "back": "ابدأ بتحديد المفهوم الأساسي ثم اربطه بمثال بسيط من الواقع."},
            {"front": "كيف أتأكد أنني فهمت؟", "back": "اشرح الفكرة بكلماتك الخاصة وحاول حل سؤال تطبيقي قصير."},
            {"front": "ما الخطأ الشائع؟", "back": "الانتقال للتفاصيل قبل تثبيت المفاهيم الأساسية."},
            {"front": "ما أفضل طريقة للمراجعة؟", "back": "قسم المحتوى إلى نقاط قصيرة وراجعها على فترات متباعدة."},
            {"front": "كيف أطبق الفكرة في الحياة اليومية؟", "back": "ابحث عن موقف مشابه واستخدم نفس خطوات التحليل التي تعلمتها."},
            {"front": "متى أطلب المساعدة؟", "back": "إذا تكرر الالتباس بعد المراجعة الذاتية، اسأل المعلم أو المساعد فوراً."},
        ]
    return [
        {"front": "What is the lesson's main idea?", "back": "The main idea is to understand the core concept first, then apply it in practice."},
        {"front": "Why is this topic important?", "back": "It builds a clear foundation you can reuse in different learning situations."},
        {"front": "What is the first application step?", "back": "Identify the core concept and connect it to one simple real-life example."},
        {"front": "How can I check my understanding?", "back": "Explain the idea in your own words and solve one short practice question."},
        {"front": "What is a common mistake?", "back": "Jumping to details before mastering the fundamentals."},
        {"front": "What is the best review method?", "back": "Break content into short points and review them in spaced intervals."},
        {"front": "How can I apply this daily?", "back": "Find a similar situation and reuse the same analysis steps."},
        {"front": "When should I ask for help?", "back": "If confusion repeats after review, ask your teacher or tutor assistant early."},
    ]


def _fallback_quiz(locale: str) -> list[dict[str, str | list[str]]]:
    if locale == "ar":
        return [
            {
                "question": "ما أفضل طريقة لبدء فهم موضوع جديد؟",
                "options": ["التركيز على الفكرة الأساسية", "حفظ التفاصيل مباشرة", "تجاهل الأمثلة", "قراءة سريعة فقط"],
                "correct": "التركيز على الفكرة الأساسية",
                "explanation": "ابدأ دائماً بالمفهوم الأساسي قبل التفاصيل.",
            },
            {
                "question": "متى تكون المراجعة أكثر فعالية؟",
                "options": ["مرة واحدة فقط", "على فترات متباعدة", "قبل الاختبار فقط", "بدون كتابة ملاحظات"],
                "correct": "على فترات متباعدة",
                "explanation": "المراجعة المتباعدة تحسن التذكر على المدى الطويل.",
            },
            {
                "question": "ما الخطوة التي تثبت الفهم؟",
                "options": ["شرح الفكرة بكلماتك", "نسخ النص حرفياً", "تجاوز الأسئلة", "حفظ الإجابات"],
                "correct": "شرح الفكرة بكلماتك",
                "explanation": "إعادة الصياغة دليل قوي على الفهم الحقيقي.",
            },
            {
                "question": "كيف تتعامل مع صعوبة مستمرة؟",
                "options": ["تجاهلها", "طلب المساعدة", "الانتقال لموضوع آخر", "إيقاف الدراسة"],
                "correct": "طلب المساعدة",
                "explanation": "طلب المساعدة المبكر يمنع تراكم الفجوات.",
            },
            {
                "question": "ما الهدف من الأمثلة العملية؟",
                "options": ["ربط النظرية بالتطبيق", "زيادة الحفظ فقط", "إطالة الدرس", "استبدال الفهم"],
                "correct": "ربط النظرية بالتطبيق",
                "explanation": "الأمثلة تساعدك على تحويل المفهوم إلى استخدام فعلي.",
            },
            {
                "question": "ما أفضل ترتيب للتعلم؟",
                "options": ["أساسيات ثم تطبيق", "تفاصيل ثم أساسيات", "اختبار قبل فهم", "مراجعة بلا قراءة"],
                "correct": "أساسيات ثم تطبيق",
                "explanation": "التدرج من الأساسيات إلى التطبيق هو الأكثر ثباتاً.",
            },
        ]

    return [
        {
            "question": "What is the best way to start a new topic?",
            "options": ["Focus on the core idea", "Memorize details first", "Skip examples", "Read quickly only"],
            "correct": "Focus on the core idea",
            "explanation": "Start with the central concept before diving into details.",
        },
        {
            "question": "When is review most effective?",
            "options": ["Only once", "At spaced intervals", "Only before exams", "Without notes"],
            "correct": "At spaced intervals",
            "explanation": "Spaced review improves long-term retention.",
        },
        {
            "question": "Which action confirms understanding?",
            "options": ["Explain in your own words", "Copy text exactly", "Skip questions", "Memorize answers"],
            "correct": "Explain in your own words",
            "explanation": "Rephrasing is strong evidence of real understanding.",
        },
        {
            "question": "How should you handle persistent difficulty?",
            "options": ["Ignore it", "Ask for help", "Switch topics immediately", "Stop studying"],
            "correct": "Ask for help",
            "explanation": "Early help prevents learning gaps from growing.",
        },
        {
            "question": "Why are practical examples useful?",
            "options": ["Connect theory to use", "Only increase memorization", "Make lessons longer", "Replace understanding"],
            "correct": "Connect theory to use",
            "explanation": "Examples turn abstract ideas into actionable understanding.",
        },
        {
            "question": "What is the strongest learning sequence?",
            "options": ["Basics then application", "Details then basics", "Quiz before understanding", "Review without reading"],
            "correct": "Basics then application",
            "explanation": "A fundamentals-first sequence leads to better outcomes.",
        },
    ]


def _normalize_flashcards(raw_value: object, locale: str) -> list[dict[str, str]]:
    data = raw_value
    if isinstance(data, dict):
        for key in ("items", "cards", "flashcards", "data"):
            candidate = data.get(key)
            if isinstance(candidate, list):
                data = candidate
                break

    if not isinstance(data, list):
        return _fallback_flashcards(locale)

    cards: list[dict[str, str]] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        front = str(item.get("front", "")).strip()
        back = str(item.get("back", "")).strip()
        if not front or not back:
            continue
        cards.append({"front": front, "back": back})
        if len(cards) >= 8:
            break

    if not cards:
        return _fallback_flashcards(locale)
    if len(cards) < 8:
        for fallback in _fallback_flashcards(locale):
            if len(cards) >= 8:
                break
            cards.append(fallback)
    return cards[:8]


def _resolve_correct_option(correct_value: str, options: list[str]) -> str:
    normalized = correct_value.strip()
    if not normalized:
        return options[0]

    # Already an option text.
    if normalized in options:
        return normalized

    compact = normalized.upper().strip()
    if compact.endswith(")") or compact.endswith("."):
        compact = compact[:-1].strip()

    # Letter forms: A / B / C / D.
    if compact in {"A", "B", "C", "D"}:
        index = ord(compact) - ord("A")
        if 0 <= index < len(options):
            return options[index]

    # Numeric forms: 1..4.
    if compact.isdigit():
        index = int(compact) - 1
        if 0 <= index < len(options):
            return options[index]

    # Mixed forms like "A) option" or "B. option".
    lead = compact[:1]
    if lead in {"A", "B", "C", "D"}:
        index = ord(lead) - ord("A")
        if 0 <= index < len(options):
            return options[index]

    return options[0]


def _normalize_quiz_questions(raw_value: object, locale: str) -> list[dict[str, str | list[str]]]:
    data = raw_value
    if isinstance(data, dict):
        for key in ("questions", "items", "quiz", "data"):
            candidate = data.get(key)
            if isinstance(candidate, list):
                data = candidate
                break

    if not isinstance(data, list):
        return _fallback_quiz(locale)

    questions: list[dict[str, str | list[str]]] = []
    for item in data:
        if not isinstance(item, dict):
            continue

        question = str(item.get("question", "")).strip()
        options_raw = item.get("options")
        explanation = str(item.get("explanation", "")).strip()
        correct_raw = str(item.get("correct", "")).strip()

        if not question or not isinstance(options_raw, list):
            continue

        options = [str(option).strip() for option in options_raw if str(option).strip()]
        if len(options) < 2:
            continue

        if len(options) > 4:
            options = options[:4]

        questions.append(
            {
                "question": question,
                "options": options,
                "correct": _resolve_correct_option(correct_raw, options),
                "explanation": explanation or ("راجع الفكرة الأساسية في الدرس." if locale == "ar" else "Review the core idea in the lesson."),
            }
        )
        if len(questions) >= 6:
            break

    if not questions:
        return _fallback_quiz(locale)
    if len(questions) < 6:
        for fallback in _fallback_quiz(locale):
            if len(questions) >= 6:
                break
            questions.append(fallback)
    return questions[:6]


def _fallback_assist_response(locale: str) -> str:
    return (
        "عذرًا، حدث ضغط على خدمة الذكاء الاصطناعي. حاول مرة أخرى بعد قليل، أو اطرح السؤال بصيغة أقصر."
        if locale == "ar"
        else "The AI service is currently busy. Please try again in a moment, or ask a shorter question."
    )


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

    last_exc: Exception | None = None
    data = None
    for attempt in range(4):
        try:
            with httpx.Client(timeout=120.0) as client:
                response = client.post(endpoint, params={"key": api_key}, json=payload)
                if response.status_code in (429, 500, 503, 504) and attempt < 3:
                    time.sleep(2 ** attempt)
                    continue
                response.raise_for_status()
                data = response.json()
                break
        except httpx.HTTPStatusError as exc:
            last_exc = exc
            raise GeminiError(f"Gemini API HTTP error: {exc.response.status_code}") from exc
        except httpx.RequestError as exc:
            last_exc = exc
            if attempt < 3:
                time.sleep(2 ** attempt)
                continue
            raise GeminiError(f"Gemini API request error: {exc}") from exc
    if data is None:
        raise GeminiError(f"Gemini API unavailable after retries: {last_exc}")

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
        return _fallback_flashcards(locale)
    
    api_key = settings.gemini_api_key.strip()
    if not api_key:
        return _fallback_flashcards(locale)

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
        data = _post_gemini_with_retries(
            endpoint=endpoint,
            api_key=api_key,
            payload=payload,
            timeout_seconds=30.0,
        )
        raw = _extract_candidate_text(data)
        if not raw:
            return _fallback_flashcards(locale)
        parsed = json.loads(_strip_json_fence(raw))
        return _normalize_flashcards(parsed, locale)
    except Exception:
        return _fallback_flashcards(locale)


def generate_quiz(course_title: str, course_content: str, locale: str) -> list:
    """Generate exactly 6 MCQ questions from course content."""
    # Return mock quiz if mock mode is enabled
    if settings.gemini_mock:
        return _fallback_quiz(locale)
    
    api_key = settings.gemini_api_key.strip()
    if not api_key:
        return _fallback_quiz(locale)

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
        data = _post_gemini_with_retries(
            endpoint=endpoint,
            api_key=api_key,
            payload=payload,
            timeout_seconds=30.0,
        )
        raw = _extract_candidate_text(data)
        if not raw:
            return _fallback_quiz(locale)
        parsed = json.loads(_strip_json_fence(raw))
        return _normalize_quiz_questions(parsed, locale)
    except Exception:
        return _fallback_quiz(locale)


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
        return _fallback_assist_response(locale)

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
        data = _post_gemini_with_retries(
            endpoint=endpoint,
            api_key=api_key,
            payload=payload,
            timeout_seconds=30.0,
        )
        answer = _extract_candidate_text(data)
        return answer or _fallback_assist_response(locale)
    except Exception:
        return _fallback_assist_response(locale)
