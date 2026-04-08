import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAccessibility } from "../../features/accessibility/AccessibilityContext";
import { SettingsPanel } from "../../features/accessibility/SettingsPanel";

export function AccessibilityToolbar() {
  const { t } = useTranslation();
  const { settings, setDyslexiaMode, setReadingMode, setFontSize } = useAccessibility();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <section className="a11y-toolbar" aria-label={t("a11y.toolbar.label")}>
        <button
          type="button"
          className={settings.dyslexiaMode ? "active" : ""}
          onClick={() => setDyslexiaMode(!settings.dyslexiaMode)}
          title={t("a11y.toolbar.toggleDyslexia")}
        >
          Aa
        </button>

        <span className="toolbar-divider" />

        <button
          type="button"
          className={settings.readingMode === "light" ? "active" : ""}
          onClick={() => setReadingMode("light")}
          title={t("a11y.readingMode.light")}
        >
          {t("a11y.readingMode.light")}
        </button>
        <button
          type="button"
          className={settings.readingMode === "dark" ? "active" : ""}
          onClick={() => setReadingMode("dark")}
          title={t("a11y.readingMode.dark")}
        >
          {t("a11y.readingMode.dark")}
        </button>
        <button
          type="button"
          className={settings.readingMode === "sepia" ? "active" : ""}
          onClick={() => setReadingMode("sepia")}
          title={t("a11y.readingMode.sepia")}
        >
          {t("a11y.readingMode.sepia")}
        </button>

        <span className="toolbar-divider" />

        <button type="button" onClick={() => setFontSize(settings.fontSize - 2)} title={t("a11y.toolbar.decreaseFont")}>
          A-
        </button>
        <span className="toolbar-font-size">{settings.fontSize}px</span>
        <button type="button" onClick={() => setFontSize(settings.fontSize + 2)} title={t("a11y.toolbar.increaseFont")}>
          A+
        </button>

        <span className="toolbar-divider" />

        <button type="button" onClick={() => setShowSettings(true)} title={t("a11y.toolbar.moreSettings")}>
          {t("a11y.toolbar.settings")}
        </button>
      </section>

      <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
}
