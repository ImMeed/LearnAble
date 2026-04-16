import re
import unicodedata
from datetime import datetime, timedelta, timezone
from fastapi import status
from sqlalchemy.orm import Session

from app.core.i18n import localized_http_exception
from app.core.security import CurrentUser
from app.db.models.spelling import SpellingActivity, SpellingSession, SpellingSessionStatus
from app.modules.economy.service import apply_game_reward
from app.modules.gamification.service import apply_progression_after_xp, get_progression
from app.modules.spelling import repository
from app.modules.spelling.schemas import (
    CompleteSpellingSessionRequest,
    SpellingActivityItem,
    SpellingActivityListResponse,
    SpellingAnswerRequest,
    SpellingAnswerResponse,
    SpellingCompletionProgression,
    SpellingCompletionResponse,
    SpellingHintResponse,
    SpellingSessionResponse,
    StartSpellingSessionRequest,
)

_ARABIC_DIACRITICS_RE = re.compile(r"[\u064B-\u065F\u0670\u06D6-\u06ED]")

_SEEDED_ACTIVITIES = [
    {
        "key": "spell_apple",
        "title_ar": "تهجئة كلمة",
        "title_en": "Spell the Word",
        "difficulty": "EASY",
        "word_text_ar": "تفاحة",
        "word_text_en": "apple",
    },
    {
        "key": "spell_focus",
        "title_ar": "كلمة تركيز",
        "title_en": "Focus Word",
        "difficulty": "MEDIUM",
        "word_text_ar": "تركيز",
        "word_text_en": "focus",
    },
    {
        "key": "spell_learning",
        "title_ar": "كلمة تعلّم",
        "title_en": "Learning Word",
        "difficulty": "HARD",
        "word_text_ar": "تعليم",
        "word_text_en": "learning",
    },
    {
        "key": "spell_bridge",
        "title_ar": "كلمة جسر",
        "title_en": "Bridge Word",
        "difficulty": "MEDIUM",
        "word_text_ar": "جسر",
        "word_text_en": "bridge",
    },
]


def _normalize_word(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value or "")
    normalized = _ARABIC_DIACRITICS_RE.sub("", normalized)
    normalized = normalized.lower().strip()
    normalized = re.sub(r"\s+", "", normalized)
    return "".join(ch for ch in normalized if ch.isalnum() or ("\u0600" <= ch <= "\u06FF"))


def _hamming_distance(left: str, right: str) -> int:
    return sum(1 for lch, rch in zip(left, right) if lch != rch)


def _feedback(locale: str, accepted: bool, near_match: bool) -> str:
    if accepted and near_match:
        return "ممتاز! قريبة جدًا، أكمل هكذا." if locale == "ar" else "Great job! Very close spelling accepted."
    if accepted:
        return "رائع! تهجئة صحيحة." if locale == "ar" else "Excellent! Correct spelling."
    return "اقتربت! أعد الاستماع وحاول مرة أخرى." if locale == "ar" else "Almost! Listen again and try once more."


def _activity_title(activity: SpellingActivity, locale: str) -> str:
    return activity.title_en if locale == "en" else activity.title_ar


def _activity_word(activity: SpellingActivity, locale: str) -> str:
    if locale == "en":
        return activity.word_text_en or activity.word_text_ar or ""
    return activity.word_text_ar or activity.word_text_en or ""


def _session_response(record: SpellingSession) -> SpellingSessionResponse:
    return SpellingSessionResponse(
        session_id=record.id,
        activity_key=record.activity_key,
        activity_title=record.activity_title_en if record.locale == "en" else record.activity_title_ar,
        difficulty=record.difficulty,
        audio_text=record.target_word,
        word_length=len(record.target_word),
        hint_first_letter=record.target_word[:1] if record.hint_used and record.target_word else None,
        status=record.status.value,
        attempt_count=record.attempt_count,
        mistakes_count=record.mistakes_count,
        replay_count=record.replay_count,
        typed_playback_count=record.typed_playback_count,
        started_at=record.started_at,
        completed_at=record.completed_at,
    )


