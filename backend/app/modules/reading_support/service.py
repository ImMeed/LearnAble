from datetime import datetime, timezone
from uuid import UUID

from fastapi import status
from sqlalchemy.orm import Session

from app.core.i18n import localized_http_exception
from app.core.platform_tracks import PlatformTrack
from app.core.roles import UserRole
from app.core.security import CurrentUser, hash_password
from app.modules.auth import repository as auth_repository
from app.db.models.economy import PointsWallet
from app.modules.economy.service import apply_game_reward
from app.modules.gamification.service import apply_progression_after_xp, get_progression
from app.modules.notifications import repository as notifications_repository
from app.modules.reading_support import repository
from app.modules.reading_support.catalog import get_game, list_games
from app.modules.reading_support.generation import build_personalized_rounds
from app.modules.reading_support.schemas import (
    CompleteReadingLabSessionResponse,
    CreateReadingSupportStudentRequest,
    CreateReadingSupportStudentResponse,
    ReadingLabGameItem,
    ReadingLabGameListResponse,
    ReadingLabProgressionSnapshot,
    ReadingLabRoundPublic,
    ReadingSupportMeResponse,
    ReadingSupportProfileResponse,
    ReadingSupportProgressByGame,
    ReadingSupportRewardItem,
    ReadingSupportProgressResponse,
    ReadingSupportStudentListResponse,
    ReadingSupportStudentOverview,
    ReadingSupportTrendPoint,
    StartReadingLabSessionResponse,
    SubmitReadingLabAnswerResponse,
    UpdateReadingSupportRequest,
)


def _student_label(display_name: str | None, email: str | None, student_id: UUID) -> str:
    if display_name and display_name.strip():
        return display_name.strip()
    if not email:
        return str(student_id)
    return email.split("@", 1)[0]


def _normalize_focus_symbols(values: list[str], *, max_items: int = 12, max_length: int = 8) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for raw in values:
        token = str(raw).strip()
        if not token:
            continue
        if len(token) > max_length:
            token = token[:max_length]
        key = token.casefold()
        if key in seen:
            continue
        seen.add(key)
        normalized.append(token)
        if len(normalized) >= max_items:
            break
    return normalized


def _profile_response(record, student_label: str | None = None) -> ReadingSupportProfileResponse:
    return ReadingSupportProfileResponse(
        id=record.id,
        student_user_id=record.student_user_id,
        student_label=student_label,
        declared_by_user_id=record.declared_by_user_id,
        declared_by_role=record.declared_by_role,
        notes=record.notes,
        focus_letters=list(record.focus_letters_json or []),
        focus_words=list(record.focus_words_json or []),
        focus_numbers=list(record.focus_numbers_json or []),
        is_active=record.is_active,
        activated_at=record.activated_at,
        updated_at=record.updated_at,
    )


def _empty_progress(locale: str) -> ReadingSupportProgressResponse:
    return ReadingSupportProgressResponse(
        completed_sessions=0,
        average_accuracy=0,
        best_accuracy=0,
        total_points_earned=0,
        total_xp_earned=0,
        current_level=1,
        next_level_xp=100,
        average_session_seconds=0,
        total_play_time_seconds=0,
        unlocked_rewards=[],
        last_played_at=None,
        performance_trend=[],
        by_game=[
            ReadingSupportProgressByGame(
                game_key=item["key"],
                title=item["title"],
                play_count=0,
                average_accuracy=0,
                best_accuracy=0,
            )
            for item in list_games(locale)
        ],
    )


