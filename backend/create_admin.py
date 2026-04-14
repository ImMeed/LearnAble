"""
Usage:
    python create_admin.py admin@learnable.local admin1234
"""
import sys
import uuid

sys.path.insert(0, ".")

from app.core.security import hash_password
from app.db.models.users import User
from app.db.session import SessionLocal
from app.core.roles import UserRole


def create_admin(email: str, password: str) -> None:
    session = SessionLocal()
    try:
        existing = session.query(User).filter_by(email=email).first()
        if existing:
            print(f"User {email} already exists (role={existing.role}).")
            return

        user = User(
            id=uuid.uuid4(),
            email=email,
            password_hash=hash_password(password),
            role=UserRole.ROLE_ADMIN,
        )
        session.add(user)
        session.commit()
        print(f"Admin created: {email}")
    finally:
        session.close()


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python create_admin.py <email> <password>")
        sys.exit(1)
    create_admin(sys.argv[1], sys.argv[2])
