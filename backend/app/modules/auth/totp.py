import base64
from io import BytesIO

import pyotp
import qrcode
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models.security_models import TotpSecret


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