import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMemo } from "react";

import { AccessibilityPanel } from "../../features/accessibility/AccessibilityPanel";
import { LanguageSwitcher } from "../../features/accessibility/LanguageSwitcher";

export function HomePage() {
  const { t, i18n } = useTranslation();
  const localePrefix = useMemo(() => (i18n.resolvedLanguage === "en" ? "/en" : "/ar"), [i18n.resolvedLanguage]);

  return (
    <main className="page">
      <section className="card">
        <LanguageSwitcher />
        <h1>{t("appTitle")}</h1>
        <p>{t("subtitle")}</p>
        <nav className="nav">
          <Link to={`${localePrefix}/forum`}>{t("nav.forum")}</Link>
          <Link to={`${localePrefix}/quizzes`}>{t("nav.quizzes")}</Link>
          <Link to={`${localePrefix}/games`}>{t("nav.games")}</Link>
          <Link to={`${localePrefix}/library`}>{t("nav.library")}</Link>
        </nav>
      </section>
      <AccessibilityPanel />
    </main>
  );
}