def _build_progress(session: Session, student_id: UUID, locale: str) -> ReadingSupportProgressResponse:
    sessions = repository.list_completed_sessions_for_student(session, student_id)
    progression = get_progression(session, student_id, locale)
    if not sessions:
        empty = _empty_progress(locale)
        empty.current_level = progression["current_level"]
        empty.next_level_xp = progression["next_level_xp"]
        empty.unlocked_rewards = [
            ReadingSupportRewardItem(
                code=item["code"],
                title=item["title"],
                unlocked_at=item["unlocked_at"],
            )
            for item in progression["badges"]
            if item["unlocked"]
        ]
        return empty

    by_game = {
        item["key"]: {
            "game_key": item["key"],
            "title": item["title"],
            "play_count": 0,
            "accuracy_total": 0,
            "best_accuracy": 0,
        }
        for item in list_games(locale)
    }

    total_correct = 0
    total_rounds = 0
    total_points = 0
    total_xp = 0
    total_play_time_seconds = 0
    best_accuracy = 0
    last_played_at = None
    trend_points: list[ReadingSupportTrendPoint] = []

    for record in sessions:
        accuracy = round((record.correct_rounds / record.total_rounds) * 100) if record.total_rounds else 0
        total_correct += record.correct_rounds
        total_rounds += record.total_rounds
        total_points += record.points_awarded
        total_xp += record.xp_awarded
        best_accuracy = max(best_accuracy, accuracy)
        if last_played_at is None or (record.completed_at and record.completed_at > last_played_at):
            last_played_at = record.completed_at

        duration_seconds = 0
        if record.completed_at is not None and record.started_at is not None:
            duration_seconds = max(0, int((record.completed_at - record.started_at).total_seconds()))
        total_play_time_seconds += duration_seconds

        slot = by_game.get(record.game_key)
        if slot is None:
            game = get_game(locale, record.game_key)
            slot = {
                "game_key": record.game_key,
                "title": game["title"] if game else record.game_key,
                "play_count": 0,
                "accuracy_total": 0,
                "best_accuracy": 0,
            }
            by_game[record.game_key] = slot
        trend_points.append(
            ReadingSupportTrendPoint(
                session_id=record.id,
                game_key=record.game_key,
                title=slot["title"],
                accuracy=accuracy,
                points_awarded=record.points_awarded,
                xp_awarded=record.xp_awarded,
                duration_seconds=duration_seconds,
                completed_at=record.completed_at or record.started_at,
            )
        )

        slot["play_count"] += 1
        slot["accuracy_total"] += accuracy
        slot["best_accuracy"] = max(slot["best_accuracy"], accuracy)

    overall_accuracy = round((total_correct / total_rounds) * 100) if total_rounds else 0
    average_session_seconds = round(total_play_time_seconds / len(sessions)) if sessions else 0
    by_game_items = []
    for item in by_game.values():
        play_count = item["play_count"]
        average_accuracy = round(item["accuracy_total"] / play_count) if play_count else 0
        by_game_items.append(
            ReadingSupportProgressByGame(
                game_key=item["game_key"],
                title=item["title"],
                play_count=play_count,
                average_accuracy=average_accuracy,
                best_accuracy=item["best_accuracy"],
            )
        )

    return ReadingSupportProgressResponse(
        completed_sessions=len(sessions),
        average_accuracy=overall_accuracy,
        best_accuracy=best_accuracy,
        total_points_earned=total_points,
        total_xp_earned=total_xp,
        current_level=progression["current_level"],
        next_level_xp=progression["next_level_xp"],
        average_session_seconds=average_session_seconds,
        total_play_time_seconds=total_play_time_seconds,
        unlocked_rewards=[
            ReadingSupportRewardItem(
                code=item["code"],
                title=item["title"],
                unlocked_at=item["unlocked_at"],
            )
            for item in progression["badges"]
            if item["unlocked"]
        ],
        last_played_at=last_played_at,
        performance_trend=trend_points[:6],
        by_game=by_game_items,
    )


def _assert_support_enabled(session: Session, student_id: UUID, locale: str):
    profile = repository.get_support_profile(session, student_id)
    if profile is None or not profile.is_active:
        raise localized_http_exception(status.HTTP_403_FORBIDDEN, "READING_SUPPORT_NOT_ENABLED", locale)
    return profile


def _assert_reading_lab_track(current_user: CurrentUser, locale: str) -> None:
    if current_user.platform_track != PlatformTrack.READING_LAB.value:
        raise localized_http_exception(status.HTTP_403_FORBIDDEN, "FORBIDDEN", locale)


