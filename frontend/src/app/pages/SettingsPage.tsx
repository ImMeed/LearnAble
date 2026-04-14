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
import { OtpInput, type OtpStatus } from "../components/OtpInput";
import { getSession } from "../../state/auth";

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
    if (typeof payload === "object" && payload && "detail" in payload) {
      const detail = (payload as { detail?: unknown }).detail;
      if (typeof detail === "object" && detail && "message" in detail) {
        return String((detail as { message?: unknown }).message);
      }
      if (typeof detail === "string") return detail;
    }
    if (typeof payload === "object" && payload && "message" in payload) {
      return String((payload as { message: unknown }).message);
    }
  }
  return String(error);
}

function dashboardFromRole(role: string | undefined): string {
  switch (role) {
    case "ROLE_TUTOR": return "/teacher/dashboard";
    case "ROLE_PARENT": return "/parent/dashboard";
    case "ROLE_PSYCHOLOGIST": return "/psychologist/dashboard";
    case "ROLE_ADMIN": return "/admin/dashboard";
    default: return "/student/dashboard";
  }
}

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const prefix = i18n.resolvedLanguage === "en" ? "/en" : "/ar";
  const session = getSession();
  const backPath = `${prefix}${dashboardFromRole(session?.role)}`;

  const [totpEnabled, setTotpEnabled] = useState<boolean | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [qrData, setQrData] = useState<Enable2FAResponse | null>(null);
  const [code, setCode] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [otpStatus, setOtpStatus] = useState<OtpStatus>("idle");

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

  const doConfirmEnable = async () => {
    if (code.length !== 6 || otpStatus === "pending" || otpStatus === "success") return;
    setOtpStatus("pending");
    setBusy(true);
    try {
      await confirm2FA(code);
      setOtpStatus("success");
      setTotpEnabled(true);
      setStatusMsg(t("settings.2fa.enabledSuccess"));
      setCode("");
      setQrData(null);
      setTimeout(() => setStep("success"), 800);
    } catch (err) {
      setOtpStatus("error");
      setStatusMsg(readError(err));
      setTimeout(() => { setCode(""); setOtpStatus("idle"); }, 1800);
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmEnable = (e: FormEvent) => {
    e.preventDefault();
    void doConfirmEnable();
  };

  const doConfirmDisable = async () => {
    if (code.length !== 6 || otpStatus === "pending" || otpStatus === "success") return;
    setOtpStatus("pending");
    setBusy(true);
    try {
      await disable2FA(code);
      setOtpStatus("success");
      setTotpEnabled(false);
      setStatusMsg(t("settings.2fa.disabledSuccess"));
      setCode("");
      setTimeout(() => setStep("success"), 800);
    } catch (err) {
      setOtpStatus("error");
      setStatusMsg(readError(err));
      setTimeout(() => { setCode(""); setOtpStatus("idle"); }, 1800);
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmDisable = (e: FormEvent) => {
    e.preventDefault();
    void doConfirmDisable();
  };

  const resetFlow = () => {
    setStep("idle");
    setCode("");
    setQrData(null);
    setStatusMsg("");
    setOtpStatus("idle");
  };

  return (
    <main className="auth-page">
      <header className="public-header auth-header">
        <div className="public-header-inner">
          <span className="brand-text">{t("appTitle")}</span>
          <div className="public-header-actions">
            <Link className="public-link" to={backPath}>
              {t("common.back")}
            </Link>
          </div>
        </div>
      </header>

      <section className="auth-content">
        <h1>{t("settings.title")}</h1>

        <article className="auth-card">
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.4rem" }}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary)", flexShrink: 0 }} aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              <circle cx="12" cy="16" r="1" fill="currentColor" stroke="none" />
            </svg>
            <h2 className="settings-section-title" style={{ margin: 0 }}>{t("settings.2fa.title")}</h2>
          </div>
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
            <form className="stack-form" onSubmit={handleConfirmEnable}>
              <p style={{ textAlign: "center" }}>{t("settings.2fa.enterCodeInstruction")}</p>
              <OtpInput
                value={code}
                onChange={(v) => {
                  setCode(v);
                  if (otpStatus === "error") setOtpStatus("idle");
                  if (v.length === 6 && otpStatus === "idle") setTimeout(() => void doConfirmEnable(), 0);
                }}
                status={otpStatus}
                autoFocus
              />
              {statusMsg && otpStatus === "error" && (
                <p className="status-line" style={{ textAlign: "center", marginTop: "0.25rem" }}>{statusMsg}</p>
              )}
              {otpStatus !== "success" && (
                <button type="submit" disabled={busy || code.length !== 6 || otpStatus === "pending"}>
                  {busy ? t("common.pleaseWait") : t("settings.2fa.confirmBtn")}
                </button>
              )}
              <button type="button" className="link-button" onClick={resetFlow}>
                {t("common.cancel")}
              </button>
            </form>
          )}

          {step === "disabling-confirm" && (
            <form className="stack-form" onSubmit={handleConfirmDisable}>
              <p style={{ textAlign: "center" }}>{t("settings.2fa.disableInstruction")}</p>
              <OtpInput
                value={code}
                onChange={(v) => {
                  setCode(v);
                  if (otpStatus === "error") setOtpStatus("idle");
                  if (v.length === 6 && otpStatus === "idle") setTimeout(() => void doConfirmDisable(), 0);
                }}
                status={otpStatus}
                autoFocus
              />
              {statusMsg && otpStatus === "error" && (
                <p className="status-line" style={{ textAlign: "center", marginTop: "0.25rem" }}>{statusMsg}</p>
              )}
              {otpStatus !== "success" && (
                <button type="submit" disabled={busy || code.length !== 6 || otpStatus === "pending"} className="btn-danger">
                  {busy ? t("common.pleaseWait") : t("settings.2fa.confirmDisableBtn")}
                </button>
              )}
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

          {statusMsg && step !== "success" && step !== "error" && otpStatus !== "error" && (
            <p className="status-line">{statusMsg}</p>
          )}
        </article>
      </section>
    </main>
  );
}
