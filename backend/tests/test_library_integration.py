from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.core.roles import UserRole
from app.core.security import create_access_token
from app.db.base import Base
from app.db.models.economy import PointTransaction, PointTransactionType, PointsWallet
from app.db.models.library import Book, DigitalPurchase
from app.db.models.users import User
from app.db.session import get_db_session
from app.main import app

TEST_DATABASE_URL = "postgresql+psycopg://learnable:learnable@localhost:5433/learnable"

engine = create_engine(TEST_DATABASE_URL, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base.metadata.create_all(bind=engine)


def _make_client(session: Session) -> TestClient:
    def override_get_db_session():
        yield session

    app.dependency_overrides[get_db_session] = override_get_db_session
    return TestClient(app)


def _seed_student_and_book(session: Session, initial_points: int) -> tuple[str, UUID, UUID]:
    user = User(
        email=f"library-student-{uuid4()}@learnable.test",
        password_hash="integration-test-hash",
        role=UserRole.ROLE_STUDENT,
    )
    session.add(user)
    session.flush()

    session.add(PointsWallet(user_id=user.id, balance_points=initial_points))

    book = Book(
        title_ar="كتاب القراءة",
        title_en="Reading Book",
        author_ar="فريق LearnAble",
        author_en="LearnAble Team",
        summary_ar="ملخص عربي",
        summary_en="English summary",
        reader_url="https://cdn.learnable.test/books/reading-book",
        points_cost=5,
        is_active=True,
    )
    session.add(book)
    session.commit()

    token = create_access_token(user.id, str(user.role), user.email)
    return token, user.id, book.id


def test_redeem_book_is_atomic_and_readable_after_purchase() -> None:
    session = SessionLocal()
    client = _make_client(session)
    try:
        token, user_id, book_id = _seed_student_and_book(session, initial_points=10)
        headers = {"Authorization": f"Bearer {token}", "x-lang": "en"}

        list_response = client.get("/books", headers=headers)
        assert list_response.status_code == 200
        items = list_response.json()["items"]
        assert len(items) >= 1
        assert any(item["id"] == str(book_id) and item["owned"] is False for item in items)

        redeem_response = client.post(f"/library/books/{book_id}/redeem", headers=headers)
        assert redeem_response.status_code == 200
        redeem_data = redeem_response.json()
        assert redeem_data["points_spent"] == 5
        assert redeem_data["wallet_balance"] == 5
        assert redeem_data["already_owned"] is False

        wallet_balance = session.scalar(
            select(PointsWallet.balance_points).where(PointsWallet.user_id == user_id)
        )
        assert wallet_balance == 5

        purchases = list(
            session.scalars(
                select(DigitalPurchase).where(DigitalPurchase.user_id == user_id, DigitalPurchase.book_id == book_id)
            )
        )
        assert len(purchases) == 1

        txs = list(
            session.scalars(
                select(PointTransaction).where(PointTransaction.user_id == user_id).order_by(PointTransaction.created_at.asc())
            )
        )
        assert any(tx.type == PointTransactionType.BOOK_REDEEM and tx.points_delta == -5 for tx in txs)

        read_response = client.get(f"/books/{book_id}/read", headers=headers)
        assert read_response.status_code == 200
        assert read_response.json()["book_id"] == str(book_id)

        second_redeem_response = client.post(f"/library/books/{book_id}/redeem", headers=headers)
        assert second_redeem_response.status_code == 200
        second_data = second_redeem_response.json()
        assert second_data["already_owned"] is True
        assert second_data["points_spent"] == 0

        txs_after = list(
            session.scalars(
                select(PointTransaction).where(PointTransaction.user_id == user_id).order_by(PointTransaction.created_at.asc())
            )
        )
        assert len(txs_after) == len(txs)
    finally:
        app.dependency_overrides.clear()
        client.close()
        session.close()


def test_redeem_requires_enough_points_and_read_requires_entitlement() -> None:
    session = SessionLocal()
    client = _make_client(session)
    try:
        token, user_id, book_id = _seed_student_and_book(session, initial_points=1)
        headers = {"Authorization": f"Bearer {token}", "x-lang": "en"}

        redeem_response = client.post(f"/library/books/{book_id}/redeem", headers=headers)
        assert redeem_response.status_code == 409
        redeem_data = redeem_response.json()
        assert redeem_data["code"] == "INSUFFICIENT_POINTS"

        purchases = list(
            session.scalars(
                select(DigitalPurchase).where(DigitalPurchase.user_id == user_id, DigitalPurchase.book_id == book_id)
            )
        )
        assert len(purchases) == 0

        wallet_balance = session.scalar(
            select(PointsWallet.balance_points).where(PointsWallet.user_id == user_id)
        )
        assert wallet_balance == 1

        read_response = client.get(f"/books/{book_id}/read", headers=headers)
        assert read_response.status_code == 403
        read_data = read_response.json()
        assert read_data["code"] == "BOOK_NOT_OWNED"
    finally:
        app.dependency_overrides.clear()
        client.close()
        session.close()
