import { BookOpen, Brain, Compass, GraduationCap, MessageSquare, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";

import { READING_LAB_ENABLED } from "../app/features";
import { PublicHeader } from "../app/components/PublicHeader";
import { cx, pageShellClass, sectionFrameClass, surfaceClass } from "../app/components/uiStyles";
import { getInitialLocale } from "../app/locale";
import { getSession } from "../state/auth";

type JwtPayload = {
  email?: string;
};

type QuickAction = {
  titleKey: string;
  descriptionKey: string;
  href: string;
  Icon: LucideIcon;
};

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    const json = atob(padded);

    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

function roleMeta(role: string, prefix: string): { icon: string; labelKey: string; actions: QuickAction[] } {
  switch (role) {
    case "ROLE_STUDENT":
      return {
        icon: "🎓",
        labelKey: "header.accountMenu.roles.student",
        actions: [
          {
            titleKey: "authenticatedHome.actions.student.dashboard.title",
            descriptionKey: "authenticatedHome.actions.student.dashboard.description",
            href: `${prefix}/student/dashboard`,
            Icon: GraduationCap,
          },
          {
            titleKey: "authenticatedHome.actions.student.onboarding.title",
            descriptionKey: "authenticatedHome.actions.student.onboarding.description",
            href: `${prefix}/student/onboarding`,
            Icon: Compass,
          },
          ...(READING_LAB_ENABLED
            ? [{
                titleKey: "authenticatedHome.actions.student.readingLab.title",
                descriptionKey: "authenticatedHome.actions.student.readingLab.description",
                href: `${prefix}/student/reading-lab`,
                Icon: BookOpen,
              }]
            : []),
        ],
      };
    case "ROLE_TUTOR":
      return {
        icon: "📘",
        labelKey: "header.accountMenu.roles.tutor",
        actions: [
          {
            titleKey: "authenticatedHome.actions.tutor.dashboard.title",
            descriptionKey: "authenticatedHome.actions.tutor.dashboard.description",
            href: `${prefix}/teacher/dashboard`,
            Icon: BookOpen,
          },
          {
            titleKey: "authenticatedHome.actions.tutor.forum.title",
            descriptionKey: "authenticatedHome.actions.tutor.forum.description",
            href: `${prefix}/forum`,
            Icon: MessageSquare,
          },
        ],
      };
    case "ROLE_PARENT":
      return {
        icon: "👨‍👩‍👧",
        labelKey: "header.accountMenu.roles.parent",
        actions: [
          {
            titleKey: "authenticatedHome.actions.parent.dashboard.title",
            descriptionKey: "authenticatedHome.actions.parent.dashboard.description",
            href: `${prefix}/parent/dashboard`,
            Icon: Users,
          },
            {
              titleKey: "authenticatedHome.actions.parent.forum.title",
              descriptionKey: "authenticatedHome.actions.parent.forum.description",
              href: `${prefix}/forum`,
              Icon: MessageSquare,
            },
          {
            titleKey: "authenticatedHome.actions.parent.library.title",
            descriptionKey: "authenticatedHome.actions.parent.library.description",
            href: `${prefix}/library`,
            Icon: BookOpen,
          },
        ],
      };
    case "ROLE_PSYCHOLOGIST":
      return {
        icon: "🧠",
        labelKey: "header.accountMenu.roles.psychologist",
        actions: [
          {
            titleKey: "authenticatedHome.actions.psychologist.dashboard.title",
            descriptionKey: "authenticatedHome.actions.psychologist.dashboard.description",
            href: `${prefix}/psychologist/dashboard`,
            Icon: Brain,
          },
            {
              titleKey: "authenticatedHome.actions.psychologist.forum.title",
              descriptionKey: "authenticatedHome.actions.psychologist.forum.description",
              href: `${prefix}/forum`,
              Icon: MessageSquare,
            },
          {
            titleKey: "authenticatedHome.actions.psychologist.checkpoint.title",
            descriptionKey: "authenticatedHome.actions.psychologist.checkpoint.description",
            href: `${prefix}/checkpoint`,
            Icon: Compass,
          },
        ],
      };
    case "ROLE_ADMIN":
      return {
        icon: "🛡️",
        labelKey: "header.accountMenu.roles.admin",
        actions: [
          {
            titleKey: "authenticatedHome.actions.admin.dashboard.title",
            descriptionKey: "authenticatedHome.actions.admin.dashboard.description",
            href: `${prefix}/admin/dashboard`,
            Icon: ShieldCheck,
          },
          {
            titleKey: "authenticatedHome.actions.admin.forum.title",
            descriptionKey: "authenticatedHome.actions.admin.forum.description",
            href: `${prefix}/forum`,
            Icon: MessageSquare,
          },
        ],
      };
    default:
      return {
        icon: "👤",
        labelKey: "authenticatedHome.roles.member",
        actions: [
          {
            titleKey: "authenticatedHome.actions.member.login.title",
            descriptionKey: "authenticatedHome.actions.member.login.description",
            href: `${prefix}/login`,
            Icon: Compass,
          },
        ],
      };
  }
}

export function AuthenticatedHomePage() {
  const { t } = useTranslation();
  const location = useLocation();
  const prefix = getInitialLocale(location.pathname) === "en" ? "/en" : "/ar";
  const session = getSession();
  const email = session?.accessToken
    ? decodeJwtPayload(session.accessToken)?.email ?? t("common.signedInUser")
    : t("common.signedInUser");
  const meta = roleMeta(session?.role ?? "", prefix);

  return (
    <main className={pageShellClass}>
      <PublicHeader className="bg-background" />

      <section className={cx(sectionFrameClass, "py-10 sm:py-14")}>
        <div className={cx(surfaceClass, "overflow-hidden px-6 py-8 sm:px-8 sm:py-10")}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl text-start">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-muted-foreground">
                <span aria-hidden="true">{meta.icon}</span>
                {t("authenticatedHome.badge", { role: t(meta.labelKey) })}
              </span>
              <h1 className="mt-4 text-balance text-[clamp(2rem,4vw,3rem)] font-semibold tracking-[-0.04em] text-foreground">
                {t("authenticatedHome.welcomeTitle")}
              </h1>
              <p className="mt-3 text-base leading-7 text-muted-foreground">
                {t("authenticatedHome.welcomeDescription", { email })}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className={cx(sectionFrameClass, "pb-16 sm:pb-20")}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {meta.actions.map(({ titleKey, descriptionKey, href, Icon }) => (
            <Link
              key={titleKey}
              to={href}
              className={cx(
                surfaceClass,
                "group flex h-full flex-col items-start rounded-[1.5rem] px-6 py-6 text-start transition duration-200 hover:-translate-y-1 hover:shadow-[0_18px_32px_rgba(33,40,55,0.12)]",
              )}
            >
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-[1rem] border border-border bg-background text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-xl font-semibold tracking-[-0.02em] text-foreground">{t(titleKey)}</h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{t(descriptionKey)}</p>
              <span className="mt-5 text-sm font-semibold text-primary">{t("common.open")}</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
