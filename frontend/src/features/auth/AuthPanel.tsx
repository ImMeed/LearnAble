import { FormEvent, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { apiClient } from "../../api/client";
import { clearSession, getSession, setSession } from "../../state/auth";

const ROLE_OPTIONS = [
  "ROLE_STUDENT",
  "ROLE_TUTOR",
  "ROLE_PSYCHOLOGIST",
  "ROLE_PARENT",
  "ROLE_ADMIN",
] as const;

type Mode = "login" | "register";

function readError(error: unknown): string {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: unknown } }).response;
    const payload = response?.data;
    if (typeof payload === "object" && payload && "message" in payload) {
      return String((payload as { message?: unknown }).message);
    }
    if (typeof payload === "object" && payload && "detail" in payload) {
      const detail = (payload as { detail?: unknown }).detail;
      if (typeof detail === "string") return detail;
      if (typeof detail === "object" && detail && "message" in detail) {
        return String((detail as { message?: unknown }).message);
      }
    }
  }

  return String(error);
}

export function AuthPanel() {
  const { i18n } = useTranslation();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string>("ROLE_STUDENT");
  const [status, setStatus] = useState("Idle");
  const [busy, setBusy] = useState(false);

  const session = useMemo(() => getSession(), [status]);
  const locale = i18n.resolvedLanguage === "en" ? "en" : "ar";

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setStatus("Submitting...");
    try {
      if (mode === "register") {
        const response = await apiClient.post(
          "/auth/register",
          { email, password, role },
          { headers: { "x-lang": locale } },
        );
        const data = response.data as { access_token: string; role: string };
        setSession({ accessToken: data.access_token, role: data.role });
        setStatus(`Registered and logged in as ${data.role}.`);
      } else {
        const response = await apiClient.post(
          "/auth/login",
          { email, password },
          { headers: { "x-lang": locale } },
        );
        const data = response.data as { access_token: string; role: string };
        setSession({ accessToken: data.access_token, role: data.role });
        setStatus(`Logged in as ${data.role}.`);
      }
    } catch (error) {
      setStatus(`Auth failed: ${readError(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const onLogout = () => {
    clearSession();
    setStatus("Session cleared.");
  };

  return (
    <section className="card section-card">
      <h2>{mode === "login" ? "Session Login" : "Create Account"}</h2>
      <p className="muted">Use backend auth so role-protected dashboards and API actions work end-to-end.</p>
      <div className="inline-actions">
        <button type="button" className={mode === "login" ? "" : "secondary"} onClick={() => setMode("login")}>
          Login
        </button>
        <button
          type="button"
          className={mode === "register" ? "" : "secondary"}
          onClick={() => setMode("register")}
        >
          Register
        </button>
        <button type="button" className="secondary" onClick={onLogout}>
          Logout
        </button>
      </div>

      <form className="stack-form checkpoint-block" onSubmit={onSubmit}>
        <label>
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
          />
        </label>
        {mode === "register" ? (
          <label>
            Role
            <select value={role} onChange={(event) => setRole(event.target.value)}>
              {ROLE_OPTIONS.map((item) => (
                <option value={item} key={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <button type="submit" disabled={busy}>
          {busy ? "Please wait..." : mode === "register" ? "Register" : "Login"}
        </button>
      </form>

      <p className="status-line">Status: {status}</p>
      <p className="muted">Current role: {session?.role ?? "none"}</p>
    </section>
  );
}
