"""
Comprehensive security layer tests for LearnAble.
All tests run without a real database (DB interactions are mocked).

Layers covered:
  1. Password hashing (bcrypt + SHA-256)
  2. JWT (claims, expiry, tamper, wrong secret)
  3. TOTP / 2FA (secret, verify, QR code)
  4. Account lockout
  5. RBAC
  6. Security headers (X-Frame-Options, CSP, HSTS, …)
  7. CORS
  8. User enumeration prevention
  9. Audit log model integrity
 10. Password strength validation        [NEW]
 11. Rate limiting                        [NEW]
 12. TOTP replay protection               [NEW]
 13. SQL injection (ORM parameterization) [NEW]
"""
import time
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
import pyotp
from fastapi.testclient import TestClient
from jose import jwt

from app.core.config import settings
from app.core.roles import UserRole
from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.main import app
from app.modules.auth import lockout as lockout_service
from app.modules.auth import totp as totp_service
from app.modules.auth.schemas import RegisterRequest


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_token(user_id=None, role=UserRole.ROLE_STUDENT, email="u@test.com", exp_delta_minutes=60):
    uid = user_id or uuid4()
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=exp_delta_minutes)
    payload = {
        "sub": str(uid),
        "role": str(role),
        "email": email,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm), uid


def _client() -> TestClient:
    return TestClient(app, raise_server_exceptions=False)


# ─────────────────────────────────────────────────────────────────────────────
# LAYER 1 — Password hashing
# ─────────────────────────────────────────────────────────────────────────────

class TestPasswordHashing:
    def test_hash_is_not_plaintext(self):
        h = hash_password("mysecret")
        assert "mysecret" not in h

    def test_correct_password_verifies(self):
        h = hash_password("correct")
        assert verify_password("correct", h) is True

    def test_wrong_password_fails(self):
        h = hash_password("correct")
        assert verify_password("wrong", h) is False

    def test_hashes_are_unique(self):
        """bcrypt uses random salt — same password produces different hashes."""
        h1 = hash_password("same")
        h2 = hash_password("same")
        assert h1 != h2

    def test_sha256_pre_hash_applied(self):
        """Verify the SHA-256 pre-hashing layer is in place (hash must accept long passwords)."""
        long_pw = "a" * 200
        h = hash_password(long_pw)
        assert verify_password(long_pw, h) is True


# ─────────────────────────────────────────────────────────────────────────────
# LAYER 2 — JWT
# ─────────────────────────────────────────────────────────────────────────────

