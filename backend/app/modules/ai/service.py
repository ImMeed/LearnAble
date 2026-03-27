from app.modules.ai import repository
from app.modules.ai.schemas import ExplainRequest, TranslateRequest


def explain_text(payload: ExplainRequest) -> str:
    return repository.build_explanation(payload)


def translate_text(payload: TranslateRequest) -> str:
    return repository.build_translation(payload)
