import random
import string
from datetime import datetime, timezone
from uuid import UUID

from fastapi import status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.i18n import localized_http_exception
from app.core.roles import UserRole
from app.core.security import CurrentUser
from app.db.models.reading_lab import ReadingLabSessionStatus
from app.modules.economy.service import apply_game_reward
from app.modules.classrooms.scope import get_teacher_scoped_student_ids
from app.modules.gamification.service import apply_progression_after_xp
from app.modules.psychologist.service import sync_psychologist_support_confirmation
from app.modules.reading_lab import repository
from app.modules.reading_lab.schemas import (
    LinkedStudentItem,
    LinkedStudentListResponse,
    LinkStudentRequest,
    LinkStudentResponse,
    ReadingLabActivityItem,
    ReadingLabAnswerItem,
    ReadingLabAnswerRequest,
    ReadingLabAnswerResponse,
    ReadingLabCompletionResponse,
    ReadingLabNoteItem,
    ReadingLabProgressMetrics,
    ReadingLabRoundItem,
    ReadingLabSessionResponse,
    ReadingLabSummaryResponse,
    ReadingSupportPlanResponse,
    ReadingSupportPlanUpdateRequest,
    StartReadingLabSessionRequest,
    StudentLinkIdResponse,
)


EN_FALLBACK_TARGETS = ["b", "d", "cat", "sun", "2", "4"]
AR_FALLBACK_TARGETS = ["ب", "ت", "بيت", "شمس", "2", "4"]
EN_LETTER_POOL = list("abcdefghijklmnopqrstuvwxyz")
AR_LETTER_POOL = list("ابتثجحخدذرزسشصضطظعغفقكلمنهوي")
LINK_ID_PREFIX = "LB"
LINK_ID_LENGTH = 8
LINK_ID_ALPHABET = string.ascii_uppercase + string.digits


def _ensure_enabled(locale: str) -> None:
    if not settings.reading_lab_enabled:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "READING_LAB_DISABLED", locale)


def _student_label(email: str, student_id: UUID) -> str:
    return email.split("@", 1)[0] if email else str(student_id)


def _normalize_student_link_id(student_link_id: str) -> str:
    return student_link_id.strip().upper()


def _issue_student_link_id(session: Session, student_user_id: UUID, locale: str) -> str:
    user = repository.get_user(session, student_user_id)
    if user is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "USER_NOT_FOUND", locale)

    for _ in range(20):
        suffix = "".join(random.choice(LINK_ID_ALPHABET) for _ in range(LINK_ID_LENGTH))
        candidate = f"{LINK_ID_PREFIX}-{suffix}"
        existing = repository.get_user_by_student_link_id(session, candidate)
        if existing is None or existing.id == user.id:
            user.reading_lab_link_id = candidate
            session.add(user)
            session.flush()
            return candidate

    raise localized_http_exception(status.HTTP_500_INTERNAL_SERVER_ERROR, "READING_LAB_LINK_ID_GENERATION_FAILED", locale)


def _normalize_focus_targets(targets: list[str], locale: str) -> list[str]:
    cleaned: list[str] = []
    for item in targets:
        value = item.strip()
        if not value:
            continue
        if value not in cleaned:
            cleaned.append(value)
    if cleaned:
        return cleaned[:12]
    return (EN_FALLBACK_TARGETS if locale == "en" else AR_FALLBACK_TARGETS)[:6]


def _clean_focus_targets(targets: list[str]) -> list[str]:
    cleaned: list[str] = []
    for item in targets:
        value = item.strip()
        if value and value not in cleaned:
            cleaned.append(value)
    return cleaned[:12]


def _split_targets(targets: list[str], locale: str) -> tuple[list[str], list[str], list[str]]:
    letters = [item for item in targets if len(item) == 1 and not item.isdigit()]
    words = [item for item in targets if len(item) > 1 and not item.isdigit()]
    numbers = [item for item in targets if item.isdigit()]

    fallback = EN_FALLBACK_TARGETS if locale == "en" else AR_FALLBACK_TARGETS
    if not letters:
        letters = [item for item in fallback if len(item) == 1 and not item.isdigit()][:2]
    if not words:
        words = [item for item in fallback if len(item) > 1 and not item.isdigit()][:2]
    if not numbers:
        numbers = [item for item in fallback if item.isdigit()][:2]
    return letters, words, numbers


