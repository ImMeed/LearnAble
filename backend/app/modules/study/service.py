from uuid import UUID

from fastapi import status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.i18n import localized_http_exception
from app.core.roles import UserRole
from app.core.security import CurrentUser
from app.modules.classrooms import repository as classrooms_repository
from app.modules.study import repository
from app.modules.study.schemas import (
    AssistRequest,
    AssistResponse,
    AwarenessResponse,
    AwarenessTopic,
    CourseCompletionResponse,
    FlashcardItem,
    FlashcardListResponse,
    LessonDetailResponse,
    LessonListResponse,
    LessonSummary,
    ReadingGameItem,
    ReadingGameListResponse,
    ScreeningRequest,
    ScreeningResponse,
)


def fetch_study_status(session: Session) -> str:
    return repository.get_study_status(session)


def _lesson_title(lesson, locale: str) -> str:
    return lesson.title_en if locale == "en" else lesson.title_ar


def _lesson_body(lesson, locale: str) -> str:
    return lesson.body_en if locale == "en" else lesson.body_ar


def submit_screening(session: Session, payload: ScreeningRequest, current_user: CurrentUser, locale: str) -> ScreeningResponse:
    if repository.get_student_screening(session, current_user.user_id) is not None:
        raise localized_http_exception(status.HTTP_409_CONFLICT, "SCREENING_ALREADY_COMPLETED", locale)

    avg_score = (payload.focus_score + payload.reading_score + payload.memory_score) / 3
    if avg_score >= 75:
        support_level = "LOW"
    elif avg_score >= 45:
        support_level = "MEDIUM"
    else:
        support_level = "HIGH"

    indicators = {
        "focus": payload.focus_score,
        "reading": payload.reading_score,
        "memory": payload.memory_score,
        "notes": payload.notes or "",
        "policy": "educational_signals_only_no_diagnosis",
    }

    repository.create_student_screening(
        session,
        current_user.user_id,
        payload.focus_score,
        payload.reading_score,
        payload.memory_score,
        support_level,
        indicators,
    )
    session.commit()
    return ScreeningResponse(support_level=support_level, indicators=indicators)


def get_lessons(session: Session, locale: str) -> LessonListResponse:
    lessons = repository.list_lessons(session)
    items = [
        LessonSummary(id=lesson.id, title=_lesson_title(lesson, locale), difficulty=lesson.difficulty)
        for lesson in lessons
    ]
    return LessonListResponse(items=items)


def _get_scoped_lesson(
    session: Session,
    lesson_id: UUID,
    current_user: CurrentUser,
):
    if settings.classroom_system_enabled and current_user.role == UserRole.ROLE_STUDENT:
        return classrooms_repository.get_active_lesson_for_student_by_classroom_membership(
            session,
            student_id=current_user.user_id,
            lesson_id=lesson_id,
        )
    return repository.get_lesson(session, lesson_id)


def get_lessons_for_user(session: Session, locale: str, current_user: CurrentUser) -> LessonListResponse:
    if settings.classroom_system_enabled and current_user.role == UserRole.ROLE_STUDENT:
        lessons = classrooms_repository.list_active_lessons_for_student_by_classroom_membership(
            session,
            current_user.user_id,
        )
    else:
        lessons = repository.list_lessons(session)

    items = [
        LessonSummary(id=lesson.id, title=_lesson_title(lesson, locale), difficulty=lesson.difficulty)
        for lesson in lessons
    ]
    return LessonListResponse(items=items)


def get_lesson_detail(session: Session, lesson_id: UUID, locale: str, current_user: CurrentUser) -> LessonDetailResponse:
    lesson = _get_scoped_lesson(session, lesson_id, current_user)
    if lesson is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "LESSON_NOT_FOUND", locale)
    return LessonDetailResponse(
        id=lesson.id,
        title=_lesson_title(lesson, locale),
        body=_lesson_body(lesson, locale),
        difficulty=lesson.difficulty,
    )