def _ensure_seed_data(session: Session) -> None:
    for item in _SEEDED_ACTIVITIES:
        existing = repository.get_activity_by_key(session, item["key"])
        if existing is not None:
            continue
        session.add(
            SpellingActivity(
                key=item["key"],
                title_ar=item["title_ar"],
                title_en=item["title_en"],
                difficulty=item["difficulty"],
                word_text_ar=item["word_text_ar"],
                word_text_en=item["word_text_en"],
                is_active=True,
            )
        )
    session.flush()


def list_activities(session: Session, locale: str) -> SpellingActivityListResponse:
    _ensure_seed_data(session)
    items = [
        SpellingActivityItem(
            key=activity.key,
            title=_activity_title(activity, locale),
            difficulty=activity.difficulty,
        )
        for activity in repository.list_active_activities(session, locale)
    ]
    return SpellingActivityListResponse(items=items)


def start_session(
    session: Session,
    payload: StartSpellingSessionRequest,
    current_user: CurrentUser,
    locale: str,
) -> SpellingSessionResponse:
    _ensure_seed_data(session)

    activity = None
    if payload.activity_key:
        activity = repository.get_activity_by_key(session, payload.activity_key)
    if activity is None:
        activity = repository.get_random_activity(session, locale)
    if activity is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "SPELLING_ACTIVITY_NOT_FOUND", locale)

    target_word = _activity_word(activity, locale)
    if not target_word:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "SPELLING_ACTIVITY_NOT_FOUND", locale)

    record = repository.create_session(
        session,
        SpellingSession(
            student_user_id=current_user.user_id,
            activity_id=activity.id,
            activity_key=activity.key,
            activity_title_ar=activity.title_ar,
            activity_title_en=activity.title_en,
            difficulty=activity.difficulty,
            locale=locale,
            target_word=target_word,
            normalized_target=_normalize_word(target_word),
        ),
    )
    session.commit()
    return _session_response(record)


def get_session(session: Session, session_id, current_user: CurrentUser, locale: str) -> SpellingSessionResponse:
    record = repository.get_session_for_student(session, session_id, current_user.user_id)
    if record is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "SPELLING_SESSION_NOT_FOUND", locale)
    return _session_response(record)


def get_hint(session: Session, session_id, current_user: CurrentUser, locale: str) -> SpellingHintResponse:
    record = repository.get_session_for_student(session, session_id, current_user.user_id, for_update=True)
    if record is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "SPELLING_SESSION_NOT_FOUND", locale)
    if record.status == SpellingSessionStatus.COMPLETED:
        raise localized_http_exception(status.HTTP_409_CONFLICT, "SPELLING_SESSION_COMPLETED", locale)

    record.hint_used = True
    session.add(record)
    session.commit()

    return SpellingHintResponse(
        session_id=record.id,
        first_letter=record.target_word[:1],
        hint_used=record.hint_used,
    )


def submit_answer(
    session: Session,
    session_id,
    payload: SpellingAnswerRequest,
    current_user: CurrentUser,
    locale: str,
) -> SpellingAnswerResponse:
    record = repository.get_session_for_student(session, session_id, current_user.user_id, for_update=True)
    if record is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "SPELLING_SESSION_NOT_FOUND", locale)
    if record.status == SpellingSessionStatus.COMPLETED:
        raise localized_http_exception(status.HTTP_409_CONFLICT, "SPELLING_SESSION_COMPLETED", locale)

    normalized_answer = _normalize_word(payload.answer)
    exact_match = normalized_answer == record.normalized_target and bool(normalized_answer)
    near_match = (
        not exact_match
        and bool(normalized_answer)
        and len(normalized_answer) == len(record.normalized_target)
        and _hamming_distance(normalized_answer, record.normalized_target) == 1
    )
    accepted = exact_match or near_match

    record.attempt_count = record.attempt_count + 1
    record.typed_answer = payload.answer
    record.normalized_answer = normalized_answer

    if accepted:
        record.solved = True
        if near_match:
            record.near_match_used = True
    else:
        record.mistakes_count = record.mistakes_count + 1

    session.add(record)
    session.commit()

    return SpellingAnswerResponse(
        session_id=record.id,
        accepted=accepted,
        is_exact_match=exact_match,
        is_near_match=near_match,
        solved=record.solved,
        attempt_count=record.attempt_count,
        mistakes_count=record.mistakes_count,
        feedback=_feedback(locale, accepted, near_match),
    )


