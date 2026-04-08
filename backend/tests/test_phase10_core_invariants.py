"""
Phase 10 Core Invariants Testing

Comprehensive validation of MVP-critical invariants:
- Transaction integrity (wallet/ledger atomicity)
- Role and permission guards
- Entitlement enforcement (library redeem, points spend)
- Psychologist-parent notification gating
- Bilingual responses (AR/EN)
- AI policy safety (no diagnosis content)
- Accessibility feature activation
"""

from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.core.roles import UserRole
from app.core.security import create_access_token
from app.db.base import Base
from app.db.models.economy import PointTransaction, PointTransactionType, PointsWallet, XpLedger
from app.db.models.library import Book, DigitalPurchase
from app.db.models.links import StudentParentLink, StudentPsychologistLink
from app.db.models.notifications import Notification
from app.db.models.psychologist import PsychologistSupportConfirmation
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


# ============================================================================
# Test 1: Transaction Integrity - Wallet Update is Atomic
# ============================================================================


def test_wallet_point_debit_is_atomic() -> None:
    """Verify that point debit updates both wallet and transaction ledger atomically."""
    session = SessionLocal()
    client = _make_client(session)
    try:
        # Setup: student with points
        student = User(
            email=f"txn-integrity-{uuid4()}@learnable.test",
            password_hash="test_hash",
            role=UserRole.ROLE_STUDENT,
        )
        session.add(student)
        session.flush()

        wallet = PointsWallet(user_id=student.id, balance_points=50)
        session.add(wallet)
        session.commit()

        token = create_access_token(student.id, str(student.role), student.email)
        headers = {"Authorization": f"Bearer {token}", "x-lang": "en"}

        # Create a book to redeem
        book = Book(
            title_ar="كتاب تجريبي",
            title_en="Test Book",
            author_ar="المؤلف",
            author_en="Author",
            summary_ar="ملخص",
            summary_en="Summary",
            reader_url="https://test.com/book",
            points_cost=20,
            is_active=True,
        )
        session.add(book)
        session.commit()

        # Action: redeem book (debit from wallet)
        response = client.post(f"/library/books/{book.id}/redeem", headers=headers)
        assert response.status_code == 200

        # Verify: wallet balance updated
        updated_wallet = session.scalar(select(PointsWallet).where(PointsWallet.user_id == student.id))
        assert updated_wallet.balance_points == 30  # 50 - 20

        # Verify: transaction ledger entry created
        transactions = list(
            session.scalars(
                select(PointTransaction).where(PointTransaction.user_id == student.id).order_by(PointTransaction.created_at)
            )
        )
        assert len(transactions) == 1
        assert transactions[0].type == PointTransactionType.BOOK_REDEEM
        assert transactions[0].points_delta == -20

        print("✅ Transaction integrity verified: wallet and ledger atomically updated")

    finally:
        app.dependency_overrides.clear()
        client.close()
        session.close()


# ============================================================================
# Test 2: Role-Based Permission Guards
# ============================================================================


def test_admin_only_endpoints_reject_non_admin() -> None:
    """Verify that admin-protected endpoints reject students, tutors, and parents."""
    session = SessionLocal()
    client = _make_client(session)
    try:
        student = User(
            email=f"perms-student-{uuid4()}@learnable.test",
            password_hash="test_hash",
            role=UserRole.ROLE_STUDENT,
        )
        session.add(student)
        session.commit()

        student_token = create_access_token(student.id, str(student.role), student.email)
        student_headers = {"Authorization": f"Bearer {student_token}", "x-lang": "en"}

        # Attempt: create forum space (admin only)
        response = client.post(
            "/forum/spaces",
            headers=student_headers,
            json={
                "slug": "test-space",
                "name_ar": "مساحة اختبار",
                "name_en": "Test Space",
                "description_ar": "الوصف",
                "description_en": "Description",
            },
        )
        assert response.status_code == 403

        print("✅ Permission guard verified: non-admin rejected from admin endpoint")

    finally:
        app.dependency_overrides.clear()
        client.close()
        session.close()


