from app.modules.ai.schemas import ExplainRequest, TranslateRequest


def build_explanation(payload: ExplainRequest) -> str:
    # TODO: wire Gemini provider client in Phase 7.
    return f"شرح مبسط: {payload.text}"


def build_translation(payload: TranslateRequest) -> str:
    # TODO: wire Gemini provider client in Phase 7.
    return payload.text