def get_lesson_assist(
    session: Session,
    lesson_id: UUID,
    payload: AssistRequest,
    locale: str,
    current_user: CurrentUser,
) -> AssistResponse:
    lesson = _get_scoped_lesson(session, lesson_id, current_user)
    if lesson is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "LESSON_NOT_FOUND", locale)

    if payload.mode == "voice":
        content = (
            f"تشغيل قارئ صوتي مبسط لدرس: {_lesson_title(lesson, locale)}"
            if locale == "ar"
            else f"Playing a simplified voice reader for lesson: {_lesson_title(lesson, locale)}"
        )
    elif payload.mode == "summary":
        content = (
            "ملخص: ابدأ بالفكرة الرئيسية ثم راجع الأمثلة خطوة بخطوة."
            if locale == "ar"
            else "Summary: Start with the main idea, then review the examples step by step."
        )
    elif payload.mode == "explain":
        content = (
            "شرح مبسط: قسّم المعلومات إلى نقاط قصيرة واستخدم كلمات مألوفة."
            if locale == "ar"
            else "Simple explanation: break information into short points and use familiar words."
        )
    elif payload.mode == "qa":
        prompt = payload.question or ("سؤال حول الدرس" if locale == "ar" else "Question about the lesson")
        content = (
            f"إجابة خطوة بخطوة على: {prompt}" if locale == "ar" else f"Step-by-step answer for: {prompt}"
        )
    else:
        raise localized_http_exception(status.HTTP_400_BAD_REQUEST, "INVALID_ASSIST_MODE", locale)

    return AssistResponse(mode=payload.mode, content=content)


def get_lesson_flashcards(
    session: Session,
    lesson_id: UUID,
    locale: str,
    current_user: CurrentUser,
) -> FlashcardListResponse:
    lesson = _get_scoped_lesson(session, lesson_id, current_user)
    if lesson is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "LESSON_NOT_FOUND", locale)

    cards = repository.list_flashcards(session, lesson_id)
    items = [
        FlashcardItem(
            front=card.front_en if locale == "en" else card.front_ar,
            back=card.back_en if locale == "en" else card.back_ar,
        )
        for card in cards
    ]
    return FlashcardListResponse(items=items)


def get_lesson_reading_games(
    session: Session,
    lesson_id: UUID,
    locale: str,
    current_user: CurrentUser,
) -> ReadingGameListResponse:
    lesson = _get_scoped_lesson(session, lesson_id, current_user)
    if lesson is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "LESSON_NOT_FOUND", locale)

    games = repository.list_reading_games(session, lesson_id)
    items = [
        ReadingGameItem(
            id=game.id,
            name=game.name_en if locale == "en" else game.name_ar,
            objective=game.objective_en if locale == "en" else game.objective_ar,
            words=game.words_json,
        )
        for game in games
    ]
    return ReadingGameListResponse(items=items)


def mark_course_completed(
    session: Session,
    lesson_id: UUID,
    locale: str,
    current_user: CurrentUser,
) -> CourseCompletionResponse:
    lesson = _get_scoped_lesson(session, lesson_id, current_user)
    if lesson is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "LESSON_NOT_FOUND", locale)

    repository.mark_course_completed(
        session,
        student_user_id=current_user.user_id,
        lesson_id=lesson_id,
    )
    session.commit()
    return CourseCompletionResponse(lesson_id=lesson_id, completed=True)


def get_awareness(locale: str) -> AwarenessResponse:
    if locale == "en":
        items = [
            AwarenessTopic(
                key="dyslexia",
                title="Dyslexia Awareness",
                body="Dyslexia is a learning difference in reading and spelling. Support through structured practice and confidence-building.",
            ),
            AwarenessTopic(
                key="adhd",
                title="ADHD Awareness",
                body="ADHD can affect attention regulation. Short focused activities and predictable routines can help.",
            ),
            AwarenessTopic(
                key="depression",
                title="Emotional Wellbeing Awareness",
                body="Low mood can affect learning engagement. Encourage supportive conversations and seek qualified help when needed.",
            ),
        ]
    else:
        items = [
            AwarenessTopic(
                key="dyslexia",
                title="التوعية بعسر القراءة",
                body="عسر القراءة اختلاف تعليمي يؤثر على القراءة والتهجئة. يساعد التدريب المنظم وبناء الثقة على التقدم.",
            ),
            AwarenessTopic(
                key="adhd",
                title="التوعية باضطراب فرط الحركة وتشتت الانتباه",
                body="قد يؤثر الاضطراب على تنظيم الانتباه. الأنشطة القصيرة والروتين الواضح يساعدان على التركيز.",
            ),
            AwarenessTopic(
                key="depression",
                title="التوعية بالرفاه النفسي",
                body="انخفاض المزاج قد يؤثر على التعلّم. من المهم الحوار الداعم وطلب المساندة المختصة عند الحاجة.",
            ),
        ]
    return AwarenessResponse(items=items)
