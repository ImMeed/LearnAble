import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookOpen, GraduationCap, Lock, Mail, Users } from "lucide-react";

import { apiClient } from "../../api/client";
import { AccessibilityToolbar } from "../components/AccessibilityToolbar";
import { CompactLanguageSwitcher } from "../components/CompactLanguageSwitcher";
import { PublicHeader } from "../components/PublicHeader";
import { actionClass, cx, inputClass, pageShellClass, sectionFrameClass, surfaceClass } from "../components/uiStyles";
import { getInitialLocale } from "../locale";
import { setSession } from "../../state/auth";

const ROLE_CHOICES = [
  { id: "student", labelKey: "login.roleStudent", Icon: GraduationCap, apiRole: "ROLE_STUDENT" },
  { id: "teacher", labelKey: "login.roleTeacher", Icon: BookOpen, apiRole: "ROLE_TUTOR" },
  { id: "parent", labelKey: "login.roleParent", Icon: Users, apiRole: "ROLE_PARENT" },
] as const;

type SelectedRole = (typeof ROLE_CHOICES)[number]["id"];
type Mode = "login" | "register";

function readError(error: unknown): string {
  if (typeof error === "object" && error && "response" in error) {
    const payload = (error as { response?: { data?: unknown } }).response?.data;
    if (typeof payload === "object" && payload && "message" in payload) {
      return String((payload as { message?: unknown }).message);
    }
    if (typeof payload === "object" && payload && "detail" in payload) {
      return String((payload as { detail?: unknown }).detail);
    }
  }
  return String(error);
}

function routeFromRole(role: string): string {
  switch (role) {
    case "ROLE_STUDENT":
      return "/student/dashboard";
    case "ROLE_TUTOR":
      return "/teacher/dashboard";
    case "ROLE_PARENT":
      return "/parent/dashboard";
    case "ROLE_PSYCHOLOGIST":
      return "/psychologist/dashboard";
    case "ROLE_ADMIN":
      return "/admin/dashboard";
    default:
      return "/";
  }
}

