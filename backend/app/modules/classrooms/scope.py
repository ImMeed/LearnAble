from uuid import UUID

from fastapi import status
from sqlalchemy.orm import Session

from app.core.i18n import localized_http_exception
from app.modules.classrooms import repository


def get_teacher_scoped_student_ids(session: Session, teacher_id: UUID) -> set[UUID]:
    return set(repository.list_active_teacher_student_ids(session, teacher_id))


def ensure_teacher_student_scope(session: Session, teacher_id: UUID, student_id: UUID, locale: str) -> None:
    if not repository.is_student_in_teacher_classrooms(session, teacher_id, student_id):
        raise localized_http_exception(status.HTTP_403_FORBIDDEN, "CLASSROOM_SCOPE_ACCESS_DENIED", locale)
