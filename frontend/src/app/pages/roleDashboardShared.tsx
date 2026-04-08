import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { AccessibilityToolbar } from "../components/AccessibilityToolbar";
import { clearSession, getSession } from "../../state/auth";

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
};

export type AssistanceRequestItem = {
  id: string;
  student_user_id: string;
  tutor_user_id: string | null;
  lesson_id: string | null;
  topic: string;
  message: string;
  preferred_at: string | null;
  status: string;
  scheduled_at: string | null;
  meeting_url: string | null;
};

export type TeacherPresenceItem = {
  tutor_user_id: string;
  updated_at: string;
};

export type ForumReport = {
  id: string;
  target_type: "POST" | "COMMENT";
  status: string;
  reason: string;
};

export type ForumSpace = {
  id: string;
  slug: string;
  name: string;
};

export type Profile = {
  id: string;
  email: string;
  role: string;
};

export type TeacherDashboardMetrics = {
  assigned_requests: number;
  pending_requests: number;
  scheduled_sessions: number;
  completed_sessions: number;
  active_tutors_online: number;
};

export type TeacherTab = "overview" | "attendance" | "classrooms" | "courses" | "schedule" | "messages";

export function errorMessage(error: unknown): string {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: unknown } }).response;
    const payload = response?.data;
    if (typeof payload === "object" && payload && "detail" in payload) {
      const detail = (payload as { detail?: unknown }).detail;
      if (typeof detail === "string") return detail;
      if (typeof detail === "object" && detail && "message" in detail) {
        return String((detail as { message?: unknown }).message);
      }
    }
    if (typeof payload === "object" && payload && "message" in payload) {
      return String((payload as { message?: unknown }).message);
    }
  }
  return String(error);
}

export function localeRequestConfig(resolvedLanguage: string | undefined) {
  return {
    headers: {
      "x-lang": resolvedLanguage === "en" ? "en" : "ar",
    },
  };
}

export function localePrefix(resolvedLanguage: string | undefined): string {
  return resolvedLanguage === "en" ? "/en" : "/ar";
}

export function formatDate(value: string | null, locale: "ar" | "en", emptyLabel = "-") {
  if (!value) {
    return emptyLabel;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString(locale === "en" ? "en-US" : "ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function DashboardShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const session = getSession();

  const onLogout = () => {
    clearSession();
    navigate(`${localePrefix(i18n.resolvedLanguage)}/login`);
  };

  return (
    <main className="page dashboard-page portal-page">
      <section className="card dashboard-header portal-header">
        <div className="portal-brand">
          <h1>{t("appTitle")}</h1>
          <p className="muted">{subtitle}</p>
          <p className="muted">{t("dashboards.shell.activeRole", { role: session?.role ?? t("dashboards.common.none") })}</p>
        </div>
        <div className="dashboard-header-actions">
          <Link className="secondary-link" to={localePrefix(i18n.resolvedLanguage)}>
            {t("dashboards.shell.backHome")}
          </Link>
          <button type="button" className="secondary" onClick={onLogout}>
            {t("dashboards.shell.logout")}
          </button>
          <AccessibilityToolbar />
        </div>
      </section>

      <section className="portal-section-head">
        <h2>{title}</h2>
      </section>

      {children}
    </main>
  );
}

export function TeacherTabs({ active, onChange }: { active: TeacherTab; onChange: (tab: TeacherTab) => void }) {
  const { t } = useTranslation();
  const tabs: TeacherTab[] = ["overview", "attendance", "classrooms", "courses", "schedule", "messages"];

  return (
    <nav className="portal-tabs" aria-label={t("dashboards.teacher.tabsLabel")}>
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          className={active === tab ? "active" : ""}
          onClick={() => onChange(tab)}
        >
          {t(`dashboards.tabs.${tab}`)}
        </button>
      ))}
    </nav>
  );
}