def _prominence(student_age_years: int | None, support_active: bool) -> str:
    in_primary_age_band = student_age_years is not None and 6 <= student_age_years <= 12
    if in_primary_age_band and support_active:
        return "HIGHLY_PROMINENT"
    if in_primary_age_band:
        return "PROMINENT"
    if support_active:
        return "FEATURED"
    return "OPTIONAL"


def _progress_metrics(session: Session, student_user_id: UUID) -> ReadingLabProgressMetrics:
    records = repository.list_completed_sessions_for_student(session, student_user_id)
    if not records:
        return ReadingLabProgressMetrics(
            completed_sessions=0,
            total_rounds_completed=0,
            average_accuracy=0,
            last_completed_at=None,
        )

    total_sessions = len(records)
    total_rounds = sum(record.total_rounds for record in records)
    accuracy_sum = 0
    for record in records:
        if record.total_rounds > 0:
            accuracy_sum += round((record.correct_answers / record.total_rounds) * 100)

    return ReadingLabProgressMetrics(
        completed_sessions=total_sessions,
        total_rounds_completed=total_rounds,
        average_accuracy=round(accuracy_sum / total_sessions),
        last_completed_at=records[0].completed_at,
    )


def _build_notes(session: Session, student_user_id: UUID, locale: str) -> list[ReadingLabNoteItem]:
    items: list[ReadingLabNoteItem] = []
    support_profile = repository.get_support_profile(session, student_user_id)
    if support_profile is not None and support_profile.notes.strip():
        label = "Parent or psychologist plan note" if locale == "en" else "ملاحظة من خطة ولي الأمر أو الأخصائي"
        if support_profile.updated_by_role == UserRole.ROLE_PARENT:
            label = "Parent note" if locale == "en" else "ملاحظة ولي الأمر"
        elif support_profile.updated_by_role == UserRole.ROLE_PSYCHOLOGIST:
            label = "Psychologist note" if locale == "en" else "ملاحظة الأخصائي"
        items.append(
            ReadingLabNoteItem(
                source=support_profile.updated_by_role or "READING_SUPPORT",
                label=label,
                note=support_profile.notes,
            )
        )

    questionnaire = repository.get_latest_teacher_questionnaire(session, student_user_id)
    if questionnaire is not None and questionnaire.notes.strip():
        items.append(
            ReadingLabNoteItem(
                source="ROLE_TUTOR",
                label="Teacher note" if locale == "en" else "ملاحظة المعلم",
                note=questionnaire.notes,
            )
        )

    confirmation = repository.get_psychologist_support_confirmation(session, student_user_id)
    if confirmation is not None and confirmation.notes.strip() and not any(
        item.note == confirmation.notes for item in items
    ):
        items.append(
            ReadingLabNoteItem(
                source="ROLE_PSYCHOLOGIST",
                label="Psychologist note" if locale == "en" else "ملاحظة الأخصائي",
                note=confirmation.notes,
            )
        )

    return items[:3]


def _support_state(session: Session, student_user_id: UUID) -> tuple[str, bool, list[str]]:
    support_profile = repository.get_support_profile(session, student_user_id)
    if support_profile is not None:
        return support_profile.status.value, support_profile.status.value == "ACTIVE", support_profile.focus_targets_json or []

    confirmation = repository.get_psychologist_support_confirmation(session, student_user_id)
    if confirmation is not None:
        return "ACTIVE", True, []

    return "INACTIVE", False, []


def _psychologist_support_level(session: Session, student_user_id: UUID) -> str:
    confirmation = repository.get_psychologist_support_confirmation(session, student_user_id)
    if confirmation is not None and confirmation.support_level.strip():
        return confirmation.support_level

    screening = repository.get_student_screening(session, student_user_id)
    if screening is not None and screening.support_level.strip():
        return screening.support_level

    return "MEDIUM"


def _psychologist_support_note(notes: str, locale: str) -> str:
    cleaned = notes.strip()
    if cleaned:
        return cleaned
    return "Reading Lab support is active." if locale == "en" else "دعم مختبر القراءة نشط."