export function LoginPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const locale = getInitialLocale(location.pathname);
  const inputDirection = locale === "ar" ? "rtl" : "ltr";
  const fieldIconPosition = locale === "ar" ? "right-4 left-auto" : "left-4 right-auto";
  const fieldInputPadding = locale === "ar" ? "!pr-11 !pl-4 text-right" : "!pl-11 !pr-4 text-left";
  const prefix = locale === "en" ? "/en" : "/ar";

  const [mode, setMode] = useState<Mode>("login");
  const [selectedRole, setSelectedRole] = useState<SelectedRole>("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState<"neutral" | "pending" | "error">("neutral");

  const selectedRoleConfig = ROLE_CHOICES.find((role) => role.id === selectedRole) ?? ROLE_CHOICES[0];

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setStatus("");
    setStatusTone("neutral");
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      return;
    }

    setBusy(true);
    setStatus(t("login.submitPending"));
    setStatusTone("pending");

    try {
      if (mode === "register") {
        const response = await apiClient.post(
          "/auth/register",
          {
            email: email.trim(),
            password,
            role: selectedRoleConfig.apiRole,
          },
          { headers: { "x-lang": locale } },
        );

        const data = response.data as { access_token: string; role: string };
        setSession({ accessToken: data.access_token, role: data.role });
        
        // Always redirect newly registered students to onboarding
        // (whether they came from onboarding flow or registered directly from login page)
        if (data.role === "ROLE_STUDENT") {
          navigate(`${prefix}/student/onboarding?fromRegister=1`, { replace: true });
        } else {
          navigate(`${prefix}${routeFromRole(data.role)}`, { replace: true });
        }
        return;
      }

      const response = await apiClient.post(
        "/auth/login",
        {
          email: email.trim(),
          password,
        },
        { headers: { "x-lang": locale } },
      );

      const data = response.data as { access_token: string; role: string };
      setSession({ accessToken: data.access_token, role: data.role });

      if (data.role === "ROLE_STUDENT" && localStorage.getItem("learnable_onboarding_pending") === "true") {
        navigate(`${prefix}/student/onboarding`, { replace: true });
        return;
      }

      const requestedFrom = (location.state as { from?: string } | undefined)?.from;
      const safePath = requestedFrom && requestedFrom.startsWith("/") ? requestedFrom : routeFromRole(data.role);
      const alreadyLocalized = safePath.startsWith("/en/") || safePath.startsWith("/ar/") || safePath === "/en" || safePath === "/ar";
      const targetPath = alreadyLocalized ? safePath : safePath === "/" ? prefix : `${prefix}${safePath}`;
      navigate(targetPath, { replace: true });
    } catch (error) {
      const errorLabel = mode === "register" ? t("login.registerFailed") : t("login.authFailed");
      setStatus(`${errorLabel}: ${readError(error)}`);
      setStatusTone("error");
    } finally {
      setBusy(false);
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
            <Link className={actionClass("ghost")} to={prefix}>
              {t("common.back")}
            </Link>
          </>
        }
      />

      <section className={cx(sectionFrameClass, "flex flex-col items-center py-12 sm:py-16")}>
        <div className="max-w-2xl text-center">
          <h1 className="text-balance text-[clamp(2.2rem,4vw,3.3rem)] font-semibold tracking-[-0.05em] text-foreground">
            {t("login.welcome")}
          </h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">{t("login.subtitle")}</p>
        </div>

        <article className={cx(surfaceClass, "mt-8 w-full max-w-[32rem] p-6 sm:p-8")}>
          {mode === "register" ? (
            <>
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t("login.roleLabel")}</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="radiogroup" aria-label={t("login.roleLabel")}>
                {ROLE_CHOICES.map((role) => {
                  const isSelected = role.id === selectedRole;
                  const RoleIcon = role.Icon;
                  return (
                    <button
                      key={role.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      className={cx(
                        "flex !min-h-28 flex-col items-center justify-center gap-3 !rounded-[1rem] !border !px-3 !py-4 text-center transition duration-200",
                        isSelected
                          ? "!border-primary !bg-primary/10 shadow-[0_14px_28px_rgba(74,144,226,0.14)]"
                          : "!border-border !bg-background hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(33,40,55,0.08)]",
                      )}
                      onClick={() => setSelectedRole(role.id)}
                    >
                      <span
                        className={cx(
                          "inline-flex h-11 w-11 items-center justify-center rounded-full border",
                          isSelected ? "border-primary bg-card text-primary" : "border-border bg-card text-muted-foreground",
                        )}
                        aria-hidden="true"
                      >
                        <RoleIcon className="h-5 w-5" />
                      </span>
                      <span className="text-sm font-semibold text-foreground">{t(role.labelKey)}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}

          <form className={cx(mode === "register" ? "mt-6" : "mt-2", "grid gap-4")} onSubmit={(event) => void onSubmit(event)}>
            <label className={cx(locale === "ar" ? "text-right" : "text-left") }>
              <span className={cx("mb-2 block text-sm font-semibold text-foreground", locale === "ar" ? "text-right" : "text-left")}>{t("login.emailLabel")}</span>
              <div className="relative" dir={inputDirection}>
                <Mail
                  className={cx(
                    "pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground",
                    fieldIconPosition,
                  )}
                  aria-hidden="true"
                />
                <input
                  className={cx(inputClass, fieldInputPadding)}
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={t("login.emailPlaceholder")}
                  dir={inputDirection}
                  required
                />
              </div>
            </label>
            <label className={cx(locale === "ar" ? "text-right" : "text-left") }>
              <span className={cx("mb-2 block text-sm font-semibold text-foreground", locale === "ar" ? "text-right" : "text-left")}>{t("login.passwordLabel")}</span>
              <div className="relative" dir={inputDirection}>
                <Lock
                  className={cx(
                    "pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground",
                    fieldIconPosition,
                  )}
                  aria-hidden="true"
                />
                <input
                  className={cx(inputClass, fieldInputPadding)}
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t("login.passwordPlaceholder")}
                  dir={inputDirection}
                  minLength={8}
                  required
                />
              </div>
            </label>
            <button
              type="submit"
              className={cx(mode === "register" ? actionClass("secondary") : actionClass(), "mt-2 w-full")}
              disabled={busy || !email.trim() || !password.trim()}
            >
              {busy
                ? t("login.pleaseWait")
                : mode === "register"
                  ? t("login.createAccountCta")
                  : t("common.signIn")}
            </button>
          </form>

          {status ? (
            <p
              className={cx(
                "mt-4 rounded-[1rem] border px-4 py-3 text-sm leading-6",
                statusTone === "error"
                  ? "border-destructive bg-destructive/10 text-foreground"
                  : "border-border bg-background text-muted-foreground",
              )}
            >
              {status}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-sm">
            {mode === "register" ? (
              <button
                type="button"
                className="!min-h-0 !border-0 !bg-transparent !p-0 font-medium !text-primary transition hover:!text-foreground"
                onClick={() => switchMode("login")}
              >
                {t("common.signIn")}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="!min-h-0 !border-0 !bg-transparent !p-0 font-medium !text-primary transition hover:!text-foreground"
                  onClick={() => switchMode("login")}
                >
                  {t("login.forgotPassword")}
                </button>
                <span aria-hidden="true" className="text-muted-foreground/50">{"\u2022"}</span>
                <button
                  type="button"
                  className="!min-h-0 !border-0 !bg-transparent !p-0 font-medium !text-primary transition hover:!text-foreground"
                  onClick={() => switchMode("register")}
                >
                  {t("login.createAccount")}
                </button>
              </>
            )}
          </div>

        </article>
      </section>
    </main>
  );
}
