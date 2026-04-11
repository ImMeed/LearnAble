import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { apiClient } from "../../api/client";
import { AccessibilityToolbar } from "../components/AccessibilityToolbar";
import { BrandLogo } from "../components/BrandLogo";
import { LanguageSwitcher } from "../../features/accessibility/LanguageSwitcher";
import { getReadingLabPortalCopy } from "../../features/readingLab/portalCopy";
import { setSession } from "../../state/auth";

type Mode = "login" | "signup";
type ReadingLabRole = "student" | "parent" | "psychologist";

const ROLE_CHOICES = [
  { id: "student", apiRole: "ROLE_STUDENT" },
  { id: "parent", apiRole: "ROLE_PARENT" },
  { id: "psychologist", apiRole: "ROLE_PSYCHOLOGIST" },
] as const;

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

function kidsRouteFromRole(role: string): string {
  switch (role) {
    case "ROLE_STUDENT":
      return "/reading-lab/student/dashboard";
    case "ROLE_PARENT":
      return "/reading-lab/parent/dashboard";
    case "ROLE_PSYCHOLOGIST":
      return "/reading-lab/psychologist/dashboard";
    default:
      return "/reading-lab/login";
  }
}

function canOpenRequestedReadingLabPath(role: string, path: string): boolean {
  if (!path.startsWith("/")) return false;

  const normalized = path.startsWith("/en/") || path.startsWith("/ar/")
    ? path.replace(/^\/(en|ar)/, "")
    : path;

  switch (role) {
    case "ROLE_STUDENT":
      return normalized === "/reading-lab/student/dashboard" || normalized === "/reading-lab/student/lab" || normalized === "/student/reading-lab";
    case "ROLE_PARENT":
      return normalized === "/reading-lab/parent/dashboard";
    case "ROLE_PSYCHOLOGIST":
      return normalized === "/reading-lab/psychologist/dashboard";
    default:
      return false;
  }
}

