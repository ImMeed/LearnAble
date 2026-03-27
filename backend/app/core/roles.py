from enum import StrEnum

from fastapi import Depends, HTTPException, status

from app.core.security import CurrentUser, get_current_user


class UserRole(StrEnum):
    ROLE_STUDENT = "ROLE_STUDENT"
    ROLE_TUTOR = "ROLE_TUTOR"
    ROLE_ADMIN = "ROLE_ADMIN"
    ROLE_PARENT = "ROLE_PARENT"
    ROLE_PSYCHOLOGIST = "ROLE_PSYCHOLOGIST"


def require_roles(*allowed_roles: UserRole):
    async def role_checker(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "You do not have access to this resource."},
            )
        return current_user

    return role_checker
