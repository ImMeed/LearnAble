import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

import { AppLocale, getInitialLocale, persistLocale, setDocumentLocale } from "../locale";
import { cx } from "./uiStyles";

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

export function CompactLanguageSwitcher() {
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
    <div
      className="flex shrink-0 items-center gap-1 rounded-full border border-border bg-card p-1 shadow-[var(--shadow-soft)]"
      aria-label={t("language.switcherLabel")}
    >
      <button
        type="button"
        className={cx(
          "inline-flex !min-h-[40px] items-center !rounded-full !border !px-[16px] !py-[8px] text-[14px] font-medium leading-none transition duration-200",
          currentLocale === "ar"
            ? "!border-primary !bg-primary !text-primary-foreground shadow-[0_10px_20px_rgba(74,144,226,0.22)]"
            : "!border-transparent !bg-transparent !text-muted-foreground hover:!bg-background hover:!text-foreground",
        )}
        onClick={() => void onSwitch("ar")}
        aria-pressed={currentLocale === "ar"}
      >
        {"\u0627\u0644\u0639\u0631\u0628\u064A\u0629"}
      </button>
      <button
        type="button"
        className={cx(
          "inline-flex !min-h-[40px] items-center !rounded-full !border !px-[16px] !py-[8px] text-[14px] font-medium leading-none transition duration-200",
          currentLocale === "en"
            ? "!border-primary !bg-primary !text-primary-foreground shadow-[0_10px_20px_rgba(74,144,226,0.22)]"
            : "!border-transparent !bg-transparent !text-muted-foreground hover:!bg-background hover:!text-foreground",
        )}
        onClick={() => void onSwitch("en")}
        aria-pressed={currentLocale === "en"}
      >
        English
      </button>
    </div>
  );
}