def _build_activities(focus_targets: list[str], locale: str) -> list[ReadingLabActivityItem]:
    letters, words, numbers = _split_targets(focus_targets, locale)
    activities: list[ReadingLabActivityItem] = []

    if letters:
        activities.append(
            ReadingLabActivityItem(
                key="letter_choice",
                title="Letter Match" if locale == "en" else "مطابقة الحرف",
                description=(
                    "Pick the focus letter from short choices."
                    if locale == "en"
                    else "اختر الحرف المستهدف من بين خيارات قصيرة."
                ),
                interaction_type="SINGLE_CHOICE",
                estimated_minutes=4,
            )
        )
    if words:
        activities.append(
            ReadingLabActivityItem(
                key="word_builder",
                title="Word Builder" if locale == "en" else "تركيب الكلمة",
                description=(
                    "Put the tiles in the right order to build the focus word."
                    if locale == "en"
                    else "رتب البلاطات لبناء الكلمة المستهدفة."
                ),
                interaction_type="ORDERED_TILES",
                estimated_minutes=5,
            )
        )
    if numbers:
        activities.append(
            ReadingLabActivityItem(
                key="number_order",
                title="Number Order" if locale == "en" else "ترتيب الأرقام",
                description=(
                    "Order short number sequences from smallest to largest."
                    if locale == "en"
                    else "رتب سلاسل الأرقام القصيرة من الأصغر إلى الأكبر."
                ),
                interaction_type="ORDERED_TILES",
                estimated_minutes=3,
            )
        )
    return activities


def _build_student_summary(session: Session, student_user_id: UUID, locale: str) -> ReadingLabSummaryResponse:
    user = repository.get_user(session, student_user_id)
    if user is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "USER_NOT_FOUND", locale)

    support_status, support_active, focus_targets = _support_state(session, student_user_id)
    normalized_targets = _normalize_focus_targets(focus_targets, locale)
    return ReadingLabSummaryResponse(
        student_user_id=student_user_id,
        student_link_id=user.reading_lab_link_id,
        student_age_years=user.student_age_years,
        support_status=support_status,
        support_active=support_active,
        prominence=_prominence(user.student_age_years, support_active),
        focus_targets=normalized_targets,
        notes=_build_notes(session, student_user_id, locale),
        progress=_progress_metrics(session, student_user_id),
        activities=_build_activities(normalized_targets, locale),
    )


def _require_linked_student_access(session: Session, student_user_id: UUID, current_user: CurrentUser, locale: str) -> None:
    if current_user.role == UserRole.ROLE_PARENT:
        allowed = repository.is_parent_linked_to_student(session, current_user.user_id, student_user_id)
    elif current_user.role == UserRole.ROLE_PSYCHOLOGIST:
        allowed = repository.is_psychologist_linked_to_student(session, current_user.user_id, student_user_id)
    elif current_user.role == UserRole.ROLE_TUTOR:
        if settings.classroom_system_enabled:
            allowed = student_user_id in get_teacher_scoped_student_ids(session, current_user.user_id)
        else:
            allowed = student_user_id in repository.list_tutor_student_ids(session, current_user.user_id)
    else:
        allowed = False

    if not allowed:
        raise localized_http_exception(status.HTTP_403_FORBIDDEN, "READING_SUPPORT_ACCESS_DENIED", locale)


def _round_item(round_data: dict) -> ReadingLabRoundItem:
    options = round_data.get("options")
    return ReadingLabRoundItem(
        index=round_data["index"],
        prompt=round_data["prompt"],
        instructions=round_data["instructions"],
        interaction_type=round_data["interaction_type"],
        options=options,
        tiles=round_data.get("tiles"),
        reference_text=round_data.get("reference_text"),
        audio_text=round_data.get("audio_text"),
    )


def _answer_item(answer_data: dict) -> ReadingLabAnswerItem:
    return ReadingLabAnswerItem(
        round_index=answer_data["round_index"],
        is_correct=bool(answer_data["is_correct"]),
        selected_option_key=answer_data.get("selected_option_key"),
        ordered_tiles=answer_data.get("ordered_tiles"),
        submitted_at=datetime.fromisoformat(answer_data["submitted_at"]),
    )


