import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookOpen, CalendarDays, ClipboardList, LayoutDashboard, LogOut, MessageSquare, School, type LucideIcon } from "lucide-react";

import { AccessibilityToolbar } from "../components/AccessibilityToolbar";
import { BrandLogo } from "../components/BrandLogo";
import { cx, surfaceClass } from "../components/uiStyles";
import { clearSession } from "../../state/auth";

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

  const onLogout = () => {
    clearSession();
    navigate(`${localePrefix(i18n.resolvedLanguage)}/login`);
  };

  return (
    <main className="page dashboard-page portal-page mx-auto grid max-w-[1240px] gap-4 px-4 py-4 sm:px-6">
      <section
        className={cx(
          surfaceClass,
          "dashboard-header portal-header flex flex-col gap-5 px-5 py-5 backdrop-blur sm:px-6 lg:flex-row lg:items-center lg:justify-between",
        )}
      >
        <div className="portal-brand">
          <Link className="portal-brand-link" to={localePrefix(i18n.resolvedLanguage)} aria-label={t("dashboards.shell.backHome")}>
            <div className="flex items-start gap-4">
              <BrandLogo className="shrink-0 text-primary" size={40} />
              <div>
                <h1 className="text-[clamp(1.8rem,2.4vw,2.5rem)] font-semibold tracking-[-0.04em] text-foreground">
                  {t("appTitle")}
                </h1>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{subtitle}</p>
              </div>
            </div>
          </Link>
        </div>
        <div className="dashboard-header-actions">
          <div className="dashboard-header-toolbar-wrap">
            <AccessibilityToolbar />
          </div>
          <button
            type="button"
            className="dashboard-logout-icon"
            onClick={onLogout}
            aria-label={t("dashboards.shell.logout")}
            title={t("dashboards.shell.logout")}
          >
            <LogOut aria-hidden="true" size={18} />
          </button>
        </div>
      </section>

      <section className="portal-section-head flex items-center justify-between gap-3">
        <h2 className="text-[clamp(1.4rem,2vw,2rem)] font-semibold tracking-[-0.03em] text-foreground">{title}</h2>
      </section>

      {children}
    </main>
  );
}

export function TeacherTabs({ active, onChange }: { active: TeacherTab; onChange: (tab: TeacherTab) => void }) {
  const { t } = useTranslation();
  const tabs: Array<{ id: TeacherTab; Icon: LucideIcon }> = [
    { id: "overview", Icon: LayoutDashboard },
    { id: "attendance", Icon: ClipboardList },
    { id: "classrooms", Icon: School },
    { id: "courses", Icon: BookOpen },
    { id: "schedule", Icon: CalendarDays },
    { id: "messages", Icon: MessageSquare },
  ];

  return (
    <nav className="teacher-tabbar" aria-label={t("dashboards.teacher.tabsLabel")}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={cx("teacher-tab", active === tab.id && "is-active")}
          onClick={() => onChange(tab.id)}
        >
          <tab.Icon className="h-4 w-4" aria-hidden="true" />
          <span>{t(`dashboards.tabs.${tab.id}`)}</span>
        </button>
      ))}
    </nav>
  );
}