def _assert_observer_can_manage_student(
    session: Session,
    student_id: UUID,
    current_user: CurrentUser,
    locale: str,
) -> None:
    _assert_reading_lab_track(current_user, locale)
    student = repository.get_student(session, student_id, current_user.platform_track)
    if student is None or str(student.role) != UserRole.ROLE_STUDENT.value:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "USER_NOT_FOUND", locale)

    if current_user.role == UserRole.ROLE_PARENT.value:
        if not repository.is_student_linked_to_parent(session, student_id, current_user.user_id):
            raise localized_http_exception(status.HTTP_403_FORBIDDEN, "STUDENT_PARENT_LINK_NOT_FOUND", locale)
        return

    if current_user.role == UserRole.ROLE_PSYCHOLOGIST.value:
        if not repository.is_student_linked_to_psychologist(session, student_id, current_user.user_id):
            raise localized_http_exception(status.HTTP_403_FORBIDDEN, "STUDENT_PSYCHOLOGIST_LINK_NOT_FOUND", locale)
        return

    raise localized_http_exception(status.HTTP_403_FORBIDDEN, "FORBIDDEN", locale)


def _ensure_parent_link_unlocks_student(
    session: Session,
    student_id: UUID,
    current_user: CurrentUser,
) -> None:
    if current_user.role != UserRole.ROLE_PARENT.value:
        return

    existing = repository.get_support_profile(session, student_id)
    if existing is not None and existing.is_active:
        return

    notes = existing.notes if existing is not None else ""
    focus_letters = list(existing.focus_letters_json or []) if existing is not None else []
    focus_words = list(existing.focus_words_json or []) if existing is not None else []
    focus_numbers = list(existing.focus_numbers_json or []) if existing is not None else []

    repository.upsert_support_profile(
        session=session,
        student_user_id=student_id,
        declared_by_user_id=current_user.user_id,
        declared_by_role=current_user.role,
        notes=notes,
        focus_letters=focus_letters,
        focus_words=focus_words,
        focus_numbers=focus_numbers,
        is_active=True,
    )

    notice = _support_notification_payload(True, current_user.role, student_id)
    notifications_repository.create_notification(
        session=session,
        user_id=student_id,
        type=notice["type"],
        title=notice["title_ar"],
        body=notice["body_ar"],
        metadata={
            **notice["metadata"],
            "title_en": notice["title_en"],
            "body_en": notice["body_en"],
            "auto_activated_from_parent_link": True,
        },
    )


def link_observer_to_student(
    session: Session,
    student_id: UUID,
    current_user: CurrentUser,
    locale: str,
) -> ReadingSupportProfileResponse | None:
    _assert_reading_lab_track(current_user, locale)
    student = repository.get_student(session, student_id, current_user.platform_track)
    if student is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "USER_NOT_FOUND", locale)
    if str(student.role) != UserRole.ROLE_STUDENT.value:
        raise localized_http_exception(status.HTTP_422_UNPROCESSABLE_ENTITY, "READING_SUPPORT_STUDENT_ROLE_REQUIRED", locale)

    if current_user.role == UserRole.ROLE_PARENT.value:
        repository.create_student_parent_link(session, student_id, current_user.user_id)
        _ensure_parent_link_unlocks_student(session, student_id, current_user)
    elif current_user.role == UserRole.ROLE_PSYCHOLOGIST.value:
        repository.create_student_psychologist_link(session, student_id, current_user.user_id)
    else:
        raise localized_http_exception(status.HTTP_403_FORBIDDEN, "FORBIDDEN", locale)

    session.commit()
    profile = repository.get_support_profile(session, student_id)
    return _profile_response(profile, _student_label(student.display_name, student.email, student.id)) if profile else None


def create_parent_managed_student(
    session: Session,
    payload: CreateReadingSupportStudentRequest,
    current_user: CurrentUser,
    locale: str,
) -> CreateReadingSupportStudentResponse:
    _assert_reading_lab_track(current_user, locale)
    if current_user.role != UserRole.ROLE_PARENT.value:
        raise localized_http_exception(status.HTTP_403_FORBIDDEN, "FORBIDDEN", locale)

    existing = repository.get_student_by_email(session, payload.email, current_user.platform_track)
    if existing is not None:
        raise localized_http_exception(status.HTTP_409_CONFLICT, "EMAIL_EXISTS", locale)

    student = auth_repository.create_user(
        session=session,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=UserRole.ROLE_STUDENT,
        platform_track=PlatformTrack(current_user.platform_track),
        display_name=payload.display_name,
    )
    session.add(PointsWallet(user_id=student.id, balance_points=0))
    repository.create_student_parent_link(session, student.id, current_user.user_id)
    _ensure_parent_link_unlocks_student(session, student.id, current_user)

    psychologist_id = auth_repository.get_first_psychologist_id(session, PlatformTrack(current_user.platform_track))
    if psychologist_id is not None:
        repository.create_student_psychologist_link(session, student.id, psychologist_id)

    session.commit()
    return CreateReadingSupportStudentResponse(
        student_user_id=student.id,
        student_label=_student_label(student.display_name, student.email, student.id),
        email=student.email,
        linked_parent_user_id=current_user.user_id,
    )