def _session_response(record, locale: str) -> ReadingLabSessionResponse:
    return ReadingLabSessionResponse(
        session_id=record.id,
        activity_key=record.activity_key,
        activity_title=record.activity_title_en if locale == "en" else record.activity_title_ar,
        interaction_type=record.interaction_type,
        support_active_at_start=record.support_active_at_start,
        focus_targets=record.focus_targets_json or [],
        status=record.status.value,
        current_round_index=record.current_round_index,
        total_rounds=record.total_rounds,
        completed_all_rounds=len(record.answers_json or []) >= record.total_rounds,
        rounds=[_round_item(round_data) for round_data in record.rounds_json or []],
        answers=[_answer_item(answer_data) for answer_data in record.answers_json or []],
        started_at=record.started_at,
        completed_at=record.completed_at,
    )


def get_student_summary(session: Session, current_user: CurrentUser, locale: str) -> ReadingLabSummaryResponse:
    _ensure_enabled(locale)
    return _build_student_summary(session, current_user.user_id, locale)


def get_student_link_id(session: Session, current_user: CurrentUser, locale: str) -> StudentLinkIdResponse:
    _ensure_enabled(locale)
    user = repository.get_user(session, current_user.user_id)
    if user is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "USER_NOT_FOUND", locale)

    if user.reading_lab_link_id is None:
        link_id = _issue_student_link_id(session, current_user.user_id, locale)
        session.commit()
    else:
        link_id = user.reading_lab_link_id

    return StudentLinkIdResponse(student_user_id=current_user.user_id, student_link_id=link_id)


def regenerate_student_link_id(session: Session, current_user: CurrentUser, locale: str) -> StudentLinkIdResponse:
    _ensure_enabled(locale)
    link_id = _issue_student_link_id(session, current_user.user_id, locale)
    session.commit()
    return StudentLinkIdResponse(student_user_id=current_user.user_id, student_link_id=link_id)


def list_linked_students(session: Session, current_user: CurrentUser, locale: str) -> LinkedStudentListResponse:
    _ensure_enabled(locale)

    if current_user.role == UserRole.ROLE_PARENT:
        student_ids = repository.list_parent_linked_student_ids(session, current_user.user_id)
    elif current_user.role == UserRole.ROLE_PSYCHOLOGIST:
        student_ids = repository.list_psychologist_linked_student_ids(session, current_user.user_id)
    else:
        student_ids = []

    items: list[LinkedStudentItem] = []
    for student_id in student_ids:
        summary = _build_student_summary(session, student_id, locale)
        user = repository.get_user(session, student_id)
        if user is None:
            continue
        items.append(
            LinkedStudentItem(
                student_user_id=student_id,
                student_label=_student_label(user.email, student_id),
                student_age_years=user.student_age_years,
                support_status=summary.support_status,
                support_active=summary.support_active,
                prominence=summary.prominence,
                focus_targets=summary.focus_targets,
                progress=summary.progress,
            )
        )

    return LinkedStudentListResponse(items=items)


def list_tutor_students(session: Session, current_user: CurrentUser, locale: str) -> LinkedStudentListResponse:
    _ensure_enabled(locale)

    if settings.classroom_system_enabled:
        student_ids = list(get_teacher_scoped_student_ids(session, current_user.user_id))
    else:
        student_ids = repository.list_tutor_student_ids(session, current_user.user_id)
    items: list[LinkedStudentItem] = []
    for student_id in student_ids:
        summary = _build_student_summary(session, student_id, locale)
        user = repository.get_user(session, student_id)
        if user is None:
            continue
        items.append(
            LinkedStudentItem(
                student_user_id=student_id,
                student_label=_student_label(user.email, student_id),
                student_age_years=user.student_age_years,
                support_status=summary.support_status,
                support_active=summary.support_active,
                prominence=summary.prominence,
                focus_targets=summary.focus_targets,
                progress=summary.progress,
            )
        )

    return LinkedStudentListResponse(items=items)


