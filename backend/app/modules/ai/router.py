from fastapi import APIRouter
 
from app.modules.ai.schemas import ExplainRequest, ExplainResponse, TranslateRequest, TranslateResponse
from app.modules.ai.service import explain_text, translate_text

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/explain", response_model=ExplainResponse)
def explain(payload: ExplainRequest) -> ExplainResponse:
    return ExplainResponse(explanation=explain_text(payload))


@router.post("/translate", response_model=TranslateResponse)
def translate(payload: TranslateRequest) -> TranslateResponse:
    return TranslateResponse(translation=translate_text(payload))