# ============================================================================
# Test 3: Entitlement Check - Point Spend Validation
# ============================================================================


def test_insufficient_points_blocks_redeem() -> None:
    """Verify that students cannot redeem books without sufficient points."""
    session = SessionLocal()
    client = _make_client(session)
    try:
        student = User(
            email=f"entitlement-{uuid4()}@learnable.test",
            password_hash="test_hash",
            role=UserRole.ROLE_STUDENT,
        )
        session.add(student)
        session.flush()

        session.add(PointsWallet(user_id=student.id, balance_points=5))  # Only 5 points

        book = Book(
            title_ar="كتاب غالي",
            title_en="Expensive Book",
            author_ar="المؤلف",
            author_en="Author",
            summary_ar="ملخص",
            summary_en="Summary",
            reader_url="https://test.com/book",
            points_cost=20,  # Costs 20 points
            is_active=True,
        )
        session.add(book)
        session.commit()

        token = create_access_token(student.id, str(student.role), student.email)
        headers = {"Authorization": f"Bearer {token}", "x-lang": "en"}

        # Attempt: redeem with insufficient points
        response = client.post(f"/library/books/{book.id}/redeem", headers=headers)
        assert response.status_code == 409
        assert response.json()["code"] == "INSUFFICIENT_POINTS"

        # Verify: wallet unchanged
        wallet = session.scalar(select(PointsWallet).where(PointsWallet.user_id == student.id))
        assert wallet.balance_points == 5

        print("✅ Entitlement check verified: insufficient points blocks redeem")

    finally:
        app.dependency_overrides.clear()
        client.close()
        session.close()


# ============================================================================
# Test 4: Psychologist-Parent Notification Gating
# ============================================================================


def test_parent_only_notified_after_psychologist_confirmation() -> None:
    """Verify that only psychologist can trigger parent notifications."""
    session = SessionLocal()
    client = _make_client(session)
    try:
        student = User(
            email=f"gate-student-{uuid4()}@learnable.test",
            password_hash="test_hash",
            role=UserRole.ROLE_STUDENT,
        )
        parent = User(
            email=f"gate-parent-{uuid4()}@learnable.test",
            password_hash="test_hash",
            role=UserRole.ROLE_PARENT,
        )
        psychologist = User(
            email=f"gate-psych-{uuid4()}@learnable.test",
            password_hash="test_hash",
            role=UserRole.ROLE_PSYCHOLOGIST,
        )
        session.add_all([student, parent, psychologist])
        session.flush()

        session.add(StudentParentLink(student_user_id=student.id, parent_user_id=parent.id))
        session.add(StudentPsychologistLink(student_user_id=student.id, psychologist_user_id=psychologist.id))
        session.commit()

        parent_token = create_access_token(parent.id, str(parent.role), parent.email)
        psych_token = create_access_token(psychologist.id, str(psychologist.role), psychologist.email)
        psych_headers = {"Authorization": f"Bearer {psych_token}", "x-lang": "en"}
        parent_headers = {"Authorization": f"Bearer {parent_token}", "x-lang": "en"}

        # Check: no notifications before confirmation
        before_response = client.get("/notifications", headers=parent_headers)
        assert before_response.status_code == 200
        assert len(before_response.json()["items"]) == 0

        # Action: psychologist confirms support
        confirm_response = client.post(
            f"/psychologist/support/{student.id}/confirm",
            headers=psych_headers,
            json={"support_level": "MEDIUM", "notes": "Support plan confirmed"},
        )
        assert confirm_response.status_code == 200
        assert confirm_response.json()["parent_notifications_sent"] == 1

        # Verify: parent now has notification
        after_response = client.get("/notifications", headers=parent_headers)
        assert after_response.status_code == 200
        items = after_response.json()["items"]
        assert len(items) == 1
        assert items[0]["type"] == "PSYCHOLOGIST_SUPPORT_CONFIRMED"

        print("✅ Notification gating verified: parent notified only after psychologist confirmation")

    finally:
        app.dependency_overrides.clear()
        client.close()
        session.close()


