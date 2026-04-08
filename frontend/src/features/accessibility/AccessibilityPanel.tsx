import { useTranslation } from "react-i18next";

import { FocusTimerCard } from "./FocusTimerCard";
import { useAccessibility } from "./AccessibilityContext";

export function AccessibilityPanel() {
  const { t } = useTranslation();
  const { settings, setDyslexiaMode, setFocusMode } = useAccessibility();

  return (
    <section className="card accessibility-panel">
      <h3>{t("a11y.panel.title")}</h3>
      <p className="muted">{t("a11y.panel.description")}</p>
      <div className="switch-row">
        <label>
          <input
            type="checkbox"
            checked={settings.dyslexiaMode}
            onChange={(event) => setDyslexiaMode(event.target.checked)}
          />
          {t("a11y.panel.dyslexiaMode")}
        </label>
      </div>
      <div className="switch-row">
        <label>
          <input
            type="checkbox"
            checked={settings.focusMode}
            onChange={(event) => setFocusMode(event.target.checked)}
          />
          {t("a11y.panel.focusMode")}
        </label>
      </div>
      <p className="muted">
        {t("a11y.panel.activeTheme", {
          mode: settings.readingMode,
          font: settings.fontFamily,
          contrast: settings.contrastLevel,
        })}
      </p>

      {settings.focusMode ? <FocusTimerCard /> : null}
    </section>
  );
}
