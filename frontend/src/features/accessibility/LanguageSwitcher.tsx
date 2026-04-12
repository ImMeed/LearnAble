import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

import { AppLocale, getInitialLocale, persistLocale, setDocumentLocale } from "../../app/locale";

function switchPath(pathname: string, nextLocale: AppLocale): string {
  if (pathname === "/") {
    return nextLocale === "en" ? "/en" : "/ar";
  }

  if (pathname === "/en" || pathname.startsWith("/en/")) {
    return pathname.replace(/^\/en(?=\/|$)/, nextLocale === "en" ? "/en" : "/ar");
  }

  if (pathname === "/ar" || pathname.startsWith("/ar/")) {
    return pathname.replace(/^\/ar(?=\/|$)/, nextLocale === "en" ? "/en" : "/ar");
  }

  return `${nextLocale === "en" ? "/en" : "/ar"}${pathname}`;
}

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const currentLocale = getInitialLocale(location.pathname);

  const onSwitch = async (nextLocale: AppLocale) => {
    if (nextLocale === currentLocale) return;

    persistLocale(nextLocale);
    setDocumentLocale(nextLocale);
    await i18n.changeLanguage(nextLocale);

    const nextPath = switchPath(location.pathname, nextLocale);
    navigate(nextPath + location.search + location.hash, { replace: true });
  };

  return (
    <div className="lang-switcher" aria-label={t("language.switcherLabel")}>
      <button
        type="button"
        className={currentLocale === "ar" ? "active" : ""}
        onClick={() => void onSwitch("ar")}
      >
        العربية
      </button>
      <button
        type="button"
        className={currentLocale === "en" ? "active" : ""}
        onClick={() => void onSwitch("en")}
      >
        English
      </button>
    </div>
  );
}
