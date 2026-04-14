import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import { apiClient } from "../../api/client";
import { AccessibilityToolbar } from "../components/AccessibilityToolbar";
import { CompactLanguageSwitcher } from "../components/CompactLanguageSwitcher";
import { PublicHeader } from "../components/PublicHeader";
import { actionClass, cx, inputClass, pageShellClass, sectionFrameClass, surfaceClass } from "../components/uiStyles";
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
  const [statusTone, setStatusTone] = useState<"neutral" | "pending" | "success" | "error">("neutral");
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
      setStatusTone("success");
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
        setStatusTone("success");
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
      setStatusTone("error");
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
  };

    setAutoSubmitted(true);
    setStatus(t("onboarding.submitting"));
    setStatusTone("pending");
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
      setStatusTone("pending");
      await submitScreening();
    } else {
      // If not logged in, mark as pending and redirect to registration
      localStorage.setItem(ONBOARDING_PENDING_KEY, "true");
      setStatus(t("onboarding.saved"));
      setStatusTone("success");
      navigate(`${prefix}/login`, { replace: true });
    }
  };

  return (
    <main className={pageShellClass}>
      <PublicHeader
        className="bg-background"
        actions={
          <>
            <CompactLanguageSwitcher />
            <AccessibilityToolbar />
            <Link className={actionClass("ghost")} to={`${prefix}/login`}>
              {t("onboarding.signInLink")}
            </Link>
          </>
        }
      />

      <section className={cx(sectionFrameClass, "py-12 sm:py-16")}>
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-center" aria-label={t("onboarding.progressLabel")}>
            <div className="flex items-center justify-center gap-0">
          {STEPS.map((_, index) => {
            const active = index <= step;
            return (
                  <div className="flex items-center" key={index}>
                    <span
                      className={cx(
                        "inline-flex h-11 w-11 items-center justify-center rounded-full border text-sm font-semibold transition duration-200",
                        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground",
                      )}
                    >
                      {index + 1}
                    </span>
                    {index < STEPS.length - 1 ? (
                      <span className="mx-2 h-0.5 w-12 bg-border sm:w-20" aria-hidden="true" />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <p className="mt-5 text-center text-sm font-medium text-muted-foreground">
            {t("onboarding.stepCounter", { current: step + 1, total: STEPS.length })}
          </p>

          <article className={cx(surfaceClass, "mx-auto mt-6 max-w-[40rem] p-6 sm:p-8")}>
            <h1 className="text-balance text-[clamp(2rem,3vw,2.8rem)] font-semibold tracking-[-0.04em] text-foreground">
              {t(current.titleKey)}
            </h1>
            <p className="mt-3 text-base leading-7 text-muted-foreground">{t(current.descriptionKey)}</p>

            <form className="mt-6 grid gap-5" onSubmit={(event) => void onSubmit(event)}>
              <label>
                <span className="mb-2 block text-sm font-semibold text-foreground">{t(current.promptKey)}</span>
                {step === 0 ? (
                  <input
                    className={inputClass}
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={t("onboarding.answerPlaceholder")}
                    required
                  />
                ) : (
                  <select
                    className={inputClass}
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

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  className={actionClass("soft")}
                  disabled={step === 0}
                  onClick={() => setStep((prev) => Math.max(0, prev - 1))}
                >
                  {t("common.back")}
                </button>
                <button className={actionClass()} type="submit">
                  {step < STEPS.length - 1 ? t("common.continue") : t("common.finish")}
                </button>
              </div>
            </form>

            {status ? (
              <p
                className={cx(
                  "mt-5 rounded-[1rem] border px-4 py-3 text-sm leading-6",
                  statusTone === "error"
                    ? "border-destructive bg-destructive/10 text-foreground"
                    : statusTone === "success"
                      ? "border-secondary bg-secondary/10 text-foreground"
                      : "border-border bg-background text-muted-foreground",
                )}
              >
                {status}
              </p>
            ) : null}
          </article>

          <p className="mx-auto mt-6 max-w-2xl text-center text-sm leading-7 text-muted-foreground">
            {t("onboarding.helperText")}
          </p>
        </div>
      </section>
    </main>
  );
}
