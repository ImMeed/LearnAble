import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { AccessibilityToolbar } from "../components/AccessibilityToolbar";
import { BrandLogo } from "../components/BrandLogo";
import { LanguageSwitcher } from "../../features/accessibility/LanguageSwitcher";

function localePrefix(resolvedLanguage: string | undefined): string {
  return resolvedLanguage === "en" ? "/en" : "/ar";
}

export function LandingPage() {
  const { i18n, t } = useTranslation();
  const prefix = useMemo(() => localePrefix(i18n.resolvedLanguage), [i18n.resolvedLanguage]);

  const features = [
    {
      title: t("landing.feature1Title"),
      description: t("landing.feature1Description"),
      icon: "target",
    },
    {
      title: t("landing.feature2Title"),
      description: t("landing.feature2Description"),
      icon: "brain",
    },
    {
      title: t("landing.feature3Title"),
      description: t("landing.feature3Description"),
      icon: "chat",
    },
  ];

  const flowItems = [
    { role: t("landing.flowStudentRole"), detail: t("landing.flowStudentDetail"), icon: "student" },
    { role: t("landing.flowTeacherRole"), detail: t("landing.flowTeacherDetail"), icon: "teacher" },
    { role: t("landing.flowPsychRole"), detail: t("landing.flowPsychDetail"), icon: "psych" },
    { role: t("landing.flowParentRole"), detail: t("landing.flowParentDetail"), icon: "parent" },
  ];
  const trackCards = [
    {
      title: i18n.resolvedLanguage === "en" ? "+10 Platform" : "منصة +10",
      body:
        i18n.resolvedLanguage === "en"
          ? "For the main learning journey with student, tutor, parent, psychologist, and admin accounts."
          : "للمسار الرئيسي للتعلم مع حسابات الطالب والمعلم وولي الأمر والأخصائي والإدارة.",
      loginPath: `${prefix}/login`,
      signupPath: `${prefix}/signup`,
    },
    {
      title: i18n.resolvedLanguage === "en" ? "Reading Lab" : "مختبر القراءة",
      body:
        i18n.resolvedLanguage === "en"
          ? "For dyslexic kids, parents, and psychologists using the separate reading-support experience."
          : "لمسار الأطفال ذوي عسر القراءة مع حسابات مستقلة للأهل والأخصائيين والأطفال.",
      loginPath: `${prefix}/reading-lab/login`,
      signupPath: `${prefix}/reading-lab/signup`,
    },
  ];

  return (
    <main className="public-page">
      <header className="public-header">
        <div className="public-header-inner">
          <Link className="brand-link" to={prefix}>
            <BrandLogo className="brand-icon" />
            <span className="brand-text">{t("appTitle")}</span>
          </Link>
          <div className="public-header-actions">
            <LanguageSwitcher />
            <AccessibilityToolbar />
            <Link className="public-link" to={`${prefix}/login`}>
              {t("common.signIn")}
            </Link>
            <Link className="public-button secondary" to={`${prefix}/student/onboarding`}>
              {t("common.getStartedFree")}
            </Link>
          </div>
        </div>
      </header>

      <section className="hero-section">
        <div className="hero-content">
          <h1>{t("landing.heroTitle")}</h1>
          <p>{t("landing.heroDescription")}</p>
          <div className="hero-cta-row">
            <Link className="public-button" to={`${prefix}/login`}>
              {t("common.signIn")}
            </Link>
            <Link className="public-button success" to={`${prefix}/student/onboarding`}>
              {t("common.getStartedFree")}
            </Link>
          </div>
        </div>
      </section>

      <section className="public-section">
        <h2>{i18n.resolvedLanguage === "en" ? "Choose your platform track" : "اختر مسار المنصة"}</h2>
        <div className="feature-grid landing-features">
          {trackCards.map((track) => (
            <article className="feature-card" key={track.title}>
              <h3>{track.title}</h3>
              <p className="muted">{track.body}</p>
              <div className="hero-cta-row">
                <Link className="public-button secondary" to={track.loginPath}>
                  {t("common.signIn")}
                </Link>
                <Link className="public-button success" to={track.signupPath}>
                  {t("login.createAccount")}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="public-section">
        <h2>{t("landing.keyFeatures")}</h2>
        <div className="feature-grid landing-features">
          {features.map((item) => (
            <article className="feature-card" key={item.title}>
              <span className={`feature-icon ${item.icon}`} aria-hidden="true" />
              <h3>{item.title}</h3>
              <p className="muted">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="public-section flow-section">
        <h2>{t("landing.howItWorks")}</h2>
        <div className="flow-track">
          {flowItems.map((item, index) => (
            <div className="flow-item" key={item.role}>
              <div className={`flow-dot ${item.icon}`} />
              <strong>{item.role}</strong>
              <span className="muted">{item.detail}</span>
              {index < flowItems.length - 1 ? <span className="flow-arrow" aria-hidden="true" /> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="public-cta-band">
        <h2>{t("landing.ctaTitle")}</h2>
        <Link className="public-button light" to={`${prefix}/student/onboarding`}>
          {t("landing.ctaStartJourney")}
        </Link>
      </section>

      <footer className="public-footer">
        <p>{t("branding.footer")}</p>
      </footer>
    </main>
  );
}
