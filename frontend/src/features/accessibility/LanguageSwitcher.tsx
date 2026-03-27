import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

import { AppLocale, getPathLocale, persistLocale, setDocumentLocale } from "../../app/locale";

function switchPath(pathname: string, nextLocale: AppLocale): string {
  const currentLocale = getPathLocale(pathname);

  if (currentLocale === nextLocale) {
    return pathname;
  }

  if (currentLocale === "en") {
    return pathname.replace(/^\/en(?=\/|$)/, nextLocale === "ar" ? "/ar" : "/en");
  }

  if (pathname === "/") {
    return nextLocale === "en" ? "/en" : "/ar";
  }

  return pathname.replace(/^\/ar(?=\/|$)/, nextLocale === "en" ? "/en" : "/ar");
}

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const currentLocale = getPathLocale(location.pathname);

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