def _support_notification_payload(is_active: bool, actor_role: str, student_id: UUID) -> dict:
    if is_active:
        return {
            "type": "READING_SUPPORT_ACTIVATED",
            "title_ar": "تم تفعيل مختبر القراءة",
            "body_ar": "أصبح بإمكانك الآن استخدام ألعاب الحروف والكلمات ضمن مختبر القراءة.",
            "title_en": "Reading Lab unlocked",
            "body_en": "You can now use the Reading Lab games for letter and word practice.",
            "metadata": {
                "student_user_id": str(student_id),
                "declared_by_role": actor_role,
            },
        }

    return {
        "type": "READING_SUPPORT_UPDATED",
        "title_ar": "تم تحديث إعدادات مختبر القراءة",
        "body_ar": "تم إيقاف الوصول إلى مختبر القراءة حالياً. يمكنك التحدث مع ولي الأمر أو الأخصائي لمعرفة التفاصيل.",
        "title_en": "Reading Lab access updated",
        "body_en": "Reading Lab access is currently paused. Check with your parent or psychologist for details.",
        "metadata": {
            "student_user_id": str(student_id),
            "declared_by_role": actor_role,
        },
    }


def _public_round(index: int, payload: dict) -> ReadingLabRoundPublic:
    return ReadingLabRoundPublic(
        index=index,
        prompt=payload["prompt"],
        display_text=payload.get("display_text"),
        instruction=payload.get("instruction"),
        items=payload["items"],
        interaction=payload["interaction"],
        audio_text=payload.get("audio_text"),
    )


def get_my_reading_support(session: Session, current_user: CurrentUser, locale: str) -> ReadingSupportMeResponse:
    _assert_reading_lab_track(current_user, locale)
    profile = repository.get_support_profile(session, current_user.user_id)
    student = repository.get_student(session, current_user.user_id, current_user.platform_track)
    student_label = _student_label(
        student.display_name if student else None,
        current_user.email,
        current_user.user_id,
    )
    return ReadingSupportMeResponse(
        student_user_id=current_user.user_id,
        student_label=student_label,
        is_support_active=bool(profile and profile.is_active),
        support_profile=_profile_response(profile, student_label) if profile else None,
        progress=_build_progress(session, current_user.user_id, locale),
    )


def list_observer_students(
    session: Session,
    current_user: CurrentUser,
    locale: str,
) -> ReadingSupportStudentListResponse:
    _assert_reading_lab_track(current_user, locale)
    if current_user.role == UserRole.ROLE_PARENT.value:
        students = repository.list_students_for_parent(session, current_user.user_id, current_user.platform_track)
    elif current_user.role == UserRole.ROLE_PSYCHOLOGIST.value:
        students = repository.list_students_for_psychologist(session, current_user.user_id, current_user.platform_track)
    else:
        students = []

    items = []
    for student in students:
        label = _student_label(student.display_name, student.email, student.id)
        profile = repository.get_support_profile(session, student.id)
        items.append(
            ReadingSupportStudentOverview(
                student_user_id=student.id,
                student_label=label,
                support_profile=_profile_response(profile, label) if profile else None,
                progress=_build_progress(session, student.id, locale),
            )
        )
    return ReadingSupportStudentListResponse(items=items)


