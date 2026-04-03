from fastapi import HTTPException
from starlette.requests import Request

SUPPORTED_LOCALES = {"ar", "en"}
DEFAULT_LOCALE = "ar"

MESSAGES = {
    "VALIDATION_ERROR": {
        "ar": "البيانات المدخلة غير صالحة.",
        "en": "The provided input is invalid.",
    },
    "EMAIL_EXISTS": {
        "ar": "البريد الإلكتروني مستخدم بالفعل.",
        "en": "Email is already registered.",
    },
    "INVALID_CREDENTIALS": {
        "ar": "بيانات تسجيل الدخول غير صحيحة.",
        "en": "Invalid email or password.",
    },
    "USER_NOT_FOUND": {
        "ar": "المستخدم غير موجود.",
        "en": "User does not exist.",
    },
    "FORBIDDEN": {
        "ar": "ليس لديك صلاحية الوصول إلى هذا المورد.",
        "en": "You do not have access to this resource.",
    },
    "UNAUTHORIZED": {
        "ar": "جلسة الدخول غير صالحة أو منتهية.",
        "en": "Invalid or expired token.",
    },
    "ROLE_MISMATCH": {
        "ar": "الدور غير مطابق لهذا المسار.",
        "en": "Role mismatch for this endpoint.",
    },
    "QUIZ_NOT_FOUND": {
        "ar": "الاختبار غير موجود.",
        "en": "Quiz was not found.",
    },
    "QUIZ_EMPTY": {
        "ar": "لا توجد أسئلة متاحة لهذا الاختبار حالياً.",
        "en": "This quiz has no questions yet.",
    },
    "ATTEMPT_NOT_FOUND": {
        "ar": "محاولة الاختبار غير موجودة.",
        "en": "Quiz attempt was not found.",
    },
    "ATTEMPT_ALREADY_COMPLETED": {
        "ar": "تم إرسال هذه المحاولة مسبقاً.",
        "en": "This attempt has already been submitted.",
    },
    "QUESTION_NOT_FOUND": {
        "ar": "السؤال غير موجود في هذا الاختبار.",
        "en": "Question was not found in this quiz.",
    },
    "INSUFFICIENT_POINTS": {
        "ar": "لا توجد نقاط كافية لاستخدام التلميح.",
        "en": "Not enough points to use a hint.",
    },
    "BOOK_NOT_FOUND": {
        "ar": "الكتاب غير موجود.",
        "en": "Book was not found.",
    },
    "BOOK_NOT_OWNED": {
        "ar": "لا تملك هذا الكتاب في مكتبتك.",
        "en": "You do not own this book in your library.",
    },
    "SCREENING_ALREADY_COMPLETED": {
        "ar": "تم إكمال تقييم البداية مسبقاً.",
        "en": "First-login screening has already been completed.",
    },
    "LESSON_NOT_FOUND": {
        "ar": "الدرس غير موجود.",
        "en": "Lesson was not found.",
    },
    "INVALID_ASSIST_MODE": {
        "ar": "وضع المساعدة غير مدعوم.",
        "en": "Assist mode is not supported.",
    },
    "ASSISTANCE_REQUEST_NOT_FOUND": {
        "ar": "طلب المساعدة غير موجود.",
        "en": "Assistance request was not found.",
    },
    "FEEDBACK_PROMPT_NOT_FOUND": {
        "ar": "طلب التغذية الراجعة غير موجود.",
        "en": "Feedback prompt was not found.",
    },
    "LESSON_OR_ATTEMPT_NOT_FOUND": {
        "ar": "مصدر النشاط غير موجود.",
        "en": "Lesson or assessment source was not found.",
    },
    "NOTIFICATION_NOT_FOUND": {
        "ar": "الإشعار غير موجود.",
        "en": "Notification was not found.",
    },
    "STUDENT_PSYCHOLOGIST_LINK_NOT_FOUND": {
        "ar": "لا توجد علاقة ربط مع هذا الطالب لهذا المختص.",
        "en": "No psychologist link found for this student.",
    },
    "FORUM_SPACE_NOT_FOUND": {
        "ar": "مساحة المنتدى غير موجودة.",
        "en": "Forum space was not found.",
    },
    "FORUM_POST_NOT_FOUND": {
        "ar": "منشور المنتدى غير موجود.",
        "en": "Forum post was not found.",
    },
    "FORUM_COMMENT_NOT_FOUND": {
        "ar": "تعليق المنتدى غير موجود.",
        "en": "Forum comment was not found.",
    },
    "FORUM_REPORT_NOT_FOUND": {
        "ar": "بلاغ المنتدى غير موجود.",
        "en": "Forum report was not found.",
    },
    "FORUM_TARGET_TYPE_INVALID": {
        "ar": "نوع هدف المنتدى غير صالح.",
        "en": "Forum target type is invalid.",
    },
    "FORUM_VOTE_VALUE_INVALID": {
        "ar": "قيمة التصويت غير صالحة.",
        "en": "Forum vote value is invalid.",
    },
    "FORUM_MODERATION_ACTION_INVALID": {
        "ar": "إجراء الإشراف غير صالح لهذا الهدف.",
        "en": "Moderation action is invalid for this target.",
    },
    "FORUM_POST_LOCKED": {
        "ar": "تم قفل هذا المنشور ولا يقبل تعليقات جديدة.",
        "en": "This post is locked and does not accept new comments.",
    },
}


def normalize_locale(value: str | None) -> str:
    if not value:
        return DEFAULT_LOCALE

    normalized = value.split(",")[0].split(";")[0].strip().lower().split("-")[0]
    return normalized if normalized in SUPPORTED_LOCALES else DEFAULT_LOCALE


def resolve_request_locale(request: Request) -> str:
    query_locale = request.query_params.get("lang")
    header_locale = request.headers.get("x-lang")
    accept_language = request.headers.get("accept-language")

    return normalize_locale(query_locale or header_locale or accept_language)


def get_request_locale(request: Request) -> str:
    state_locale = getattr(request.state, "locale", None)
    return normalize_locale(state_locale)


def translate(code: str, locale: str) -> str:
    localized = MESSAGES.get(code, {})
    return localized.get(locale, localized.get(DEFAULT_LOCALE, code))


def localized_http_exception(status_code: int, code: str, locale: str) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={
            "code": code,
            "message": translate(code, locale),
            "locale": locale,
        },
    )
