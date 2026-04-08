from fastapi import APIRouter, Depends, Request

from app.core.i18n import get_request_locale
from app.core.security import CurrentUser, get_current_user
from app.modules.ai.schemas import ExplainRequest, ExplainResponse, TranslateRequest, TranslateResponse
from app.modules.ai.service import explain_text, translate_text

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/explain", response_model=ExplainResponse)
def explain(
    payload: ExplainRequest,
    request: Request,
    _current_user: CurrentUser = Depends(get_current_user),
) -> ExplainResponse:
    return explain_text(payload, locale=get_request_locale(request))


@router.post("/translate", response_model=TranslateResponse)
def translate(
    payload: TranslateRequest,
    request: Request,
    _current_user: CurrentUser = Depends(get_current_user),
) -> TranslateResponse:
    return translate_text(payload, locale=get_request_locale(request))
