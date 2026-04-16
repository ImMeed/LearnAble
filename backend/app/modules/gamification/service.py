from datetime import date, datetime

from sqlalchemy.orm import Session

from app.modules.gamification import repository
from app.modules.notifications import repository as notifications_repository


BADGE_RULES = [
    {
        "code": "QUIZ_EXPLORER",
        "threshold_xp": 50,
        "title_ar": "مستكشف الاختبارات",
        "title_en": "Quiz Explorer",
        "description_ar": "جمعت 50 نقطة خبرة من الاختبارات.",
        "description_en": "You earned 50 XP from quizzes.",
    },
    {
        "code": "FOCUSED_LEARNER",
        "threshold_xp": 100,
        "title_ar": "متعلم مركز",
        "title_en": "Focused Learner",
        "description_ar": "وصلت إلى 100 نقطة خبرة.",
        "description_en": "You reached 100 XP.",
    },
    {
        "code": "XP_CHAMPION",
        "threshold_xp": 250,
        "title_ar": "بطل الخبرة",
        "title_en": "XP Champion",
        "description_ar": "تجاوزت 250 نقطة خبرة.",
        "description_en": "You passed 250 XP.",
    },
]


def _level_from_xp(total_xp: int) -> int:
    return max(1, (total_xp // 100) + 1)


def _next_level_xp(current_level: int) -> int:
    return current_level * 100


def _mask_email(email: str) -> str:
    if "@" not in email:
        return email
    local, domain = email.split("@", 1)
    if len(local) <= 2:
        return f"{local[0]}***@{domain}" if local else f"***@{domain}"
    return f"{local[:2]}***@{domain}"


def get_games(session: Session) -> list[dict]:
    _ = repository.list_games(session)
    return [
        {
            "key": "word_match",
            "title": "مطابقة الكلمات",
            "description": "لعبة سريعة لتقوية مفردات القراءة.",
        },
        {
            "key": "focus_sprint",
            "title": "تحدي التركيز",
            "description": "جلسة قصيرة بنمط بومودورو مع تتبع الإنجاز.",
        },
        {
            "key": "dyslexia_spelling",
            "title": "تهجئة سمعية",
            "description": "اسمع الكلمة واكتبها باستخدام لوحة مفاتيح داعمة لعسر القراءة.",
        },
    ]


def get_rankings(session: Session) -> list[dict]:
    rows = repository.get_leaderboard(session)
    items = []
    for row in rows:
        current_level = _level_from_xp(row["total_xp"])
        items.append(
            {
                "user_id": row["user_id"],
                "label": _mask_email(row["email"]),
                "total_xp": row["total_xp"],
                "current_level": current_level,
            }
        )
    return items


def get_progression(session: Session, user_id, locale: str) -> dict:
    total_xp = repository.get_total_xp_for_user(session, user_id)
    current_level = _level_from_xp(total_xp)
    next_level_xp = _next_level_xp(current_level)

    unlocked_records = repository.get_badge_unlock_notifications(session, user_id)
    unlocked_at_by_code = {}
    for record in unlocked_records:
        code = record["badge_code"]
        if code and code not in unlocked_at_by_code:
            unlocked_at_by_code[code] = record["created_at"]

    badges = []
    for rule in BADGE_RULES:
        unlocked = total_xp >= rule["threshold_xp"]
        badges.append(
            {
                "code": rule["code"],
                "title": rule["title_en"] if locale == "en" else rule["title_ar"],
                "description": rule["description_en"] if locale == "en" else rule["description_ar"],
                "threshold_xp": rule["threshold_xp"],
                "unlocked": unlocked,
                "unlocked_at": unlocked_at_by_code.get(rule["code"]),
            }
        )

    return {
        "total_xp": total_xp,
        "current_level": current_level,
        "next_level_xp": next_level_xp,
        "badges": badges,
    }


def _date_streak(activity_dates: set[date]) -> int:
    if not activity_dates:
        return 0

    streak = 1
    cursor = max(activity_dates)
    while True:
        previous_day = cursor.fromordinal(cursor.toordinal() - 1)
        if previous_day not in activity_dates:
            break
        streak += 1
        cursor = previous_day
    return streak


def _tracked_minutes_from_windows(windows: list[tuple[datetime, datetime]]) -> int:
    minutes = 0
    for started_at, completed_at in windows:
        delta_seconds = int((completed_at - started_at).total_seconds())
        if delta_seconds <= 0:
            continue
        minutes += delta_seconds // 60
    return minutes


def get_progress_summary(session: Session, user_id, locale: str) -> dict:
    progression = get_progression(session, user_id, locale)
    reading_stats = repository.get_completed_reading_lab_stats_for_user(session, user_id)
    quiz_count = repository.get_completed_quiz_count_for_user(session, user_id)

    reading_windows = repository.list_completed_reading_lab_windows_for_user(session, user_id)
    quiz_windows = repository.list_completed_quiz_windows_for_user(session, user_id)
    tracked_course_minutes = _tracked_minutes_from_windows(reading_windows + quiz_windows)

    activity_dates = {completed_at.date() for _, completed_at in reading_windows + quiz_windows}
    streak_days = _date_streak(activity_dates)

    estimated_course_minutes = repository.count_completed_courses_for_user(session, user_id) * 25

    return {
        "completed_sessions": reading_stats["completed_sessions"],
        "total_rounds_completed": reading_stats["total_rounds_completed"],
        "games_completed": reading_stats["completed_sessions"],
        "quizzes_completed": quiz_count,
        "total_xp": progression["total_xp"],
        "current_level": progression["current_level"],
        "next_level_xp": progression["next_level_xp"],
        "streak_days": streak_days,
        "tracked_course_minutes": tracked_course_minutes,
        "estimated_course_minutes": estimated_course_minutes,
        "total_course_minutes": tracked_course_minutes + estimated_course_minutes,
        "badges": progression["badges"],
    }


def apply_progression_after_xp(
    session: Session,
    user_id,
    xp_delta: int,
    locale: str,
    metadata: dict,
) -> dict:
    total_xp = repository.get_total_xp_for_user(session, user_id)
    previous_xp = max(0, total_xp - max(xp_delta, 0))

    previous_level = _level_from_xp(previous_xp)
    current_level = _level_from_xp(total_xp)
    next_level_xp = _next_level_xp(current_level)

    leveled_up = False
    if current_level > previous_level:
        for level in range(previous_level + 1, current_level + 1):
            if repository.has_level_up_notification(session, user_id, level):
                continue

            title_ar = f"تهانينا! وصلت للمستوى {level}"
            body_ar = "استمر في حل الاختبارات لكسب نقاط وخبرات أكثر."
            title_en = f"Great job! You reached Level {level}"
            body_en = "Keep practicing quizzes to gain more points and XP."

            notifications_repository.create_notification(
                session=session,
                user_id=user_id,
                type="LEVEL_UP",
                title=title_ar,
                body=body_ar,
                metadata={
                    **metadata,
                    "level": level,
                    "title_en": title_en,
                    "body_en": body_en,
                },
            )
            leveled_up = True

    new_badges = []
    for rule in BADGE_RULES:
        threshold = rule["threshold_xp"]
        if not (previous_xp < threshold <= total_xp):
            continue
        if repository.has_badge_unlock_notification(session, user_id, rule["code"]):
            continue

        notifications_repository.create_notification(
            session=session,
            user_id=user_id,
            type="BADGE_UNLOCKED",
            title=f"تم فتح شارة: {rule['title_ar']}",
            body=rule["description_ar"],
            metadata={
                **metadata,
                "badge_code": rule["code"],
                "threshold_xp": threshold,
                "title_en": f"Badge Unlocked: {rule['title_en']}",
                "body_en": rule["description_en"],
            },
        )
        new_badges.append(rule["code"])

    return {
        "total_xp": total_xp,
        "current_level": current_level,
        "next_level_xp": next_level_xp,
        "leveled_up": leveled_up,
        "new_badges": new_badges,
    }
