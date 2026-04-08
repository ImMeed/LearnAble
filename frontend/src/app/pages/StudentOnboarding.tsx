import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { apiClient } from "../../api/client";
import { AccessibilityToolbar } from "../components/AccessibilityToolbar";
import { BrandLogo } from "../components/BrandLogo";
import { LanguageSwitcher } from "../../features/accessibility/LanguageSwitcher";
import { getSession } from "../../state/auth";

const ONBOARDING_NAME_KEY = "learnable_onboarding_name";
const ONBOARDING_ANSWERS_KEY = "learnable_onboarding_answers";
const ONBOARDING_PENDING_KEY = "learnable_onboarding_pending";

function readStoredAnswers(): Record<number, string> {
  const raw = localStorage.getItem(ONBOARDING_ANSWERS_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return Object.entries(parsed).reduce<Record<number, string>>((acc, [key, value]) => {
      const numericKey = Number(key);
      if (Number.isInteger(numericKey) && typeof value === "string") {
        acc[numericKey] = value;
      }
      return acc;
    }, {});
  } catch {
    localStorage.removeItem(ONBOARDING_ANSWERS_KEY);
    return {};
  }
}

function localePrefix(resolvedLanguage: string | undefined): string {
  return resolvedLanguage === "en" ? "/en" : "/ar";
}

type OnboardingStep = {
  titleKey: string;
  descriptionKey: string;
  promptKey: string;
  choices?: string[];
};

const STEPS: OnboardingStep[] = [
  {
    titleKey: "onboarding.step1Title",
    descriptionKey: "onboarding.step1Description",
    promptKey: "onboarding.step1Prompt",
  },
  {
    titleKey: "onboarding.step2Title",
    descriptionKey: "onboarding.step2Description",
    promptKey: "onboarding.step2Prompt",
    choices: [
      "onboarding.step2Choice1",
      "onboarding.step2Choice2",
      "onboarding.step2Choice3",
      "onboarding.step2Choice4",
    ],
  },
  {
    titleKey: "onboarding.step3Title",
    descriptionKey: "onboarding.step3Description",
    promptKey: "onboarding.step3Prompt",
    choices: [
      "onboarding.step3Choice1",
      "onboarding.step3Choice2",
      "onboarding.step3Choice3",
      "onboarding.step3Choice4",
    ],
  },
  {
    titleKey: "onboarding.step4Title",
    descriptionKey: "onboarding.step4Description",
    promptKey: "onboarding.step4Prompt",
    choices: [
      "onboarding.step4Choice1",
      "onboarding.step4Choice2",
      "onboarding.step4Choice3",
      "onboarding.step4Choice4",
    ],
  },
];