def link_student(
    session: Session,
    payload: LinkStudentRequest,
    current_user: CurrentUser,
    locale: str,
) -> LinkStudentResponse:
    _ensure_enabled(locale)

    student = repository.get_user_by_student_link_id(session, _normalize_student_link_id(payload.student_link_id))
    if student is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "READING_LAB_LINK_ID_NOT_FOUND", locale)
    if student.role != UserRole.ROLE_STUDENT:
        raise localized_http_exception(status.HTTP_409_CONFLICT, "ROLE_MISMATCH", locale)

    try:
        if current_user.role == UserRole.ROLE_PARENT:
            repository.create_parent_student_link(session, current_user.user_id, student.id)
        elif current_user.role == UserRole.ROLE_PSYCHOLOGIST:
            repository.create_psychologist_student_link(session, current_user.user_id, student.id)
        else:
            raise localized_http_exception(status.HTTP_403_FORBIDDEN, "FORBIDDEN", locale)
        session.commit()
    except IntegrityError:
        session.rollback()

    return LinkStudentResponse(
        student_user_id=student.id,
        student_label=_student_label(student.email, student.id),
        linked_by_role=current_user.role,
    )


def get_support_plan(
    session: Session,
    student_user_id: UUID,
    current_user: CurrentUser,
    locale: str,
) -> ReadingSupportPlanResponse:
    _ensure_enabled(locale)
    _require_linked_student_access(session, student_user_id, current_user, locale)

    profile = repository.get_support_profile(session, student_user_id)
    if profile is None:
        return ReadingSupportPlanResponse(
            student_user_id=student_user_id,
            status="INACTIVE",
            notes="",
            focus_targets=[],
            updated_at=None,
            updated_by_role=None,
        )

    return ReadingSupportPlanResponse(
        student_user_id=student_user_id,
        status=profile.status.value,
        notes=profile.notes,
        focus_targets=profile.focus_targets_json or [],
        updated_at=profile.updated_at,
        updated_by_role=profile.updated_by_role,
    )


def update_support_plan(
    session: Session,
    student_user_id: UUID,
    payload: ReadingSupportPlanUpdateRequest,
    current_user: CurrentUser,
    locale: str,
) -> ReadingSupportPlanResponse:
    _ensure_enabled(locale)
    _require_linked_student_access(session, student_user_id, current_user, locale)

    normalized_targets = _clean_focus_targets(payload.focus_targets)
    profile = repository.upsert_support_profile(
        session=session,
        student_user_id=student_user_id,
        status=payload.status,
        notes=payload.notes.strip(),
        focus_targets=normalized_targets,
        updated_by_user_id=current_user.user_id,
        updated_by_role=current_user.role,
    )
    if current_user.role == UserRole.ROLE_PSYCHOLOGIST and payload.status == "ACTIVE":
        sync_psychologist_support_confirmation(
            session=session,
            student_id=student_user_id,
            support_level=_psychologist_support_level(session, student_user_id),
            notes=_psychologist_support_note(profile.notes, locale),
            current_user=current_user,
            locale=locale,
        )
    session.commit()

    return ReadingSupportPlanResponse(
        student_user_id=student_user_id,
        status=profile.status.value,
        notes=profile.notes,
        focus_targets=profile.focus_targets_json or [],
        updated_at=profile.updated_at,
        updated_by_role=profile.updated_by_role,
    )


def _letter_rounds(targets: list[str], locale: str) -> list[dict]:
    pool = EN_LETTER_POOL if locale == "en" else AR_LETTER_POOL
    rounds: list[dict] = []
    for index, letter in enumerate(targets[:4]):
        distractors = [item for item in pool if item != letter][:10]
        options = random.sample(distractors, k=min(3, len(distractors)))
        option_values = options + [letter]
        random.shuffle(option_values)
        rounds.append(
            {
                "index": index,
                "prompt": f"Find the focus letter: {letter}" if locale == "en" else f"اختر الحرف المستهدف: {letter}",
                "instructions": "Choose the matching letter." if locale == "en" else "اختر الحرف المطابق.",
                "interaction_type": "SINGLE_CHOICE",
                "options": [{"key": f"option_{i}", "text": value} for i, value in enumerate(option_values)],
                "correct_option": next(f"option_{i}" for i, value in enumerate(option_values) if value == letter),
                "reference_text": letter,
                "audio_text": letter,
            }
        )
    return rounds


