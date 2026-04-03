import { FormEvent, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { apiClient } from "../../api/client";
import { AccessibilityToolbar } from "../components/AccessibilityToolbar";
import { BrandLogo } from "../components/BrandLogo";
import { LanguageSwitcher } from "../../features/accessibility/LanguageSwitcher";
import { setSession } from "../../state/auth";

const ROLE_CHOICES = [
  { id: "student", labelKey: "login.roleStudent", icon: "student", apiRole: "ROLE_STUDENT" },
  { id: "teacher", labelKey: "login.roleTeacher", icon: "teacher", apiRole: "ROLE_TUTOR" },
  { id: "parent", labelKey: "login.roleParent", icon: "parent", apiRole: "ROLE_PARENT" },
] as const;

type SelectedRole = (typeof ROLE_CHOICES)[number]["id"];
type Mode = "login" | "register";

function localePrefix(resolvedLanguage: string | undefined): string {
  return resolvedLanguage === "en" ? "/en" : "/ar";
}

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
  const { i18n, t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const locale = i18n.resolvedLanguage === "en" ? "en" : "ar";
  const prefix = useMemo(() => localePrefix(i18n.resolvedLanguage), [i18n.resolvedLanguage]);

  const [mode, setMode] = useState<Mode>("login");
  const [selectedRole, setSelectedRole] = useState<SelectedRole>("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const selectedRoleConfig = ROLE_CHOICES.find((role) => role.id === selectedRole) ?? ROLE_CHOICES[0];

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      return;
    }

    setBusy(true);
    setStatus(t("login.submitPending"));

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
        navigate(`${prefix}${routeFromRole(data.role)}`, { replace: true });
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

      const requestedFrom = (location.state as { from?: string } | undefined)?.from;
      const safePath = requestedFrom && requestedFrom.startsWith("/") ? requestedFrom : routeFromRole(data.role);
      const alreadyLocalized = safePath.startsWith("/en/") || safePath.startsWith("/ar/") || safePath === "/en" || safePath === "/ar";
      const targetPath = alreadyLocalized ? safePath : safePath === "/" ? prefix : `${prefix}${safePath}`;
      navigate(targetPath, { replace: true });
    } catch (error) {
      const errorLabel = mode === "register" ? t("login.registerFailed") : t("login.authFailed");
      setStatus(`${errorLabel}: ${readError(error)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <header className="public-header auth-header">
        <div className="public-header-inner">
          <Link className="brand-link" to={prefix}>
            <BrandLogo className="brand-icon" />
            <span className="brand-text">{t("appTitle")}</span>
          </Link>
          <div className="public-header-actions auth-header-actions">
            <LanguageSwitcher />
            <AccessibilityToolbar />
            <Link className="public-link" to={prefix}>
              {t("common.back")}
            </Link>
          </div>
        </div>
      </header>

      <section className="auth-content">
        <h1>{t("login.welcome")}</h1>
        <p className="muted">{t("login.subtitle")}</p>

        <article className="auth-card">
          <p className="auth-label">{t("login.roleLabel")}</p>
          <div className="role-selector-grid role-selector-grid-three" role="radiogroup" aria-label={t("login.roleLabel")}>
            {ROLE_CHOICES.map((role) => {
              const isSelected = role.id === selectedRole;
              return (
                <button
                  key={role.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={isSelected ? "role-select-button selected" : "role-select-button"}
                  onClick={() => setSelectedRole(role.id)}
                >
                  <span className={`role-icon ${role.icon}`} aria-hidden="true" />
                  <span>{t(role.labelKey)}</span>
                </button>
              );
            })}
          </div>

          <form className="stack-form" onSubmit={(event) => void onSubmit(event)}>
            <label>
              {t("login.emailLabel")}
              <div className="auth-input-wrap">
                <span className="auth-input-icon user" aria-hidden="true" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={t("login.emailPlaceholder")}
                  required
                />
              </div>
            </label>
            <label>
              {t("login.passwordLabel")}
              <div className="auth-input-wrap">
                <span className="auth-input-icon lock" aria-hidden="true" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t("login.passwordPlaceholder")}
                  minLength={8}
                  required
                />
              </div>
            </label>
            <button type="submit" disabled={busy || !email.trim() || !password.trim()}>
              {busy
                ? t("login.pleaseWait")
                : mode === "register"
                  ? t("login.createAccountCta")
                  : t("common.signIn")}
            </button>
          </form>

          {status ? <p className="status-line">{status}</p> : null}

          <div className="auth-links-row">
            <button type="button" className="link-button" onClick={() => setMode("login")}>
              {t("login.forgotPassword")}
            </button>
            <span aria-hidden="true">.</span>
            <button type="button" className="link-button" onClick={() => setMode("register")}>
              {t("login.createAccount")}
            </button>
          </div>
        </article>
      </section>
    </main>
  );
}
