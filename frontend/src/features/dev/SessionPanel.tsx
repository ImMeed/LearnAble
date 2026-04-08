import { FormEvent, useMemo, useState } from "react";

import { clearSession, getSession, setSession } from "../../state/auth";

type Props = {
  onSessionChanged: () => void;
};

export function SessionPanel({ onSessionChanged }: Props) {
  const current = useMemo(() => getSession(), []);
  const [token, setToken] = useState(current?.accessToken ?? "");
  const [role, setRole] = useState(current?.role ?? "ROLE_STUDENT");

  const onSave = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = token.trim();
    if (!trimmed) return;
    setSession({ accessToken: trimmed, role: role.trim() || "ROLE_STUDENT" });
    onSessionChanged();
  };

  const onClear = () => {
    clearSession();
    setToken("");
    setRole("ROLE_STUDENT");
    onSessionChanged();
  };

  return (
    <section className="card checkpoint-block">
      <h3>Session Setup</h3>
      <p className="muted">Paste a JWT from backend login to test secured endpoints.</p>
      <form onSubmit={onSave} className="stack-form">
        <label>
          Role Label
          <input value={role} onChange={(event) => setRole(event.target.value)} placeholder="ROLE_STUDENT" />
        </label>
        <label>
          Access Token
          <textarea
            value={token}
            onChange={(event) => setToken(event.target.value)}
            rows={4}
            placeholder="Paste Bearer token value here"
          />
        </label>
        <div className="inline-actions">
          <button type="submit">Save Session</button>
          <button type="button" onClick={onClear} className="secondary">
            Clear Session
          </button>
        </div>
      </form>
    </section>
  );
}
