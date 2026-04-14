from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.db.models.security_models import LoginAttempt
from app.db.models.users import User

MAX_ATTEMPTS = 10
LOCKOUT_MINUTES = 15


def _now() -> datetime:
    return datetime.now(timezone.utc)


def record_attempt(session: Session, user_id, success: bool, ip_address: str | None = None) -> None:
    """Log a login attempt (success or failure) for a user."""
    attempt = LoginAttempt(
        user_id=user_id,
        success=success,
        ip_address=ip_address,
    )
    session.add(attempt)
    session.commit()


def count_recent_failures(session: Session, user_id) -> int:
    """Count failed attempts in the last LOCKOUT_MINUTES window."""
    window_start = _now() - timedelta(minutes=LOCKOUT_MINUTES)
    return (
        session.query(LoginAttempt)
        .filter(
            LoginAttempt.user_id == user_id,
            LoginAttempt.success == False,  # noqa: E712
            LoginAttempt.attempted_at >= window_start,
        )
        .count()
    )


def is_account_locked(session: Session, user: User) -> bool:
    """
    Return True if the account is currently locked.
    Checks the DB-level locked_until column first (fast path),
    then falls back to counting recent failures.
    """
    now = _now()

    if user.locked_until is not None:
        locked_until_aware = user.locked_until
        if locked_until_aware.tzinfo is None:
            locked_until_aware = locked_until_aware.replace(tzinfo=timezone.utc)
        if locked_until_aware > now:
            return True
        # Lock expired — clear it
        user.locked_until = None
        session.commit()

    failures = count_recent_failures(session, user.id)
    if failures >= MAX_ATTEMPTS:
        # Stamp the lock expiry on the user row
        user.locked_until = now + timedelta(minutes=LOCKOUT_MINUTES)
        session.commit()
        return True

    return False


def seconds_until_unlock(user: User) -> int:
    """Return how many seconds remain until the lock expires (0 if not locked)."""
    if user.locked_until is None:
        return 0
    locked_until_aware = user.locked_until
    if locked_until_aware.tzinfo is None:
        locked_until_aware = locked_until_aware.replace(tzinfo=timezone.utc)
    remaining = (locked_until_aware - _now()).total_seconds()
    return max(0, int(remaining))


def clear_failed_attempts(session: Session, user: User) -> None:
    """Reset lockout state after a successful login."""
    user.locked_until = None
    session.query(LoginAttempt).filter(
        LoginAttempt.user_id == user.id,
        LoginAttempt.success == False,  # noqa: E712
    ).delete(synchronize_session=False)
    session.commit()


def purge_old_attempts(session: Session, days: int = 90) -> int:
    """Delete login_attempts older than `days` days. Returns the number of rows deleted."""
    cutoff = _now() - timedelta(days=days)
    deleted = (
        session.query(LoginAttempt)
        .filter(LoginAttempt.attempted_at < cutoff)
        .delete(synchronize_session=False)
    )
    session.commit()
    return deleted