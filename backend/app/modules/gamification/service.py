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
