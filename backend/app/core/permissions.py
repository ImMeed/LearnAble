from typing import Callable
from uuid import UUID

from fastapi import Depends, HTTPException, status

from app.core.roles import UserRole
from app.core.security import CurrentUser, get_current_user


def require_roles(*roles: UserRole) -> Callable:
    """
    FastAPI dependency that restricts an endpoint to specific roles.

    Usage:
        @router.get("/admin-only")
        def admin_endpoint(user = Depends(require_roles(UserRole.ADMIN))):
            ...

        @router.get("/teachers-and-admins")
        def endpoint(user = Depends(require_roles(UserRole.TEACHER, UserRole.ADMIN))):
            ...
    """
    async def _guard(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        try:
            user_role = UserRole(current_user.role)
        except ValueError:
            user_role = None

        if user_role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "FORBIDDEN",
                    "message": f"Access restricted. Required roles: {[r.value for r in roles]}",
                },
            )
        return current_user

    return _guard


def require_self_or_roles(user_id_param: UUID, *roles: UserRole) -> Callable:
    """
    Allow access if the requester IS the target user, OR has one of the given roles.
    Useful for profile endpoints: users can edit themselves, admins can edit anyone.
    """
    async def _guard(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if current_user.user_id == user_id_param:
            return current_user
        try:
            user_role = UserRole(current_user.role)
        except ValueError:
            user_role = None
        if user_role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "Insufficient permissions."},
            )
        return current_user

    return _guard