def update_student_reading_support(
    session: Session,
    student_id: UUID,
    payload: UpdateReadingSupportRequest,
    current_user: CurrentUser,
    locale: str,
) -> ReadingSupportProfileResponse:
    _assert_observer_can_manage_student(session, student_id, current_user, locale)
    student = repository.get_student(session, student_id, current_user.platform_track)
    assert student is not None
    focus_letters = _normalize_focus_symbols(payload.focus_letters)
    focus_words = _normalize_focus_symbols(payload.focus_words, max_items=12, max_length=32)
    focus_numbers = _normalize_focus_symbols(payload.focus_numbers)

    record = repository.upsert_support_profile(
        session=session,
        student_user_id=student_id,
        declared_by_user_id=current_user.user_id,
        declared_by_role=current_user.role,
        notes=payload.notes.strip(),
        focus_letters=focus_letters,
        focus_words=focus_words,
        focus_numbers=focus_numbers,
        is_active=payload.is_active,
    )

    notice = _support_notification_payload(payload.is_active, current_user.role, student_id)
    notifications_repository.create_notification(
        session=session,
        user_id=student_id,
        type=notice["type"],
        title=notice["title_ar"],
        body=notice["body_ar"],
        metadata={
            **notice["metadata"],
            "title_en": notice["title_en"],
            "body_en": notice["body_en"],
        },
    )

    session.commit()
    return _profile_response(record, _student_label(student.display_name, student.email, student.id))


def get_reading_lab_games(session: Session, current_user: CurrentUser, locale: str) -> ReadingLabGameListResponse:
    _assert_reading_lab_track(current_user, locale)
    _assert_support_enabled(session, current_user.user_id, locale)
    return ReadingLabGameListResponse(items=[ReadingLabGameItem(**item) for item in list_games(locale)])


def start_reading_lab_session(
    session: Session,
    game_key: str,
    current_user: CurrentUser,
    locale: str,
) -> StartReadingLabSessionResponse:
    _assert_reading_lab_track(current_user, locale)
    profile = _assert_support_enabled(session, current_user.user_id, locale)
    game = get_game(locale, game_key)
    if game is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "READING_LAB_GAME_INVALID", locale)

    focus_letters = _normalize_focus_symbols(list(profile.focus_letters_json or []))
    focus_words = _normalize_focus_symbols(list(profile.focus_words_json or []), max_items=12, max_length=32)
    focus_numbers = _normalize_focus_symbols(list(profile.focus_numbers_json or []))
    personalized = build_personalized_rounds(
        locale=locale,
        game_key=game_key,
        focus_letters=focus_letters,
        focus_words=focus_words,
        focus_numbers=focus_numbers,
        support_notes=profile.notes,
    )
    round_payload = personalized["rounds"]
    record = repository.create_reading_lab_session(
        session=session,
        student_user_id=current_user.user_id,
        game_key=game_key,
        content_source=personalized["content_source"],
        locale=locale,
        round_payload=round_payload,
    )
    session.commit()

    return StartReadingLabSessionResponse(
        session_id=record.id,
        game=ReadingLabGameItem(**{key: value for key, value in game.items() if key != "rounds"}),
        content_source=record.content_source,
        focus_letters=focus_letters,
        focus_words=focus_words,
        focus_numbers=focus_numbers,
        rounds=[_public_round(index, item) for index, item in enumerate(round_payload)],
    )


