from uuid import UUID

from fastapi import status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.i18n import localized_http_exception
from app.core.security import CurrentUser
from app.db.models.economy import PointTransaction, PointTransactionType, PointsWallet
from app.modules.library import repository
from app.modules.library.schemas import BookDetailResponse, BookSummary, ReadBookResponse, RedeemBookResponse


def _to_book_summary(book, locale: str, owned: bool) -> BookSummary:
    title = book.title_ar if locale == "ar" else book.title_en
    author = book.author_ar if locale == "ar" else book.author_en
    summary = book.summary_ar if locale == "ar" else book.summary_en
    return BookSummary(
        id=book.id,
        title=title,
        author=author,
        summary=summary,
        cover_image_url=book.cover_image_url,
        points_cost=book.points_cost,
        owned=owned,
    )


def get_books(session: Session, locale: str, current_user: CurrentUser | None) -> list[BookSummary]:
    books = repository.list_books(session)
    owned_ids: set[UUID] = set()
    if current_user is not None:
        owned_books = repository.list_owned_books(session, current_user.user_id)
        owned_ids = {book.id for book in owned_books}
    return [_to_book_summary(book, locale, book.id in owned_ids) for book in books]


def get_book_detail(session: Session, book_id: UUID, locale: str, current_user: CurrentUser | None) -> BookDetailResponse:
    book = repository.get_book(session, book_id)
    if book is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "BOOK_NOT_FOUND", locale)

    owned = current_user is not None and repository.has_purchase(session, current_user.user_id, book_id)
    summary = _to_book_summary(book, locale, owned)
    return BookDetailResponse(**summary.model_dump(), reader_url=book.reader_url)


def get_my_library(session: Session, current_user: CurrentUser, locale: str) -> list[BookSummary]:
    owned_books = repository.list_owned_books(session, current_user.user_id)
    return [_to_book_summary(book, locale, True) for book in owned_books]


def redeem_book(session: Session, book_id: UUID, current_user: CurrentUser, locale: str) -> RedeemBookResponse:
    book = repository.get_book(session, book_id)
    if book is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "BOOK_NOT_FOUND", locale)

    existing_purchase = repository.get_latest_purchase(session, current_user.user_id, book_id)
    if existing_purchase is not None:
        wallet = session.get(PointsWallet, current_user.user_id)
        balance = wallet.balance_points if wallet is not None else 0
        return RedeemBookResponse(
            book_id=book_id,
            points_spent=0,
            wallet_balance=balance,
            already_owned=True,
        )

    try:
        wallet = session.scalar(
            select(PointsWallet).where(PointsWallet.user_id == current_user.user_id).with_for_update()
        )
        if wallet is None:
            wallet = PointsWallet(user_id=current_user.user_id, balance_points=0)
            session.add(wallet)
            session.flush()

        if wallet.balance_points < book.points_cost:
            raise localized_http_exception(status.HTTP_409_CONFLICT, "INSUFFICIENT_POINTS", locale)

        wallet.balance_points = wallet.balance_points - book.points_cost
        session.add(
            PointTransaction(
                user_id=current_user.user_id,
                type=PointTransactionType.BOOK_REDEEM,
                points_delta=-book.points_cost,
                reason="book_redeem",
                metadata_json={"book_id": str(book_id)},
            )
        )

        repository.create_purchase(session, current_user.user_id, book_id, book.points_cost)
        session.commit()
        wallet_balance = wallet.balance_points
    except IntegrityError:
        session.rollback()
        existing_after_race = repository.get_latest_purchase(session, current_user.user_id, book_id)
        if existing_after_race is None:
            raise
        wallet_after_race = session.get(PointsWallet, current_user.user_id)
        return RedeemBookResponse(
            book_id=book_id,
            points_spent=0,
            wallet_balance=wallet_after_race.balance_points if wallet_after_race is not None else 0,
            already_owned=True,
        )
    except Exception:
        session.rollback()
        raise

    return RedeemBookResponse(
        book_id=book_id,
        points_spent=book.points_cost,
        wallet_balance=wallet_balance,
        already_owned=False,
    )


def read_book(session: Session, book_id: UUID, current_user: CurrentUser, locale: str) -> ReadBookResponse:
    book = repository.get_book(session, book_id)
    if book is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "BOOK_NOT_FOUND", locale)

    if not repository.has_purchase(session, current_user.user_id, book_id):
        raise localized_http_exception(status.HTTP_403_FORBIDDEN, "BOOK_NOT_OWNED", locale)

    title = book.title_ar if locale == "ar" else book.title_en
    return ReadBookResponse(book_id=book.id, title=title, reader_url=book.reader_url)
