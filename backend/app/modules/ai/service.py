from app.modules.ai import repository
from app.modules.ai.policy import enforce_input_policy, enforce_output_policy
from app.modules.ai.schemas import ExplainRequest, ExplainResponse, TranslateRequest, TranslateResponse


def _build_explain_prompt(payload: ExplainRequest, locale: str) -> str:
    if locale == "en":
        context = f"Book: {payload.bookTitle}. " if payload.bookTitle else ""
        question = f"Question: {payload.question}. " if payload.question else ""
        return (
            "You are an educational assistant. Explain clearly and simply for learners. "
            "Do not provide any medical or psychological diagnosis. "
            f"{context}{question}Text: {payload.text}"
        )

    context = f"الكتاب: {payload.bookTitle}. " if payload.bookTitle else ""
    question = f"السؤال: {payload.question}. " if payload.question else ""
    return (
        "أنت مساعد تعليمي. اشرح المحتوى بطريقة مبسطة وواضحة للطلاب. "
        "لا تقدم أي تشخيص طبي أو نفسي. "
        f"{context}{question}النص: {payload.text}"
    )


def _build_translate_prompt(payload: TranslateRequest, locale: str) -> str:
    target = payload.language
    if locale == "en":
        return (
            "You are an educational translator. Translate faithfully while keeping a learner-friendly tone. "
            "Do not provide diagnosis or clinical advice. "
            f"Target language: {target}. Text: {payload.text}"
        )
    return (
        "أنت مترجم تعليمي. ترجم بدقة مع الحفاظ على أسلوب مناسب للمتعلمين. "
        "لا تقدم تشخيصاً أو نصائح سريرية. "
        f"لغة الهدف: {target}. النص: {payload.text}"
    )


def explain_text(payload: ExplainRequest, locale: str) -> ExplainResponse:
    input_policy = enforce_input_policy(payload.text, locale)
    if input_policy.blocked:
        return ExplainResponse(explanation=input_policy.text, policy_applied=True, locale=locale)

    prompt = _build_explain_prompt(payload, locale)
    raw = repository.generate_text(prompt, locale=locale, mode="explain")
    output_policy = enforce_output_policy(raw, locale)
    return ExplainResponse(
        explanation=output_policy.text,
        policy_applied=input_policy.policy_applied or output_policy.policy_applied,
        locale=locale,
    )


def translate_text(payload: TranslateRequest, locale: str) -> TranslateResponse:
    input_policy = enforce_input_policy(payload.text, locale)
    if input_policy.blocked:
        return TranslateResponse(translation=input_policy.text, policy_applied=True, locale=locale)

    prompt = _build_translate_prompt(payload, locale)
    raw = repository.generate_text(prompt, locale=locale, mode="translate")
    output_policy = enforce_output_policy(raw, locale)
    return TranslateResponse(
        translation=output_policy.text,
        policy_applied=input_policy.policy_applied or output_policy.policy_applied,
        locale=locale,
    )
