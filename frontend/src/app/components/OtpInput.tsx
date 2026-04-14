import { useRef } from "react";

export type OtpStatus = "idle" | "pending" | "success" | "error";

export function OtpInput({
  value,
  onChange,
  status = "idle",
  autoFocus = false,
}: {
  value: string;
  onChange: (val: string) => void;
  status?: OtpStatus;
  autoFocus?: boolean;
}) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  const focusBox = (i: number) => inputs.current[i]?.focus();

  const handleChange = (i: number, raw: string) => {
    const d = raw.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = d;
    onChange(next.join(""));
    if (d && i < 5) focusBox(i + 1);
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!digits[i] && i > 0) {
        const next = [...digits];
        next[i - 1] = "";
        onChange(next.join(""));
        focusBox(i - 1);
        e.preventDefault();
      }
    } else if (e.key === "ArrowLeft" && i > 0) {
      focusBox(i - 1);
    } else if (e.key === "ArrowRight" && i < 5) {
      focusBox(i + 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) {
      onChange(pasted);
      focusBox(Math.min(pasted.length, 5));
      e.preventDefault();
    }
  };

  const boxClass = (d: string) => {
    let cls = "otp-box";
    if (status === "success") cls += " otp-box-success";
    else if (status === "error") cls += " otp-box-error";
    else if (status === "pending") cls += " otp-box-pending";
    else if (d) cls += " otp-box-filled";
    return cls;
  };

  return (
    <div className="otp-input-wrapper">
      <div className="otp-boxes">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => { inputs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            className={boxClass(d)}
            autoFocus={autoFocus && i === 0}
            autoComplete={i === 0 ? "one-time-code" : "off"}
            aria-label={`Digit ${i + 1} of 6`}
            disabled={status === "pending" || status === "success"}
          />
        ))}
        {status === "success" && (
          <span className="otp-status-icon" aria-label="Correct">
            <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true">
              <circle cx="12" cy="12" r="11" fill="#22c55e" />
              <path d="M7 12.5l3.5 3.5 6.5-7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </span>
        )}
        {status === "error" && (
          <span className="otp-status-icon" aria-label="Incorrect">
            <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true">
              <circle cx="12" cy="12" r="11" fill="#ef4444" />
              <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            </svg>
          </span>
        )}
      </div>
    </div>
  );
}