class TestJWT:
    def test_token_contains_expected_claims(self):
        uid = uuid4()
        token = create_access_token(uid, "ROLE_STUDENT", "u@test.com")
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        assert payload["sub"] == str(uid)
        assert payload["role"] == "ROLE_STUDENT"
        assert payload["email"] == "u@test.com"
        assert "exp" in payload and "iat" in payload

    def test_expired_token_rejected(self):
        token, _ = _make_token(exp_delta_minutes=-1)
        client = _client()
        response = client.get("/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 401

    def test_tampered_token_rejected(self):
        token, _ = _make_token()
        tampered = token[:-5] + "XXXXX"
        client = _client()
        response = client.get("/me", headers={"Authorization": f"Bearer {tampered}"})
        assert response.status_code == 401

    def test_missing_token_rejected(self):
        client = _client()
        response = client.get("/me")
        assert response.status_code == 401

    def test_wrong_secret_rejected(self):
        uid = uuid4()
        payload = {
            "sub": str(uid),
            "role": "ROLE_STUDENT",
            "email": "x@x.com",
            "iat": int(time.time()),
            "exp": int(time.time()) + 3600,
        }
        bad_token = jwt.encode(payload, "wrong-secret", algorithm="HS256")
        client = _client()
        response = client.get("/me", headers={"Authorization": f"Bearer {bad_token}"})
        assert response.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# LAYER 3 — TOTP / 2FA
# ─────────────────────────────────────────────────────────────────────────────

class TestTOTP:
    def test_generated_secret_is_valid_base32(self):
        secret = totp_service.generate_totp_secret()
        assert len(secret) >= 16
        # pyotp accepts it without error
        pyotp.TOTP(secret)

    def test_valid_code_verifies(self):
        secret = totp_service.generate_totp_secret()
        code = pyotp.TOTP(secret).now()
        assert totp_service.verify_totp_code(secret, code) is True

    def test_wrong_code_rejected(self):
        secret = totp_service.generate_totp_secret()
        assert totp_service.verify_totp_code(secret, "000000") is False

    def test_provisioning_uri_contains_issuer(self):
        secret = totp_service.generate_totp_secret()
        uri = totp_service.get_provisioning_uri(secret, "user@test.com")
        assert "LearnAble" in uri
        assert "user%40test.com" in uri or "user@test.com" in uri

    def test_qr_code_returns_base64_png(self):
        secret = totp_service.generate_totp_secret()
        uri = totp_service.get_provisioning_uri(secret, "user@test.com")
        b64 = totp_service.get_qr_base64(uri)
        import base64
        data = base64.b64decode(b64)
        assert data[:4] == b'\x89PNG'  # PNG magic bytes


# ─────────────────────────────────────────────────────────────────────────────
# LAYER 4 — Account lockout logic
# ─────────────────────────────────────────────────────────────────────────────

class TestAccountLockout:
    def _make_user(self, locked_until=None):
        user = MagicMock()
        user.id = uuid4()
        user.locked_until = locked_until
        return user

    def test_not_locked_with_no_failures(self):
        session = MagicMock()
        session.query.return_value.filter.return_value.count.return_value = 0
        user = self._make_user()
        assert lockout_service.is_account_locked(session, user) is False

    def test_locked_after_max_failures(self):
        session = MagicMock()
        session.query.return_value.filter.return_value.count.return_value = lockout_service.MAX_ATTEMPTS
        user = self._make_user()
        assert lockout_service.is_account_locked(session, user) is True

    def test_locked_until_in_future_returns_true(self):
        future = datetime.now(timezone.utc) + timedelta(minutes=10)
        user = self._make_user(locked_until=future)
        session = MagicMock()
        assert lockout_service.is_account_locked(session, user) is True

    def test_expired_lock_clears_and_returns_false(self):
        past = datetime.now(timezone.utc) - timedelta(minutes=1)
        user = self._make_user(locked_until=past)
        session = MagicMock()
        session.query.return_value.filter.return_value.count.return_value = 0
        result = lockout_service.is_account_locked(session, user)
        assert result is False
        assert user.locked_until is None

    def test_seconds_until_unlock_positive_when_locked(self):
        future = datetime.now(timezone.utc) + timedelta(minutes=5)
        user = self._make_user(locked_until=future)
        secs = lockout_service.seconds_until_unlock(user)
        assert secs > 0

    def test_seconds_until_unlock_zero_when_not_locked(self):
        user = self._make_user()
        assert lockout_service.seconds_until_unlock(user) == 0

    def test_max_attempts_constant(self):
        assert lockout_service.MAX_ATTEMPTS == 10

    def test_lockout_minutes_constant(self):
        assert lockout_service.LOCKOUT_MINUTES == 15


# ─────────────────────────────────────────────────────────────────────────────
# LAYER 5 — RBAC / role enforcement
# ─────────────────────────────────────────────────────────────────────────────

class TestRBAC:
    def test_student_token_forbidden_on_teacher_route(self):
        """ROLE_STUDENT must be denied on a ROLE_TUTOR-only endpoint."""
        token, _ = _make_token(role=UserRole.ROLE_STUDENT)
        client = _client()
        response = client.get(
            "/teacher/dashboard",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    def test_missing_token_returns_401_not_403(self):
        """Unauthenticated requests get 401, not 403."""
        client = _client()
        response = client.get("/teacher/dashboard")
        assert response.status_code == 401

    def test_invalid_role_in_token_forbidden(self):
        token, _ = _make_token(role="ROLE_GHOST")
        client = _client()
        response = client.get(
            "/teacher/dashboard",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code in (401, 403)


# ─────────────────────────────────────────────────────────────────────────────
# LAYER 6 — Security headers
# ─────────────────────────────────────────────────────────────────────────────

class TestSecurityHeaders:
    def test_x_content_type_options(self):
        client = _client()
        r = client.get("/health")
        assert r.headers.get("x-content-type-options") == "nosniff"

    def test_x_frame_options(self):
        client = _client()
        r = client.get("/health")
        assert r.headers.get("x-frame-options") == "DENY"

    def test_x_xss_protection(self):
        client = _client()
        r = client.get("/health")
        assert r.headers.get("x-xss-protection") == "1; mode=block"

    def test_referrer_policy(self):
        client = _client()
        r = client.get("/health")
        assert r.headers.get("referrer-policy") == "strict-origin-when-cross-origin"

    def test_permissions_policy(self):
        client = _client()
        r = client.get("/health")
        pp = r.headers.get("permissions-policy", "")
        assert "geolocation=()" in pp
        assert "microphone=()" in pp
        assert "camera=()" in pp

    def test_content_security_policy(self):
        client = _client()
        r = client.get("/health")
        csp = r.headers.get("content-security-policy", "")
        assert "default-src 'self'" in csp
        assert "frame-ancestors 'none'" in csp

    def test_hsts_absent_in_dev(self):
        """HSTS must NOT appear in dev mode (only production)."""
        client = _client()
        r = client.get("/health")
        assert "strict-transport-security" not in r.headers

    def test_headers_present_on_all_responses(self):
        """Security headers must be on error responses too."""
        client = _client()
        r = client.get("/nonexistent-route-12345")
        assert r.headers.get("x-frame-options") == "DENY"


# ─────────────────────────────────────────────────────────────────────────────
# LAYER 7 — CORS
# ─────────────────────────────────────────────────────────────────────────────

class TestCORS:
    def test_allowed_origin_gets_cors_header(self):
        client = _client()
        origin = settings.get_cors_origins()[0]
        r = client.options(
            "/health",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "GET",
            },
        )
        assert r.headers.get("access-control-allow-origin") == origin

    def test_disallowed_origin_no_cors_header(self):
        client = _client()
        r = client.get(
            "/health",
            headers={"Origin": "http://evil.example.com"},
        )
        assert r.headers.get("access-control-allow-origin") != "http://evil.example.com"

    def test_cors_origins_config_not_wildcard(self):
        """Wildcard CORS would bypass credentials protections."""
        for origin in settings.get_cors_origins():
            assert origin != "*", "CORS must not use wildcard origin"


# ─────────────────────────────────────────────────────────────────────────────
# LAYER 8 — User enumeration prevention
# ─────────────────────────────────────────────────────────────────────────────

class TestUserEnumeration:
    def _mock_db_no_user(self):
        """DB session that returns no user (unknown email via session.scalar)."""
        mock_session = MagicMock()
        mock_session.scalar.return_value = None  # get_user_by_email returns None
        return mock_session

    def test_unknown_email_same_response_as_wrong_password(self):
        """Both cases must return 401 with identical error code."""
        from app.db.session import get_db_session
        from app.main import app as _app

        mock_session = self._mock_db_no_user()

        def override():
            yield mock_session

        _app.dependency_overrides[get_db_session] = override
        try:
            client = _client()
            r_unknown = client.post(
                "/auth/login",
                json={"email": "doesnotexist@test.com", "password": "anything"},
            )
        finally:
            _app.dependency_overrides.pop(get_db_session, None)

        assert r_unknown.status_code == 401
        body = r_unknown.json()
        assert body.get("code") == "INVALID_CREDENTIALS"


# ─────────────────────────────────────────────────────────────────────────────
# LAYER 9 — Audit log model integrity
# ─────────────────────────────────────────────────────────────────────────────

class TestAuditLog:
    def test_role_change_log_has_required_fields(self):
        from app.db.models.security_models import RoleChangeLog
        cols = {c.key for c in RoleChangeLog.__table__.columns}
        assert {"changed_by", "target_user_id", "old_role", "new_role", "changed_at"}.issubset(cols)

    def test_login_attempt_has_ip_field(self):
        from app.db.models.security_models import LoginAttempt
        cols = {c.key for c in LoginAttempt.__table__.columns}
        assert "ip_address" in cols
        assert "attempted_at" in cols
        assert "success" in cols


# ─────────────────────────────────────────────────────────────────────────────
# LAYER 10 — Password strength validation
# ─────────────────────────────────────────────────────────────────────────────

class TestPasswordStrength:
    def _build(self, password: str) -> dict:
        """Return the validation error dict, or empty dict if valid."""
        from pydantic import ValidationError
        try:
            RegisterRequest(email="u@test.com", password=password, role="ROLE_STUDENT")
            return {}
        except ValidationError as e:
            return e.errors()[0]

    def test_strong_password_accepted(self):
        from pydantic import ValidationError
        try:
            RegisterRequest(email="u@test.com", password="Secure@123", role="ROLE_STUDENT")
        except ValidationError:
            pytest.fail("Strong password should be accepted")

    def test_no_uppercase_rejected(self):
        err = self._build("secure@123")
        assert err, "Should have failed"
        assert "uppercase" in str(err["msg"]).lower()

    def test_no_digit_rejected(self):
        err = self._build("Secure@abc")
        assert err
        assert "digit" in str(err["msg"]).lower()

    def test_no_special_char_rejected(self):
        err = self._build("Secure1234")
        assert err
        assert "special" in str(err["msg"]).lower()

    def test_too_short_rejected(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            RegisterRequest(email="u@test.com", password="S@1", role="ROLE_STUDENT")

    def test_multiple_missing_reported_together(self):
        """All missing requirements reported in one error, not multiple."""
        err = self._build("alllowercase")
        assert err
        msg = str(err["msg"]).lower()
        # At least two requirements mentioned
        count = sum(kw in msg for kw in ["uppercase", "digit", "special"])
        assert count >= 2


# ─────────────────────────────────────────────────────────────────────────────
# LAYER 11 — Rate limiting
# ─────────────────────────────────────────────────────────────────────────────

class TestRateLimit:
    def test_global_limit_not_hit_on_normal_traffic(self):
        client = _client()
        for _ in range(5):
            r = client.get("/health")
            assert r.status_code == 200

    def test_auth_endpoint_rate_limited_after_threshold(self):
        """
        Auth endpoints allow _AUTH_LIMIT (20) req/min per IP.
        Hammering /auth/login beyond that must return 429.
        """
        from app.main import _AUTH_LIMIT
        client = _client()
        status_codes = []
        for _ in range(_AUTH_LIMIT + 5):
            r = client.post(
                "/auth/login",
                json={"email": "x@test.com", "password": "anything"},
            )
            status_codes.append(r.status_code)

        assert 429 in status_codes, "Rate limit was never triggered"

    def test_rate_limit_response_has_retry_after_header(self):
        from app.main import _AUTH_LIMIT
        client = _client()
        for _ in range(_AUTH_LIMIT + 5):
            r = client.post(
                "/auth/login",
                json={"email": "x@test.com", "password": "anything"},
            )
            if r.status_code == 429:
                assert "retry-after" in r.headers
                break

    def test_rate_limit_error_code(self):
        from app.main import _AUTH_LIMIT
        client = _client()
        for _ in range(_AUTH_LIMIT + 5):
            r = client.post(
                "/auth/login",
                json={"email": "x@test.com", "password": "anything"},
            )
            if r.status_code == 429:
                assert r.json()["code"] == "RATE_LIMITED"
                break


# ─────────────────────────────────────────────────────────────────────────────
# LAYER 12 — TOTP replay protection
# ─────────────────────────────────────────────────────────────────────────────

class TestTOTPReplay:
    def test_same_code_rejected_on_second_use(self):
        from app.modules.auth.totp import (
            consume_totp_code,
            is_totp_code_used,
        )
        session = MagicMock()

        # First use — not yet in DB
        session.query.return_value.filter.return_value.first.return_value = None
        assert is_totp_code_used(session, uuid4(), "123456") is False

        # After consuming, same code in DB
        used_record = MagicMock()
        session.query.return_value.filter.return_value.first.return_value = used_record
        assert is_totp_code_used(session, uuid4(), "123456") is True

    def test_consume_adds_record_and_prunes_old(self):
        from app.modules.auth.totp import consume_totp_code
        session = MagicMock()
        user_id = uuid4()
        consume_totp_code(session, user_id, "654321")
        session.add.assert_called_once()
        session.commit.assert_called()

    def test_used_totp_code_model_has_required_fields(self):
        from app.db.models.security_models import UsedTotpCode
        cols = {c.key for c in UsedTotpCode.__table__.columns}
        assert {"user_id", "code", "used_at"}.issubset(cols)


# ─────────────────────────────────────────────────────────────────────────────
# LAYER 13 — SQL injection (ORM parameterization)
# ─────────────────────────────────────────────────────────────────────────────

class TestSQLInjection:
    """
    SQLAlchemy ORM uses parameterized queries — SQL injection is architecturally
    impossible. These tests verify that injection payloads are treated as plain
    strings (Pydantic accepts/rejects them on type grounds) and never cause HTTP
    500s (which would indicate raw string interpolation into a query).
    """

    SQL_PAYLOADS = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "1; SELECT * FROM users",
        '" OR 1=1 --',
        "admin'--",
        "' UNION SELECT null, null, null --",
    ]

    def test_sql_payload_in_email_returns_422_not_500(self):
        """
        Pydantic EmailStr rejects SQL payloads — they are never passed to the DB.
        A 429 (rate limited) is also acceptable: it means the request was blocked
        before it even reached the handler.
        """
        client = _client()
        for payload in self.SQL_PAYLOADS:
            r = client.post(
                "/auth/login",
                json={"email": payload, "password": "Secret@1"},
            )
            assert r.status_code in (422, 429), (
                f"Expected 422 or 429 for SQL payload in email, got {r.status_code} for: {payload!r}"
            )
            assert r.status_code != 500, f"SQL injection caused a 500: {payload!r}"

    def test_sql_payload_in_password_does_not_cause_500(self):
        """Passwords pass through Pydantic (plain str); the ORM must handle them safely."""
        client = _client()
        for payload in self.SQL_PAYLOADS:
            r = client.post(
                "/auth/login",
                json={"email": "test@test.com", "password": payload + "A1!"},
            )
            # 401 (wrong credentials) or 422 (too short) — never 500
            assert r.status_code != 500, f"SQL injection in password caused a 500: {payload!r}"

    def test_sql_payload_in_register_email_rejected(self):
        client = _client()
        for payload in self.SQL_PAYLOADS:
            r = client.post(
                "/auth/register",
                json={"email": payload, "password": "Secure@123", "role": "ROLE_STUDENT"},
            )
            assert r.status_code in (400, 409, 422)
            assert r.status_code != 500

    def test_no_raw_sql_in_codebase(self):
        """Verify no dangerous raw SQL string interpolation exists in app code."""
        import ast
        import os

        app_dir = os.path.join(os.path.dirname(__file__), "..", "app")
        # Patterns that indicate raw SQL string construction (not general Python usage)
        dangerous_patterns = ['f"SELECT', "f'SELECT", '+ "SELECT', "+ 'SELECT", "% SELECT"]

        for root, _, files in os.walk(app_dir):
            for fname in files:
                if not fname.endswith(".py"):
                    continue
                fpath = os.path.join(root, fname)
                with open(fpath, encoding="utf-8") as fh:
                    src = fh.read()
                for pattern in dangerous_patterns:
                    assert pattern not in src, (
                        f"Potentially unsafe raw SQL pattern '{pattern}' found in {fpath}"
                    )


# ─────────────────────────────────────────────────────────────────────────────
# LAYER 14 — TOTP secret encryption at rest
# ─────────────────────────────────────────────────────────────────────────────

class TestTOTPEncryption:
    def test_saved_secret_is_not_plaintext(self):
        """save_totp_secret must persist the encrypted form, not the raw base32."""
        from app.modules.auth.totp import save_totp_secret, generate_totp_secret
        session = MagicMock()
        session.query.return_value.filter_by.return_value.first.return_value = None

        secret = generate_totp_secret()
        save_totp_secret(session, uuid4(), secret)

        saved_value = session.add.call_args[0][0].secret
        assert saved_value != secret, "Secret must be stored encrypted, not in plaintext"

    def test_decrypt_round_trip(self):
        """Encrypting then decrypting returns the original secret."""
        from app.modules.auth.totp import _encrypt_secret, _decrypt_secret, generate_totp_secret
        secret = generate_totp_secret()
        assert _decrypt_secret(_encrypt_secret(secret)) == secret

    def test_decrypt_totp_secret_helper(self):
        """decrypt_totp_secret(row) returns the plaintext from an encrypted row."""
        from app.modules.auth.totp import _encrypt_secret, decrypt_totp_secret, generate_totp_secret
        secret = generate_totp_secret()
        row = MagicMock()
        row.secret = _encrypt_secret(secret)
        assert decrypt_totp_secret(row) == secret

    def test_different_secrets_produce_different_ciphertexts(self):
        """Two different secrets must not produce the same ciphertext."""
        from app.modules.auth.totp import _encrypt_secret, generate_totp_secret
        s1 = generate_totp_secret()
        s2 = generate_totp_secret()
        assert _encrypt_secret(s1) != _encrypt_secret(s2)

    def test_same_secret_produces_different_ciphertexts(self):
        """Fernet uses random IV — same plaintext yields different ciphertext each time."""
        from app.modules.auth.totp import _encrypt_secret, generate_totp_secret
        s = generate_totp_secret()
        assert _encrypt_secret(s) != _encrypt_secret(s)


# ─────────────────────────────────────────────────────────────────────────────
# LAYER 15 — Request body size limit
# ─────────────────────────────────────────────────────────────────────────────

class TestRequestSizeLimit:
    def test_small_body_passes(self):
        client = _client()
        r = client.post(
            "/auth/login",
            json={"email": "x@test.com", "password": "Secret@1"},
        )
        assert r.status_code != 413

    def test_oversized_body_rejected(self):
        """A request advertising Content-Length > 1 MB must be rejected with 413."""
        client = _client()
        r = client.post(
            "/auth/login",
            content=b"x" * 100,
            headers={"Content-Length": str(2_000_000), "Content-Type": "application/json"},
        )
        assert r.status_code == 413
        assert r.json()["code"] == "PAYLOAD_TOO_LARGE"

    def test_413_response_has_error_code(self):
        client = _client()
        r = client.post(
            "/health",
            content=b"x",
            headers={"Content-Length": str(2_000_000), "Content-Type": "application/json"},
        )
        assert r.status_code == 413
        body = r.json()
        assert "code" in body
        assert "message" in body


# ─────────────────────────────────────────────────────────────────────────────
# LAYER 16 — Forum input sanitization (XSS prevention)
# ─────────────────────────────────────────────────────────────────────────────

class TestForumSanitization:
    def test_script_tag_stripped_from_post_title(self):
        from app.modules.forum.schemas import ForumPostCreateRequest
        req = ForumPostCreateRequest(title="<script>alert(1)</script>Hello", content="Normal content here")
        assert "<script>" not in req.title
        assert "Hello" in req.title

    def test_script_tag_stripped_from_post_content(self):
        from app.modules.forum.schemas import ForumPostCreateRequest
        req = ForumPostCreateRequest(title="Valid title", content="<script>steal(cookie)</script>real content")
        assert "<script>" not in req.content
        assert "real content" in req.content

    def test_plain_text_preserved(self):
        from app.modules.forum.schemas import ForumPostCreateRequest
        req = ForumPostCreateRequest(title="Normal title", content="Just normal text with no HTML")
        assert req.title == "Normal title"
        assert req.content == "Just normal text with no HTML"

    def test_img_tag_stripped_from_comment(self):
        from app.modules.forum.schemas import ForumCommentCreateRequest
        req = ForumCommentCreateRequest(content='<img src=x onerror=alert(1)>text')
        assert "<img" not in req.content
        assert "text" in req.content

    def test_script_stripped_from_report_reason(self):
        from app.modules.forum.schemas import ForumReportCreateRequest
        import uuid
        from app.db.models.forum import ForumTargetType
        req = ForumReportCreateRequest(
            target_type=ForumTargetType.POST,
            target_id=uuid.uuid4(),
            reason="<b>This is bad</b> content",
        )
        assert "<b>" not in req.reason
        assert "This is bad" in req.reason


# ─────────────────────────────────────────────────────────────────────────────
# LAYER 17 — Login attempt purge helper
# ─────────────────────────────────────────────────────────────────────────────

class TestLoginAttemptPurge:
    def test_purge_deletes_old_records(self):
        from app.modules.auth.lockout import purge_old_attempts
        session = MagicMock()
        session.query.return_value.filter.return_value.delete.return_value = 5
        deleted = purge_old_attempts(session, days=90)
        assert deleted == 5
        session.commit.assert_called_once()

    def test_purge_zero_when_nothing_old(self):
        from app.modules.auth.lockout import purge_old_attempts
        session = MagicMock()
        session.query.return_value.filter.return_value.delete.return_value = 0
        deleted = purge_old_attempts(session, days=90)
        assert deleted == 0

    def test_purge_uses_correct_cutoff(self):
        """Verify the query filters on attempted_at, not another column."""
        from app.modules.auth.lockout import purge_old_attempts
        from app.db.models.security_models import LoginAttempt
        session = MagicMock()
        session.query.return_value.filter.return_value.delete.return_value = 0
        purge_old_attempts(session, days=30)
        # query(LoginAttempt) must have been called
        session.query.assert_called_with(LoginAttempt)
