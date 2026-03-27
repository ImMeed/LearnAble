from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db_session
from app.modules.forum.schemas import SpaceListResponse
from app.modules.forum.service import get_spaces

router = APIRouter(prefix="/forum", tags=["forum"])


@router.get("/spaces", response_model=SpaceListResponse)
def list_spaces(session: Session = Depends(get_db_session)) -> SpaceListResponse:
    return SpaceListResponse(items=get_spaces(session))