def _word_rounds(targets: list[str], locale: str) -> list[dict]:
    rounds: list[dict] = []
    for index, word in enumerate(targets[:3]):
        tiles = list(word)
        shuffled = tiles[:]
        random.shuffle(shuffled)
        rounds.append(
            {
                "index": index,
                "prompt": f"Build the word: {word}" if locale == "en" else f"كوّن الكلمة: {word}",
                "instructions": (
                    "Put the tiles in the correct order." if locale == "en" else "رتب البلاطات بالترتيب الصحيح."
                ),
                "interaction_type": "ORDERED_TILES",
                "tiles": shuffled,
                "correct_tiles": tiles,
                "reference_text": word,
                "audio_text": word,
            }
        )
    return rounds


def _number_rounds(targets: list[str], locale: str) -> list[dict]:
    rounds: list[dict] = []
    base_numbers = [int(value) for value in targets[:3]] or [2, 4, 6]
    for index, value in enumerate(base_numbers):
        series = [value - 1, value, value + 1]
        display = [str(item) for item in series]
        shuffled = display[:]
        random.shuffle(shuffled)
        rounds.append(
            {
                "index": index,
                "prompt": (
                    "Order the numbers from smallest to largest."
                    if locale == "en"
                    else "رتب الأرقام من الأصغر إلى الأكبر."
                ),
                "instructions": (
                    "Arrange the tiles in order." if locale == "en" else "رتب البلاطات بالترتيب الصحيح."
                ),
                "interaction_type": "ORDERED_TILES",
                "tiles": shuffled,
                "correct_tiles": display,
                "reference_text": ", ".join(display),
                "audio_text": " ".join(display),
            }
        )
    return rounds


def _activity_blueprint(activity_key: str, focus_targets: list[str], locale: str) -> tuple[str, str, str, list[dict]]:
    letters, words, numbers = _split_targets(focus_targets, locale)
    if activity_key == "letter_choice":
        return "مطابقة الحرف", "Letter Match", "SINGLE_CHOICE", _letter_rounds(letters, locale)
    if activity_key == "word_builder":
        return "تركيب الكلمة", "Word Builder", "ORDERED_TILES", _word_rounds(words, locale)
    if activity_key == "number_order":
        return "ترتيب الأرقام", "Number Order", "ORDERED_TILES", _number_rounds(numbers, locale)
    raise localized_http_exception(status.HTTP_400_BAD_REQUEST, "READING_LAB_ACTIVITY_INVALID", locale)


def start_session(
    session: Session,
    payload: StartReadingLabSessionRequest,
    current_user: CurrentUser,
    locale: str,
) -> ReadingLabSessionResponse:
    _ensure_enabled(locale)
    summary = _build_student_summary(session, current_user.user_id, locale)
    title_ar, title_en, interaction_type, rounds = _activity_blueprint(payload.activity_key, summary.focus_targets, locale)
    record = repository.create_session(
        session=session,
        student_user_id=current_user.user_id,
        activity_key=payload.activity_key,
        activity_title_ar=title_ar,
        activity_title_en=title_en,
        interaction_type=interaction_type,
        rounds=rounds,
        focus_targets=summary.focus_targets,
        support_active_at_start=summary.support_active,
    )
    session.commit()
    return _session_response(record, locale)


def get_session(
    session: Session,
    session_id: UUID,
    current_user: CurrentUser,
    locale: str,
) -> ReadingLabSessionResponse:
    _ensure_enabled(locale)
    record = repository.get_session_for_student(session, session_id, current_user.user_id)
    if record is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "READING_LAB_SESSION_NOT_FOUND", locale)
    return _session_response(record, locale)


def _feedback_text(is_correct: bool, locale: str) -> str:
    if is_correct:
        return "Correct. Keep going." if locale == "en" else "إجابة صحيحة. واصل التقدم."
    return "Almost there. Try the next round carefully." if locale == "en" else "اقتربت. جرّب الجولة التالية بهدوء."


