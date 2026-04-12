import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookOpen, Brain, GraduationCap, MessageSquare, Target, Users, type LucideIcon } from "lucide-react";

import { AccessibilityToolbar } from "../components/AccessibilityToolbar";
import { CompactLanguageSwitcher } from "../components/CompactLanguageSwitcher";
import { PublicHeader } from "../components/PublicHeader";
import { getInitialLocale } from "../locale";
import { actionClass, cx, pageShellClass, sectionFrameClass, sectionTitleClass, surfaceClass } from "../components/uiStyles";

const landingHeaderActionClass =
  "inline-flex shrink-0 whitespace-nowrap items-center justify-center rounded-[16px] border border-transparent px-[16px] py-[10px] text-[14px] font-semibold leading-none transition duration-200 ease-out";

export function LandingPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const prefix = getInitialLocale(location.pathname) === "en" ? "/en" : "/ar";

  const features: Array<{ title: string; description: string; Icon: LucideIcon; iconTone: string }> = [
    {
      title: t("landing.feature1Title"),
      description: t("landing.feature1Description"),
      Icon: Target,
      iconTone: "text-primary",
    },
    {
      title: t("landing.feature2Title"),
      description: t("landing.feature2Description"),
      Icon: Brain,
      iconTone: "text-secondary",
    },
    {
      title: t("landing.feature3Title"),
      description: t("landing.feature3Description"),
      Icon: MessageSquare,
      iconTone: "text-accent",
    },
  ];

  const flowItems = [
    {
      role: t("landing.flowStudentRole"),
      detail: t("landing.flowStudentDetail"),
      Icon: GraduationCap,
      iconTone: "text-primary",
    },
    {
      role: t("landing.flowTeacherRole"),
      detail: t("landing.flowTeacherDetail"),
      Icon: BookOpen,
      iconTone: "text-secondary",
    },
    {
      role: t("landing.flowPsychRole"),
      detail: t("landing.flowPsychDetail"),
      Icon: Brain,
      iconTone: "text-accent",
    },
    {
      role: t("landing.flowParentRole"),
      detail: t("landing.flowParentDetail"),
      Icon: Users,
      iconTone: "text-foreground",
    },
  ];

  return (
    <main className={pageShellClass}>
      <PublicHeader
        actions={
          <div className="flex flex-wrap items-center justify-end gap-3">
            <CompactLanguageSwitcher />
            <AccessibilityToolbar />
            <Link
              className={cx(
                landingHeaderActionClass,
                "text-muted-foreground hover:border-border hover:bg-background hover:text-foreground",
              )}
              to={`${prefix}/login`}
            >
              {t("common.signIn")}
            </Link>
            <Link
              className={cx(
                landingHeaderActionClass,
                "border-secondary bg-secondary text-secondary-foreground shadow-[0_12px_24px_rgba(111,207,151,0.24)]",
              )}
              to={`${prefix}/student/onboarding`}
            >
              {t("common.getStartedFree")}
            </Link>
          </div>
        }
      />

      <section className={cx(sectionFrameClass, "pt-12 pb-10 sm:pt-16 sm:pb-14")}>
        <div
          className={cx(
            surfaceClass,
            "relative overflow-hidden px-6 py-12 text-center motion-safe:animate-[rise-in_600ms_ease-out] sm:px-10 sm:py-16 lg:px-16 lg:py-20",
          )}
        >
          <div className="absolute -left-12 top-0 h-40 w-40 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
          <div className="absolute -right-12 bottom-0 h-44 w-44 rounded-full bg-secondary/15 blur-3xl" aria-hidden="true" />

          <div className="relative mx-auto max-w-3xl">
            <h1 className="text-balance text-[clamp(2.6rem,5vw,4.9rem)] font-semibold leading-[1.05] tracking-[-0.05em] text-foreground">
              {t("landing.heroTitle")}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-[clamp(1rem,1.8vw,1.35rem)] leading-8 text-muted-foreground">
              {t("landing.heroDescription")}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link className={actionClass()} to={`${prefix}/login`}>
                {t("common.signIn")}
              </Link>
              <Link className={actionClass("secondary")} to={`${prefix}/student/onboarding`}>
                {t("common.getStartedFree")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className={cx(sectionFrameClass, "py-8 sm:py-10")}>
        <h2 className={sectionTitleClass}>{t("landing.keyFeatures")}</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {features.map((item, index) => (
            <article
              className={cx(
                surfaceClass,
                "group h-full p-6 text-start transition duration-200 hover:-translate-y-1 hover:shadow-[0_18px_32px_rgba(33,40,55,0.12)] motion-safe:animate-[rise-in_600ms_ease-out_both]",
              )}
              key={item.title}
              style={{ animationDelay: `${index * 90}ms` }}
            >
              <span
                className={cx(
                  "mb-4 inline-flex h-12 w-12 items-center justify-center rounded-[1rem] border border-border bg-background",
                  item.iconTone,
                )}
                aria-hidden="true"
              >
                <item.Icon className="h-5 w-5" />
              </span>
              <h3 className="text-xl font-semibold tracking-[-0.02em] text-foreground">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={cx(sectionFrameClass, "py-8 sm:py-10")}>
        <h2 className={sectionTitleClass}>{t("landing.howItWorks")}</h2>
        <div className="mt-8 grid gap-4 lg:grid-cols-4">
          {flowItems.map((item, index) => (
            <article
              className="relative flex h-full flex-col items-center gap-3 rounded-[1.35rem] border border-border bg-background px-5 py-6 text-center shadow-[0_10px_24px_rgba(33,40,55,0.06)]"
              key={item.role}
            >
              <span className="absolute left-4 top-4 text-sm font-semibold text-muted-foreground">{`0${index + 1}`}</span>
              <span
                className={cx(
                  "inline-flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card",
                  item.iconTone,
                )}
                aria-hidden="true"
              >
                <item.Icon className="h-6 w-6" />
              </span>
              <strong className="text-lg font-semibold tracking-[-0.02em] text-foreground">{item.role}</strong>
              <span className="text-sm leading-7 text-muted-foreground">{item.detail}</span>
            </article>
          ))}
        </div>
      </section>

      <section className={cx(sectionFrameClass, "pb-16 pt-8 sm:pb-20 sm:pt-10")}>
        <div className="rounded-[2rem] bg-primary px-6 py-12 text-center text-primary-foreground shadow-[var(--shadow-soft)] sm:px-10">
          <h2 className="text-balance text-[clamp(1.8rem,3vw,2.8rem)] font-semibold tracking-[-0.04em]">
            {t("landing.ctaTitle")}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-primary-foreground/80">
            {t("landing.heroDescription")}
          </p>
          <Link className={cx(actionClass("light"), "mt-6")} to={`${prefix}/student/onboarding`}>
            {t("landing.ctaStartJourney")}
          </Link>
        </div>
      </section>

      <footer className={cx(sectionFrameClass, "pb-8 text-center text-sm text-muted-foreground")}>
        <p>{t("branding.footer")}</p>
      </footer>
    </main>
  );
}
