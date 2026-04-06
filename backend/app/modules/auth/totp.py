import base64
from datetime import datetime, timedelta, timezone
from io import BytesIO

import pyotp
import qrcode
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models.security_models import TotpSecret, UsedTotpCode

# A TOTP code lives for at most 3 windows (valid_window=1 → ±1 window around now).
_REPLAY_WINDOW_SECONDS = 90


def generate_totp_secret() -> str:
    """Generate a new random base32 secret key for a user."""
    return pyotp.random_base32()


def get_provisioning_uri(secret: str, email: str) -> str:
    """Return the otpauth:// URI used to generate a QR code."""
    totp = pyotp.TOTP(secret)
    issuer = getattr(settings, "totp_issuer", "LearnAble")
    return totp.provisioning_uri(name=email, issuer_name=issuer)


def get_qr_base64(uri: str) -> str:
    """Render the provisioning URI as a base64-encoded PNG QR code."""
    img = qrcode.make(uri)
    buf = BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


def verify_totp_code(secret: str, code: str) -> bool:
    """
    Verify a 6-digit TOTP code against a secret.
    valid_window=1 allows one 30-second drift in either direction.
    """
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=1)


# ── Replay protection ─────────────────────────────────────────────────────────

def is_totp_code_used(session: Session, user_id, code: str) -> bool:
    """Return True if this code was already consumed within the replay window."""
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=_REPLAY_WINDOW_SECONDS)
    return (
        session.query(UsedTotpCode)
        .filter(
            UsedTotpCode.user_id == user_id,
            UsedTotpCode.code == code,
            UsedTotpCode.used_at >= cutoff,
        )
        .first()
        is not None
    )


def consume_totp_code(session: Session, user_id, code: str) -> None:
    """Record a code as used and prune codes older than the replay window."""
    session.add(UsedTotpCode(user_id=user_id, code=code))
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=_REPLAY_WINDOW_SECONDS)
    session.query(UsedTotpCode).filter(
        UsedTotpCode.user_id == user_id,
        UsedTotpCode.used_at < cutoff,
    ).delete(synchronize_session=False)
    session.commit()


# ── DB helpers ────────────────────────────────────────────────────────────────

def save_totp_secret(session: Session, user_id, secret: str) -> TotpSecret:
    """Persist (or replace) a user's TOTP secret."""
    existing = session.query(TotpSecret).filter_by(user_id=user_id).first()
    if existing:
        existing.secret = secret
        session.commit()
        return existing
    record = TotpSecret(user_id=user_id, secret=secret)
    session.add(record)
    session.commit()
    return record


def get_totp_secret(session: Session, user_id) -> TotpSecret | None:
    """Fetch the stored TOTP secret row for a user, or None."""
    return session.query(TotpSecret).filter_by(user_id=user_id).first()