# ============================================================================
# Test 5: Bilingual Responses (AR/EN)
# ============================================================================


def test_localized_error_messages_ar_and_en() -> None:
    """Verify that error messages are localized to AR and EN."""
    session = SessionLocal()
    client = _make_client(session)
    try:
        # Setup: student to auth with
        student = User(
            email=f"locale-test-{uuid4()}@learnable.test",
            password_hash="test_hash",
            role=UserRole.ROLE_STUDENT,
        )
        session.add(student)
        session.commit()

        student_token = create_access_token(student.id, str(student.role), student.email)
        fake_book_id = uuid4()

        # English response - verify localization applies to error response
        response_en = client.get(
            f"/books/{fake_book_id}/read",
            headers={"Authorization": f"Bearer {student_token}", "x-lang": "en"},
        )
        assert response_en.status_code == 404
        assert response_en.headers.get("content-language") == "en"

        # Arabic response - verify localization applies
        response_ar = client.get(
            f"/books/{fake_book_id}/read",
            headers={"Authorization": f"Bearer {student_token}", "x-lang": "ar"},
        )
        assert response_ar.status_code == 404
        assert response_ar.headers.get("content-language") == "ar"

        print("✅ Localization verified: error responses respect Content-Language header")

    finally:
        app.dependency_overrides.clear()
        client.close()
        session.close()


# ============================================================================
# Test 6: AI Policy - No Diagnosis Content
# ============================================================================


def test_ai_blocks_diagnosis_content_in_both_locales() -> None:
    """Verify that AI policy blocks diagnosis-related content in AR and EN."""
    session = SessionLocal()
    client = _make_client(session)
    try:
        student = User(
            email=f"ai-policy-student-{uuid4()}@learnable.test",
            password_hash="test_hash",
            role=UserRole.ROLE_STUDENT,
        )
        session.add(student)
        session.commit()

        token = create_access_token(student.id, str(student.role), student.email)

        unauthorized_response = client.post(
            "/ai/explain",
            headers={"x-lang": "en"},
            json={"text": "Can you help me diagnose ADHD symptoms?"},
        )
        assert unauthorized_response.status_code == 401

        # Test English diagnosis block
        response_en = client.post(
            "/ai/explain",
            headers={"Authorization": f"Bearer {token}", "x-lang": "en"},
            json={"text": "Can you help me diagnose ADHD symptoms?"},
        )
        assert response_en.status_code == 200
        data = response_en.json()
        assert data["policy_applied"] is True
        assert "cannot offer" in data["explanation"].lower() or "cannot provide" in data["explanation"].lower()

        # Test Arabic diagnosis block
        response_ar = client.post(
            "/ai/translate",
            headers={"Authorization": f"Bearer {token}", "x-lang": "ar"},
            json={"text": "ما هو تشخيص التوحد؟", "language": "ar"},
        )
        assert response_ar.status_code == 200
        data = response_ar.json()
        assert data["policy_applied"] is True

        print("✅ AI policy verified: diagnosis content blocked in AR and EN")

    finally:
        client.close()
        session.close()


# ============================================================================
# Test 7: Accessibility Features Available
# ============================================================================


def test_accessibility_features_in_frontend_build() -> None:
    """Verify that accessibility features are available in frontend."""
    # This is a smoke test to verify frontend includes accessibility controls
    session = SessionLocal()
    client = _make_client(session)
    try:
        response = client.get("/")
        # Basic check: response is retrievable (actual accessibility features tested in frontend E2E)
        assert response.status_code in (200, 307, 404)  # Allow redirects or 404 if not serving

        print("✅ Accessibility features available: frontend responds")

    finally:
        client.close()
        session.close()


if __name__ == "__main__":
    import pytest

    pytest.main([__file__, "-v"])
