from uuid import UUID

from sqlalchemy import Select, exists, select
from sqlalchemy.orm import Session

from app.db.models.library import Book, DigitalPurchase


def _active_books_query() -> Select[tuple[Book]]:
    return select(Book).where(Book.is_active.is_(True)).order_by(Book.created_at.desc())


def list_books(session: Session) -> list[Book]:
    return list(session.scalars(_active_books_query()))


def get_book(session: Session, book_id: UUID) -> Book | None:
    stmt = select(Book).where(Book.id == book_id, Book.is_active.is_(True))
    return session.scalar(stmt)


def list_owned_books(session: Session, user_id: UUID) -> list[Book]:
    stmt = (
        _active_books_query()
        .join(DigitalPurchase, DigitalPurchase.book_id == Book.id)
        .where(DigitalPurchase.user_id == user_id)
    )
    return list(session.scalars(stmt))


def has_purchase(session: Session, user_id: UUID, book_id: UUID) -> bool:
    stmt = select(exists().where(DigitalPurchase.user_id == user_id, DigitalPurchase.book_id == book_id))
    return bool(session.scalar(stmt))


def create_purchase(session: Session, user_id: UUID, book_id: UUID, points_spent: int) -> DigitalPurchase:
    purchase = DigitalPurchase(user_id=user_id, book_id=book_id, points_spent=points_spent)
    session.add(purchase)
    session.flush()
    return purchase


def get_latest_purchase(session: Session, user_id: UUID, book_id: UUID) -> DigitalPurchase | None:
    stmt = (
        select(DigitalPurchase)
        .where(DigitalPurchase.user_id == user_id, DigitalPurchase.book_id == book_id)
        .order_by(DigitalPurchase.created_at.desc())
    )
    return session.scalar(stmt)