def complete_session(
    session: Session,
    session_id,
    payload: CompleteSpellingSessionRequest,
    current_user: CurrentUser,
    locale: str,
) -> SpellingCompletionResponse:
    record = repository.get_session_for_student(session, session_id, current_user.user_id, for_update=True)
    if record is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "SPELLING_SESSION_NOT_FOUND", locale)

    if record.status == SpellingSessionStatus.COMPLETED:
        progression = get_progression(session, current_user.user_id, locale)
        return SpellingCompletionResponse(
            session_id=record.id,
            solved=record.solved,
            is_near_match=record.near_match_used,
            hint_used=record.hint_used,
            attempt_count=record.attempt_count,
            mistakes_count=record.mistakes_count,
            replay_count=record.replay_count,
            typed_playback_count=record.typed_playback_count,
            earned_points=record.reward_points,
            earned_xp=record.reward_xp,
            wallet_balance=0,
            progression=SpellingCompletionProgression(
                total_xp=progression["total_xp"],
                current_level=progression["current_level"],
                next_level_xp=progression["next_level_xp"],
                leveled_up=False,
                new_badges=[],
            ),
            completed_at=record.completed_at or datetime.now(timezone.utc),
        )

    record.replay_count = max(record.replay_count, payload.replay_count)
    record.typed_playback_count = max(record.typed_playback_count, payload.typed_playback_count)

    now = datetime.now(timezone.utc)
    if payload.duration_ms is not None:
        duration_ms = payload.duration_ms
    else:
        duration_ms = int((now - record.started_at).total_seconds() * 1000)
    record.duration_ms = max(0, duration_ms)

    had_yesterday = repository.has_completed_session_on_date(
        session,
        current_user.user_id,
        (now - timedelta(days=1)).date(),
    )
    has_today = repository.has_completed_session_on_date(session, current_user.user_id, now.date())

    attempt_xp = 2 if record.attempt_count > 0 else 0
    solved_xp = 10 if record.solved else 0
    solved_points = 8 if record.solved else 0
    exact_bonus_xp = 4 if record.solved and not record.near_match_used and not record.hint_used else 0
    exact_bonus_points = 2 if record.solved and not record.near_match_used and not record.hint_used else 0
    streak_bonus_xp = 3 if record.solved and had_yesterday and not has_today else 0
    streak_bonus_points = 1 if record.solved and had_yesterday and not has_today else 0

    earned_xp = attempt_xp + solved_xp + exact_bonus_xp + streak_bonus_xp
    earned_points = solved_points + exact_bonus_points + streak_bonus_points

    wallet_balance = apply_game_reward(
        session=session,
        user_id=current_user.user_id,
        points_delta=earned_points,
        xp_delta=earned_xp,
        reason="spelling_game_complete",
        metadata={
            "session_id": str(record.id),
            "activity_key": record.activity_key,
            "solved": record.solved,
            "near_match_used": record.near_match_used,
            "hint_used": record.hint_used,
            "mistakes_count": record.mistakes_count,
            "replay_count": record.replay_count,
            "typed_playback_count": record.typed_playback_count,
        },
    )

    progression = apply_progression_after_xp(
        session=session,
        user_id=current_user.user_id,
        xp_delta=earned_xp,
        locale=locale,
        metadata={
            "session_id": str(record.id),
            "activity_key": record.activity_key,
            "source": "spelling",
        },
    )

    record.reward_points = earned_points
    record.reward_xp = earned_xp
    record.status = SpellingSessionStatus.COMPLETED
    record.completed_at = now
    session.add(record)
    session.commit()

    return SpellingCompletionResponse(
        session_id=record.id,
        solved=record.solved,
        is_near_match=record.near_match_used,
        hint_used=record.hint_used,
        attempt_count=record.attempt_count,
        mistakes_count=record.mistakes_count,
        replay_count=record.replay_count,
        typed_playback_count=record.typed_playback_count,
        earned_points=earned_points,
        earned_xp=earned_xp,
        wallet_balance=wallet_balance,
        progression=SpellingCompletionProgression(
            total_xp=progression["total_xp"],
            current_level=progression["current_level"],
            next_level_xp=progression["next_level_xp"],
            leveled_up=progression["leveled_up"],
            new_badges=progression["new_badges"],
        ),
        completed_at=record.completed_at or now,
    )