def submit_answer(
    session: Session,
    session_id: UUID,
    payload: ReadingLabAnswerRequest,
    current_user: CurrentUser,
    locale: str,
) -> ReadingLabAnswerResponse:
    _ensure_enabled(locale)
    record = repository.get_session_for_student(session, session_id, current_user.user_id)
    if record is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "READING_LAB_SESSION_NOT_FOUND", locale)
    if record.status.value == "COMPLETED":
        raise localized_http_exception(status.HTTP_409_CONFLICT, "READING_LAB_SESSION_COMPLETED", locale)

    answers = list(record.answers_json or [])
    rounds = list(record.rounds_json or [])
    if payload.round_index >= len(rounds):
        raise localized_http_exception(status.HTTP_409_CONFLICT, "READING_LAB_SESSION_OUT_OF_SYNC", locale)

    if payload.round_index < len(answers):
        existing = answers[payload.round_index]
        return ReadingLabAnswerResponse(
            session_id=record.id,
            round_index=payload.round_index,
            is_correct=bool(existing["is_correct"]),
            feedback=_feedback_text(bool(existing["is_correct"]), locale),
            next_round_index=min(len(answers), len(rounds)),
            completed_all_rounds=len(answers) >= len(rounds),
            answer=_answer_item(existing),
        )

    if payload.round_index != len(answers):
        raise localized_http_exception(status.HTTP_409_CONFLICT, "READING_LAB_SESSION_OUT_OF_SYNC", locale)

    round_data = rounds[payload.round_index]
    if round_data["interaction_type"] == "SINGLE_CHOICE":
        is_correct = payload.selected_option_key == round_data["correct_option"]
    else:
        is_correct = list(payload.ordered_tiles or []) == list(round_data["correct_tiles"])

    answer_record = {
        "round_index": payload.round_index,
        "is_correct": is_correct,
        "selected_option_key": payload.selected_option_key,
        "ordered_tiles": payload.ordered_tiles,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }
    answers.append(answer_record)
    record.answers_json = answers
    record.correct_answers = sum(1 for item in answers if item["is_correct"])
    record.current_round_index = len(answers)
    session.add(record)
    session.commit()

    return ReadingLabAnswerResponse(
        session_id=record.id,
        round_index=payload.round_index,
        is_correct=is_correct,
        feedback=_feedback_text(is_correct, locale),
        next_round_index=min(len(answers), len(rounds)),
        completed_all_rounds=len(answers) >= len(rounds),
        answer=_answer_item(answer_record),
    )


def complete_session(
    session: Session,
    session_id: UUID,
    current_user: CurrentUser,
    locale: str,
) -> ReadingLabCompletionResponse:
    _ensure_enabled(locale)
    record = repository.get_session_for_student(
        session,
        session_id,
        current_user.user_id,
        for_update=True,
    )
    if record is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "READING_LAB_SESSION_NOT_FOUND", locale)
    if len(record.answers_json or []) < record.total_rounds:
        raise localized_http_exception(status.HTTP_409_CONFLICT, "READING_LAB_SESSION_OUT_OF_SYNC", locale)

    accuracy = round((record.correct_answers / record.total_rounds) * 100) if record.total_rounds else 0
    if record.status.value == "COMPLETED":
        return ReadingLabCompletionResponse(
            session_id=record.id,
            correct_answers=record.correct_answers,
            total_rounds=record.total_rounds,
            accuracy=accuracy,
            earned_points=record.reward_points,
            earned_xp=record.reward_xp,
            wallet_balance=0,
            completed_at=record.completed_at or datetime.now(timezone.utc),
        )

    earned_points = record.correct_answers * 4
    earned_xp = (record.correct_answers * 6) + (4 if accuracy == 100 else 0)

    wallet_balance = apply_game_reward(
        session=session,
        user_id=current_user.user_id,
        points_delta=earned_points,
        xp_delta=earned_xp,
        reason="reading_lab_complete",
        metadata={"session_id": str(record.id), "activity_key": record.activity_key, "accuracy": accuracy},
    )
    apply_progression_after_xp(
        session=session,
        user_id=current_user.user_id,
        xp_delta=earned_xp,
        locale=locale,
        metadata={"session_id": str(record.id), "activity_key": record.activity_key, "accuracy": accuracy},
    )

    record.reward_points = earned_points
    record.reward_xp = earned_xp
    record.status = ReadingLabSessionStatus.COMPLETED
    record.completed_at = datetime.now(timezone.utc)
    session.add(record)
    session.commit()

    return ReadingLabCompletionResponse(
        session_id=record.id,
        correct_answers=record.correct_answers,
        total_rounds=record.total_rounds,
        accuracy=accuracy,
        earned_points=earned_points,
        earned_xp=earned_xp,
        wallet_balance=wallet_balance,
        completed_at=record.completed_at,
    )