export function StudentOnboardingPageV2() {
  const { i18n, t } = useTranslation();
  const navigate = useNavigate();
  const locale = i18n.resolvedLanguage === "en" ? "en" : "ar";
  const prefix = useMemo(() => localePrefix(i18n.resolvedLanguage), [i18n.resolvedLanguage]);

  const [step, setStep] = useState(0);
  const [name, setName] = useState(() => localStorage.getItem(ONBOARDING_NAME_KEY) ?? "");
  const [answers, setAnswers] = useState<Record<number, string>>(() => readStoredAnswers());
  const [status, setStatus] = useState("");
  const [autoSubmitted, setAutoSubmitted] = useState(false);

  const current = STEPS[step];
  const session = getSession();
  const translatedChoiceForStep = (targetStep: number, index: number): string => {
    const key = STEPS[targetStep]?.choices?.[index];
    return key ? t(key) : "";
  };

  const screeningFromAnswers = () => {
    const readingAll = translatedChoiceForStep(1, 3);
    const focusAll = translatedChoiceForStep(2, 3);
    const reading = answers[1] === readingAll ? 40 : answers[1] ? 65 : 55;
    const focus = answers[2] === focusAll ? 45 : answers[2] ? 65 : 55;
    const memory = answers[3] ? 70 : 55;
    return {
      focus_score: focus,
      reading_score: reading,
      memory_score: memory,
      notes: "ONBOARDING_SCREENING",
    };
  };

  const clearOnboardingDraft = () => {
    localStorage.removeItem(ONBOARDING_PENDING_KEY);
    localStorage.removeItem(ONBOARDING_NAME_KEY);
    localStorage.removeItem(ONBOARDING_ANSWERS_KEY);
  };

  const hasCompleteAnswers =
    typeof answers[1] === "string" && answers[1].length > 0 &&
    typeof answers[2] === "string" && answers[2].length > 0 &&
    typeof answers[3] === "string" && answers[3].length > 0;

  const submitScreening = async () => {
    try {
      await apiClient.post(
        "/study/screening/complete",
        screeningFromAnswers(),
        {
          headers: {
            "x-lang": locale,
          },
        },
      );
      clearOnboardingDraft();
      setStatus(t("onboarding.saved"));
      navigate(`${prefix}/student/dashboard`, { replace: true });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        (error as { response?: { status?: number } }).response?.status === 409
      ) {
        clearOnboardingDraft();
        setStatus(t("onboarding.saved"));
        navigate(`${prefix}/student/dashboard`, { replace: true });
        return;
      }

      const message =
        typeof error === "object" && error && "response" in error
          ? String(
              ((error as { response?: { data?: { detail?: string } } }).response?.data?.detail ??
                t("common.unknownError")),
            )
          : String(error);
      setStatus(`${t("onboarding.notice")}: ${message}`);
    }
  };

  useEffect(() => {
    if (autoSubmitted) {
      return;
    }
    if (!session?.accessToken || session.role !== "ROLE_STUDENT") {
      return;
    }
    if (localStorage.getItem(ONBOARDING_PENDING_KEY) !== "true") {
      return;
    }
    if (!hasCompleteAnswers) {
      return;
    }

    setAutoSubmitted(true);
    setStatus(t("onboarding.submitting"));
    void submitScreening();
  }, [autoSubmitted, hasCompleteAnswers, session?.accessToken, session?.role, t]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (step < STEPS.length - 1) {
      setStep((prev) => prev + 1);
      return;
    }

    // Store onboarding data locally
    localStorage.setItem(ONBOARDING_NAME_KEY, name.trim());
    localStorage.setItem(ONBOARDING_ANSWERS_KEY, JSON.stringify(answers));

    // If logged in, submit screening immediately
    if (session?.accessToken) {
      setStatus(t("onboarding.submitting"));
      await submitScreening();
    } else {
      // If not logged in, mark as pending and redirect to registration
      localStorage.setItem(ONBOARDING_PENDING_KEY, "true");
      setStatus(t("onboarding.saved"));
      navigate(`${prefix}/login`, { replace: true });
    }
  };

  return (
    <main className="onboarding-v2-page">
      <header className="public-header auth-header">
        <div className="public-header-inner">
          <Link className="brand-link" to={prefix}>
            <BrandLogo className="brand-icon" />
            <span className="brand-text">{t("appTitle")}</span>
          </Link>
          <div className="public-header-actions auth-header-actions">
            <LanguageSwitcher />
            <AccessibilityToolbar />
            <Link className="public-link" to={`${prefix}/login`}>
              {t("onboarding.signInLink")}
            </Link>
          </div>
        </div>
      </header>

      <section className="onboarding-v2-content">
        <div className="onboarding-progress-track" aria-label={t("onboarding.progressLabel")}>
          {STEPS.map((_, index) => {
            const active = index <= step;
            return (
              <div className="onboarding-progress-item" key={index}>
                <span className={active ? "onboarding-dot active" : "onboarding-dot"}>{index + 1}</span>
                {index < STEPS.length - 1 ? <span className="onboarding-progress-line" aria-hidden="true" /> : null}
              </div>
            );
          })}
        </div>

        <p className="muted onboarding-step-label">
          {t("onboarding.stepCounter", { current: step + 1, total: STEPS.length })}
        </p>

        <article className="onboarding-v2-card">
          <h1>{t(current.titleKey)}</h1>
          <p>{t(current.descriptionKey)}</p>

          <form className="stack-form" onSubmit={(event) => void onSubmit(event)}>
            <label>
              {t(current.promptKey)}
              {step === 0 ? (
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t("onboarding.answerPlaceholder")}
                  required
                />
              ) : (
                <select
                  value={answers[step] ?? ""}
                  onChange={(event) => setAnswers((prev) => ({ ...prev, [step]: event.target.value }))}
                  required
                >
                  <option value="">{t("common.chooseOne")}</option>
                  {current.choices?.map((choice) => (
                    <option value={choice} key={choice}>
                      {t(choice)}
                    </option>
                  ))}
                </select>
              )}
            </label>

            <div className="inline-actions onboarding-actions">
              <button
                type="button"
                className="secondary"
                disabled={step === 0}
                onClick={() => setStep((prev) => Math.max(0, prev - 1))}
              >
                {t("common.back")}
              </button>
              <button type="submit">{step < STEPS.length - 1 ? t("common.continue") : t("common.finish")}</button>
            </div>
          </form>

          {status ? <p className="status-line">{status}</p> : null}
        </article>

        <p className="muted onboarding-helper-text">
          {t("onboarding.helperText")}
        </p>
      </section>
    </main>
  );
}