def submit_reading_lab_answer(
    session: Session,
    session_id: UUID,
    round_index: int,
    answer: str | list[str],
    current_user: CurrentUser,
    locale: str,
) -> SubmitReadingLabAnswerResponse:
    _assert_reading_lab_track(current_user, locale)
    record = repository.get_reading_lab_session_for_student(session, session_id, current_user.user_id)
    if record is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "READING_LAB_SESSION_NOT_FOUND", locale)
    if record.status == "COMPLETED":
        raise localized_http_exception(status.HTTP_409_CONFLICT, "READING_LAB_SESSION_COMPLETED", locale)
    if round_index < 0 or round_index >= record.total_rounds:
        raise localized_http_exception(status.HTTP_400_BAD_REQUEST, "READING_LAB_ROUND_INDEX_INVALID", locale)

    answers = list(record.answers_json or [])
    if any(item.get("round_index") == round_index for item in answers):
        raise localized_http_exception(status.HTTP_409_CONFLICT, "READING_LAB_ROUND_ALREADY_ANSWERED", locale)

    payload = record.round_payload_json[round_index]
    interaction = payload["interaction"]
    if interaction == "single_choice" and not isinstance(answer, str):
        raise localized_http_exception(status.HTTP_422_UNPROCESSABLE_ENTITY, "VALIDATION_ERROR", locale)
    if interaction == "ordered_tiles" and not isinstance(answer, list):
        raise localized_http_exception(status.HTTP_422_UNPROCESSABLE_ENTITY, "VALIDATION_ERROR", locale)

    normalized_answer = answer if isinstance(answer, str) else [str(item) for item in answer]
    correct_answer = payload["correct_answer"]
    is_correct = normalized_answer == correct_answer

    next_answers = [
        *answers,
        {
            "round_index": round_index,
            "answer": normalized_answer,
            "is_correct": is_correct,
            "answered_at": datetime.now(timezone.utc).isoformat(),
        },
    ]
    record.answers_json = next_answers
    record.correct_rounds = sum(1 for item in next_answers if item.get("is_correct"))
    session.add(record)
    session.commit()

    return SubmitReadingLabAnswerResponse(
        round_index=round_index,
        is_correct=is_correct,
        correct_answer=correct_answer,
        feedback=payload["feedback"],
        answered_rounds=len(next_answers),
        total_rounds=record.total_rounds,
    )


def complete_reading_lab_session(
    session: Session,
    session_id: UUID,
    current_user: CurrentUser,
    locale: str,
) -> CompleteReadingLabSessionResponse:
    _assert_reading_lab_track(current_user, locale)
    record = repository.get_reading_lab_session_for_student(session, session_id, current_user.user_id)
    if record is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "READING_LAB_SESSION_NOT_FOUND", locale)
    if record.status == "COMPLETED":
        raise localized_http_exception(status.HTTP_409_CONFLICT, "READING_LAB_SESSION_COMPLETED", locale)

    answers = list(record.answers_json or [])
    if len(answers) < record.total_rounds:
        raise localized_http_exception(status.HTTP_409_CONFLICT, "READING_LAB_SESSION_INCOMPLETE", locale)

    game = get_game(record.locale, record.game_key) or get_game(locale, record.game_key)
    if game is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "READING_LAB_GAME_INVALID", locale)

    accuracy = round((record.correct_rounds / record.total_rounds) * 100) if record.total_rounds else 0
    points_awarded = round((game["reward_points"] * accuracy) / 100)
    xp_awarded = round((game["reward_xp"] * accuracy) / 100)

    if accuracy > 0:
        apply_game_reward(
            session=session,
            user_id=current_user.user_id,
            points_delta=points_awarded,
            xp_delta=xp_awarded,
            reason="reading_lab_complete",
            metadata={"session_id": str(record.id), "game_key": record.game_key, "accuracy": accuracy},
        )
        progression_state = apply_progression_after_xp(
            session=session,
            user_id=current_user.user_id,
            xp_delta=xp_awarded,
            locale=locale,
            metadata={"session_id": str(record.id), "game_key": record.game_key, "accuracy": accuracy},
        )
    else:
        current_progression = get_progression(session, current_user.user_id, locale)
        progression_state = {
            "total_xp": current_progression["total_xp"],
            "current_level": current_progression["current_level"],
            "next_level_xp": current_progression["next_level_xp"],
            "leveled_up": False,
            "new_badges": [],
        }

    record.status = "COMPLETED"
    record.completed_at = datetime.now(timezone.utc)
    record.points_awarded = points_awarded
    record.xp_awarded = xp_awarded
    session.add(record)
    session.commit()

    return CompleteReadingLabSessionResponse(
        session_id=record.id,
        game_key=record.game_key,
        accuracy=accuracy,
        correct_rounds=record.correct_rounds,
        total_rounds=record.total_rounds,
        points_awarded=points_awarded,
        xp_awarded=xp_awarded,
        progression=ReadingLabProgressionSnapshot(
            total_xp=progression_state["total_xp"],
            current_level=progression_state["current_level"],
            next_level_xp=progression_state["next_level_xp"],
            leveled_up=progression_state["leveled_up"],
            new_badges=progression_state["new_badges"],
        ),
    )
