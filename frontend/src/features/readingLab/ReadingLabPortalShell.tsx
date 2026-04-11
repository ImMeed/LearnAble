import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { clearSession } from "../../state/auth";
import { AccessibilityToolbar } from "../../app/components/AccessibilityToolbar";
import { BrandLogo } from "../../app/components/BrandLogo";
import { getReadingLabPortalCopy } from "./portalCopy";

function localePrefix(resolvedLanguage: string | undefined): string {
  return resolvedLanguage === "en" ? "/en" : "/ar";
}

export function ReadingLabPortalShell({
  title,
  subtitle,
  variant,
  actions,
  children,
}: {
  title: string;
  subtitle: string;
  variant: "student" | "parent" | "psychologist";
  actions?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const { i18n, t } = useTranslation();
  const prefix = localePrefix(i18n.resolvedLanguage);
  const copy = getReadingLabPortalCopy(i18n.resolvedLanguage);
  const navItems =
    variant === "student"
      ? [
          { label: copy.student.title, to: `${prefix}/reading-lab/student/dashboard` },
          { label: copy.student.openGames, to: `${prefix}/reading-lab/student/lab` },
        ]
      : variant === "parent"
        ? [{ label: copy.parent.title, to: `${prefix}/reading-lab/parent/dashboard` }]
        : [{ label: copy.psychologist.title, to: `${prefix}/reading-lab/psychologist/dashboard` }];

  const onLogout = () => {
    clearSession();
    navigate(`${prefix}/reading-lab/login`);
  };

  return (
    <main className={`page dashboard-page reading-portal-page ${variant}-portal-page`}>
      <section className="card reading-portal-header">
        <div className="reading-portal-brand">
          <BrandLogo className="brand-icon" />
          <div>
            <p className="reading-portal-kicker">{copy.sectionTitle}</p>
            <h1>{title}</h1>
            <p className="muted">{subtitle}</p>
            <div className="reading-portal-nav">
              {navItems.map((item) => (
                <Link key={item.to} className="reading-portal-nav-link" to={item.to}>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
        <div className="dashboard-header-actions">
          {actions}
          <Link className="secondary-link" to={prefix}>
            {copy.classicLink}
          </Link>
          <button type="button" className="secondary" onClick={onLogout}>
            {t("dashboards.shell.logout")}
          </button>
          <AccessibilityToolbar />
        </div>
      </section>
      {children}
    </main>
  );
}
