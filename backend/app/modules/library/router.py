from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi import Request
from sqlalchemy.orm import Session

from app.core.i18n import get_request_locale
from app.core.roles import UserRole, require_roles
from app.core.security import CurrentUser, get_current_user
from app.db.session import get_db_session
from app.modules.library.schemas import BookDetailResponse, BookListResponse, ReadBookResponse, RedeemBookResponse
from app.modules.library.service import get_book_detail, get_books, get_my_library, read_book, redeem_book

router = APIRouter(tags=["library"])


@router.get("/books", response_model=BookListResponse)
def list_books(
    request: Request,
    session: Session = Depends(get_db_session),
    current_user: CurrentUser = Depends(get_current_user),
) -> BookListResponse:
    return BookListResponse(items=get_books(session, get_request_locale(request), current_user))


@router.get("/books/{book_id}", response_model=BookDetailResponse)
def get_book(
    book_id: UUID,
    request: Request,
    session: Session = Depends(get_db_session),
    current_user: CurrentUser = Depends(get_current_user),
) -> BookDetailResponse:
    return get_book_detail(session, book_id, get_request_locale(request), current_user)


@router.get("/my-library", response_model=BookListResponse)
def my_library(
    request: Request,
    session: Session = Depends(get_db_session),
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_STUDENT)),
) -> BookListResponse:
    return BookListResponse(items=get_my_library(session, current_user, get_request_locale(request)))


@router.post("/library/books/{book_id}/redeem", response_model=RedeemBookResponse)
def redeem(
    book_id: UUID,
    request: Request,
    session: Session = Depends(get_db_session),
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_STUDENT)),
) -> RedeemBookResponse:
    return redeem_book(session, book_id, current_user, get_request_locale(request))


@router.get("/books/{book_id}/read", response_model=ReadBookResponse)
def read(
    book_id: UUID,
    request: Request,
    session: Session = Depends(get_db_session),
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_STUDENT)),
) -> ReadBookResponse:
    return read_book(session, book_id, current_user, get_request_locale(request))
