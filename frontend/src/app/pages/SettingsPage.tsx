import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import {
  confirm2FA,
  disable2FA,
  enable2FA,
  get2FAStatus,
  type Enable2FAResponse,
} from "../../api/authApi";

type Step =
  | "idle"
  | "enabling-loading"
  | "enabling-scan"
  | "enabling-confirm"
  | "disabling-confirm"
  | "success"
  | "error";

function readError(error: unknown): string {
  if (typeof error === "object" && error && "response" in error) {
    const payload = (error as { response?: { data?: unknown } }).response?.data;
    if (typeof payload === "object" && payload && "message" in payload) {
      return String((payload as { message: unknown }).message);
    }
  }
  return String(error);
}

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const prefix = i18n.resolvedLanguage === "en" ? "/en" : "/ar";

  const [totpEnabled, setTotpEnabled] = useState<boolean | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [qrData, setQrData] = useState<Enable2FAResponse | null>(null);
  const [code, setCode] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    get2FAStatus()
      .then((data) => setTotpEnabled(data.totp_enabled))
      .catch(() => setTotpEnabled(false));
  }, []);

  const handleEnable = async () => {
    setStep("enabling-loading");
    setStatusMsg("");
    try {
      const data = await enable2FA();
      setQrData(data);
      setStep("enabling-scan");
    } catch (err) {
      setStatusMsg(readError(err));
      setStep("error");
    }
  };

  const handleConfirmEnable = async (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    setBusy(true);
    try {
      await confirm2FA(code);
      setTotpEnabled(true);
      setStep("success");
      setStatusMsg(t("settings.2fa.enabledSuccess"));
      setCode("");
      setQrData(null);
    } catch (err) {
      setStatusMsg(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmDisable = async (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    setBusy(true);
    try {
      await disable2FA(code);
      setTotpEnabled(false);
      setStep("success");
      setStatusMsg(t("settings.2fa.disabledSuccess"));
      setCode("");
    } catch (err) {
      setStatusMsg(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const resetFlow = () => {
    setStep("idle");
    setCode("");
    setQrData(null);
    setStatusMsg("");
  };

  return (
    <main className="auth-page">
      <header className="public-header auth-header">
        <div className="public-header-inner">
          <span className="brand-text">{t("appTitle")}</span>
          <div className="public-header-actions">
            <Link className="public-link" to={`${prefix}/student/dashboard`}>
              {t("common.back")}
            </Link>
          </div>
        </div>
      </header>

      <section className="auth-content">
        <h1>{t("settings.title")}</h1>

        <article className="auth-card">
          <h2 className="settings-section-title">{t("settings.2fa.title")}</h2>
          <p className="muted">{t("settings.2fa.description")}</p>

          {totpEnabled === null && (
            <p className="muted">{t("common.loading")}</p>
          )}

          {totpEnabled !== null && step === "idle" && (
            <div className="settings-2fa-status">
              <span className={`status-badge ${totpEnabled ? "status-badge-on" : "status-badge-off"}`}>
                {totpEnabled ? t("settings.2fa.statusEnabled") : t("settings.2fa.statusDisabled")}
              </span>
              {totpEnabled ? (
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => { setStep("disabling-confirm"); setStatusMsg(""); }}
                >
                  {t("settings.2fa.disableBtn")}
                </button>
              ) : (
                <button type="button" onClick={handleEnable}>
                  {t("settings.2fa.enableBtn")}
                </button>
              )}
            </div>
          )}

          {step === "enabling-loading" && (
            <p className="muted">{t("common.loading")}</p>
          )}

          {step === "enabling-scan" && qrData && (
            <div className="twofa-setup">
              <p>{t("settings.2fa.scanInstruction")}</p>
              <img
                src={`data:image/png;base64,${qrData.qr_code_base64}`}
                alt="2FA QR Code"
                className="qr-code-img"
              />
              <p className="muted">{t("settings.2fa.manualEntry")}</p>
              <code className="totp-secret">{qrData.secret}</code>
              <button type="button" onClick={() => setStep("enabling-confirm")}>
                {t("settings.2fa.nextBtn")}
              </button>
            </div>
          )}

          {step === "enabling-confirm" && (
            <form className="stack-form" onSubmit={(e) => void handleConfirmEnable(e)}>
              <p>{t("settings.2fa.enterCodeInstruction")}</p>
              <label>
                {t("settings.2fa.codeLabel")}
                <div className="auth-input-wrap">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    required
                    autoComplete="one-time-code"
                  />
                </div>
              </label>
              <button type="submit" disabled={busy || code.length !== 6}>
                {busy ? t("common.pleaseWait") : t("settings.2fa.confirmBtn")}
              </button>
              <button type="button" className="link-button" onClick={resetFlow}>
                {t("common.cancel")}
              </button>
            </form>
          )}

          {step === "disabling-confirm" && (
            <form className="stack-form" onSubmit={(e) => void handleConfirmDisable(e)}>
              <p>{t("settings.2fa.disableInstruction")}</p>
              <label>
                {t("settings.2fa.codeLabel")}
                <div className="auth-input-wrap">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    required
                    autoComplete="one-time-code"
                  />
                </div>
              </label>
              <button type="submit" disabled={busy || code.length !== 6} className="btn-danger">
                {busy ? t("common.pleaseWait") : t("settings.2fa.confirmDisableBtn")}
              </button>
              <button type="button" className="link-button" onClick={resetFlow}>
                {t("common.cancel")}
              </button>
            </form>
          )}

          {step === "success" && (
            <div>
              <p className="status-line status-success">{statusMsg}</p>
              <button type="button" onClick={resetFlow}>
                {t("common.back")}
              </button>
            </div>
          )}

          {step === "error" && (
            <div>
              <p className="status-line">{statusMsg}</p>
              <button type="button" onClick={resetFlow}>
                {t("common.back")}
              </button>
            </div>
          )}

          {statusMsg && step !== "success" && step !== "error" && (
            <p className="status-line">{statusMsg}</p>
          )}
        </article>
      </section>
    </main>
  );
}
