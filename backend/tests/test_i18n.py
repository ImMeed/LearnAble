from app.core.i18n import normalize_locale, translate


def test_normalize_locale_supports_headers_and_fallback() -> None:
    assert normalize_locale("en-US,en;q=0.9") == "en"
    assert normalize_locale("ar-EG") == "ar"
    assert normalize_locale("fr") == "ar"
    assert normalize_locale(None) == "ar"


def test_translate_returns_localized_messages() -> None:
    assert translate("INSUFFICIENT_POINTS", "ar") == "لا توجد نقاط كافية لاستخدام التلميح."
    assert translate("INSUFFICIENT_POINTS", "en") == "Not enough points to use a hint."