export function ReadingLabAuthPage({ defaultMode = "login" }: { defaultMode?: Mode }) {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const prefix = useMemo(() => localePrefix(i18n.resolvedLanguage), [i18n.resolvedLanguage]);
  const portalPrefix = `${prefix}/reading-lab`;
  const copy = useMemo(() => getReadingLabPortalCopy(i18n.resolvedLanguage), [i18n.resolvedLanguage]);
  const locale = i18n.resolvedLanguage === "en" ? "en" : "ar";

  const authLabels = useMemo(
    () =>
      locale === "en"
        ? {
            loginBadge: "Role detected automatically",
            loginGuideTitle: "Access the right workspace",
            loginGuideChip: "One login per account",
            loginGuideBody:
              "For Reading Lab sign in, we detect the real account behind the email and password, then open the matching dashboard automatically.",
            loginTipsTitle: "Common mix-ups to avoid",
            loginTips: [
              "Parents must use the parent email and password, not the child's credentials.",
              "Kids log in with the child account created for Reading Lab.",
              "Psychologists can use their own account and connect children from the dashboard after login.",
            ],
            loginNoteTitle: "No role picker on login",
            loginNoteBody:
              "This is intentional. Choosing Parent or Kid on the screen should never override the actual account you sign into.",
            mismatchTitle: "If a parent screen opens as a kid account",
            mismatchBody:
              "That means the email and password belong to a child account. Sign out and log back in with the parent's own Reading Lab account.",
            childNameLabel: "Kid name",
            adultNameLabel: "Your name",
            kidIdLabel: "Kid ID to link",
            kidIdHint:
              "Parents can create the child first, then sign up here using that child ID. Psychologists can add a child ID now or later from the dashboard.",
            helperSignupTitle: "What happens next?",
            helperSignupLines: [
              "Parents create or link a child, activate dyslexia support, then define focus letters, words, and numbers.",
              "Kids receive games on their own dashboard based on that support plan.",
              "Psychologists can follow the same child and review progress in a separate workspace.",
            ],
            signupNameRequired: "Add a name to finish creating the account.",
            passwordHint: "Use 8+ characters with one uppercase letter, one number, and one special character.",
          }
        : {
            loginBadge: "يتم تحديد الدور تلقائيا",
            loginGuideTitle: "ادخل إلى الواجهة الصحيحة",
            loginGuideChip: "حساب واحد لكل دخول",
            loginGuideBody:
              "في تسجيل الدخول إلى مختبر القراءة، يتم التعرف على الحساب الحقيقي من البريد وكلمة المرور ثم فتح اللوحة المناسبة تلقائيا.",
            loginTipsTitle: "أخطاء شائعة يجب تجنبها",
            loginTips: [
              "يجب على ولي الأمر استخدام بريد وكلمة مرور حسابه هو، وليس بيانات الطفل.",
              "الطفل يدخل بحساب الطفل الذي تم إنشاؤه داخل مختبر القراءة.",
              "الأخصائي يدخل بحسابه الخاص ويمكنه ربط الأطفال من اللوحة بعد الدخول.",
            ],
            loginNoteTitle: "لا يوجد اختيار دور عند تسجيل الدخول",
            loginNoteBody:
              "هذا مقصود. اختيار ولي الأمر أو الطفل على الشاشة يجب ألا يغير نوع الحساب الحقيقي الذي يتم تسجيل الدخول به.",
            mismatchTitle: "إذا فتحت لوحة طفل بدل لوحة ولي الأمر",
            mismatchBody:
              "فهذا يعني أن البريد وكلمة المرور يعودان إلى حساب طفل. سجل الخروج ثم ادخل بحساب ولي الأمر الخاص بمختبر القراءة.",
            childNameLabel: "اسم الطفل",
            adultNameLabel: "اسمك",
            kidIdLabel: "معرف الطفل للربط",
            kidIdHint:
              "يمكن لولي الأمر إنشاء الطفل أولا ثم التسجيل هنا باستعمال معرفه. ويمكن للأخصائي إضافة معرف الطفل الآن أو لاحقا من اللوحة.",
            helperSignupTitle: "ماذا يحدث بعد ذلك؟",
            helperSignupLines: [
              "ولي الأمر ينشئ الطفل أو يربطه ثم يفعّل دعم عسر القراءة ويحدد الحروف والكلمات والأرقام المستهدفة.",
              "الطفل يرى الألعاب المناسبة له في لوحته الخاصة.",
              "الأخصائي يتابع نفس الطفل من واجهة مستقلة ويراجع التقدم.",
            ],
            signupNameRequired: "أضف الاسم لإكمال إنشاء الحساب.",
            passwordHint: "استعمل 8 أحرف أو أكثر مع حرف كبير ورقم ورمز خاص.",
          },
    [locale],
  );

  const [mode, setMode] = useState<Mode>(defaultMode);
  const [selectedRole, setSelectedRole] = useState<ReadingLabRole>("student");
  const [displayName, setDisplayName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const isSignup = mode === "signup";
  const selectedRoleConfig = ROLE_CHOICES.find((item) => item.id === selectedRole) ?? ROLE_CHOICES[0];
  const helperRole = copy.auth.roles[selectedRole];
  const pageRoleClass = isSignup ? `role-${selectedRole}` : "role-login";
  const selectedRoleLabel = selectedRole === "student" ? authLabels.childNameLabel : authLabels.adultNameLabel;

  useEffect(() => {
    setMode(defaultMode);
    setStatus("");
  }, [defaultMode]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password.trim()) return;
    if (isSignup && !displayName.trim()) {
      setStatus(authLabels.signupNameRequired);
      return;
    }

    setBusy(true);
    setStatus(copy.auth.statusPending);
    try {
      if (isSignup) {
        const response = await apiClient.post(
          "/auth/register",
          {
            email: email.trim(),
            password,
            role: selectedRoleConfig.apiRole,
            platform_track: "READING_LAB",
            display_name: displayName.trim(),
            student_id: studentId.trim() || undefined,
          },
          { headers: { "x-lang": locale } },
        );
        const data = response.data as {
          access_token: string;
          role: string;
          platform_track: "PLUS_TEN" | "READING_LAB";
        };
        setSession({
          accessToken: data.access_token,
          role: data.role,
          platformTrack: data.platform_track ?? "READING_LAB",
        });
        navigate(`${prefix}${kidsRouteFromRole(data.role)}`, { replace: true });
        return;
      }

      const response = await apiClient.post(
        "/auth/login",
        {
          email: email.trim(),
          password,
          platform_track: "READING_LAB",
        },
        { headers: { "x-lang": locale } },
      );
      const data = response.data as { access_token: string; role: string; platform_track: "PLUS_TEN" | "READING_LAB" };
      setSession({
        accessToken: data.access_token,
        role: data.role,
        platformTrack: data.platform_track ?? "READING_LAB",
      });
      const requestedFrom = (location.state as { from?: string } | undefined)?.from;
      const safePath =
        requestedFrom && canOpenRequestedReadingLabPath(data.role, requestedFrom)
          ? requestedFrom
          : kidsRouteFromRole(data.role);
      const targetPath = safePath.startsWith("/en/") || safePath.startsWith("/ar/") ? safePath : `${prefix}${safePath}`;
      navigate(targetPath, { replace: true });
    } catch (error) {
      setStatus(readError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className={`reading-auth-page ${pageRoleClass}`}>
      <header className="public-header reading-auth-header">
        <div className="public-header-inner">
          <Link className="brand-link" to={prefix}>
            <BrandLogo className="brand-icon" />
            <span className="brand-text">{copy.sectionTitle}</span>
          </Link>
          <div className="public-header-actions auth-header-actions">
            <LanguageSwitcher />
            <AccessibilityToolbar />
            <Link className="public-link" to={prefix}>
              {copy.classicLink}
            </Link>
          </div>
        </div>
      </header>

      <section className="reading-auth-shell">
        <article className="reading-auth-story">
          <span className="reading-auth-eyebrow">{copy.auth.eyebrow}</span>
          <h1>{copy.auth.title}</h1>
          <p className="muted">{copy.auth.subtitle}</p>

          <div className="reading-auth-helper-card">
            <div className="reading-auth-helper-head">
              <strong>{isSignup ? helperRole.label : authLabels.loginGuideTitle}</strong>
              <span>{isSignup ? helperRole.hint : authLabels.loginGuideChip}</span>
            </div>

            {isSignup ? (
              <>
                <h3>{authLabels.helperSignupTitle}</h3>
                <div className="stack-list">
                  {authLabels.helperSignupLines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="muted">{authLabels.loginGuideBody}</p>
                <div className="reading-auth-lane-grid">
                  {ROLE_CHOICES.map((role) => {
                    const roleCopy = copy.auth.roles[role.id];
                    return (
                      <article className="reading-auth-lane" key={role.id}>
                        <strong>{roleCopy.label}</strong>
                        <span>{roleCopy.hint}</span>
                      </article>
                    );
                  })}
                </div>
                <div className="reading-auth-tips">
                  <strong>{authLabels.loginTipsTitle}</strong>
                  <div className="stack-list">
                    {authLabels.loginTips.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </article>

        <article className="reading-auth-card">
          <div className="reading-auth-track-badge">
            <span>{copy.sectionTitle}</span>
            <span>{isSignup ? helperRole.label : authLabels.loginBadge}</span>
          </div>

          <div className="reading-auth-tabs" role="tablist" aria-label={copy.sectionTitle}>
            <button
              type="button"
              className={mode === "login" ? "active" : ""}
              onClick={() => {
                setMode("login");
                setStatus("");
              }}
            >
              {copy.auth.loginTab}
            </button>
            <button
              type="button"
              className={mode === "signup" ? "active" : ""}
              onClick={() => {
                setMode("signup");
                setStatus("");
              }}
            >
              {copy.auth.signupTab}
            </button>
          </div>

          {isSignup ? (
            <div className="reading-auth-role-group">
              <p className="auth-label">{copy.auth.roleLabel}</p>
              <div className="reading-auth-role-grid">
                {ROLE_CHOICES.map((role) => {
                  const roleCopy = copy.auth.roles[role.id];
                  const selected = role.id === selectedRole;
                  return (
                    <button
                      key={role.id}
                      type="button"
                      className={selected ? "reading-auth-role selected" : "reading-auth-role"}
                      onClick={() => setSelectedRole(role.id)}
                    >
                      <strong>{roleCopy.label}</strong>
                      <span>{roleCopy.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="reading-auth-mode-note">
              <strong>{authLabels.loginNoteTitle}</strong>
              <p>{authLabels.loginNoteBody}</p>
            </div>
          )}

          <form className="stack-form" onSubmit={(event) => void onSubmit(event)}>
            {isSignup ? (
              <label>
                {selectedRoleLabel}
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder={selectedRoleLabel}
                  autoComplete="name"
                />
              </label>
            ) : null}

            <label>
              {copy.auth.emailLabel}
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={copy.auth.emailPlaceholder}
                autoComplete="email"
                required
              />
            </label>

            <label>
              {copy.auth.passwordLabel}
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={copy.auth.passwordPlaceholder}
                minLength={8}
                autoComplete={isSignup ? "new-password" : "current-password"}
                required
              />
            </label>

            {isSignup && selectedRole !== "student" ? (
              <label>
                {authLabels.kidIdLabel}
                <input
                  value={studentId}
                  onChange={(event) => setStudentId(event.target.value)}
                  placeholder={authLabels.kidIdLabel}
                />
              </label>
            ) : null}

            <p className="muted reading-auth-password-hint">{authLabels.passwordHint}</p>

            {isSignup && selectedRole !== "student" ? (
              <p className="muted">{authLabels.kidIdHint}</p>
            ) : null}

            {!isSignup ? (
              <div className="reading-auth-callout">
                <strong>{authLabels.mismatchTitle}</strong>
                <p>{authLabels.mismatchBody}</p>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={busy || !email.trim() || !password.trim() || (isSignup && !displayName.trim())}
            >
              {busy ? copy.auth.statusPending : isSignup ? copy.auth.submitSignup : copy.auth.submitLogin}
            </button>
          </form>

          {status ? <p className="status-line">{status}</p> : null}

          <div className="reading-auth-footer-row">
            <p className="muted">{mode === "login" ? copy.auth.switchPromptSignup : copy.auth.switchPromptLogin}</p>
            <Link className="secondary-link" to={`${portalPrefix}/${mode === "login" ? "signup" : "login"}`}>
              {mode === "login" ? copy.auth.switchToSignup : copy.auth.switchToLogin}
            </Link>
          </div>
        </article>
      </section>
    </main>
  );
}
