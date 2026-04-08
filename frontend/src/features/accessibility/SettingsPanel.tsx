import { useTranslation } from "react-i18next";

import { useAccessibility } from "./AccessibilityContext";

type SettingsPanelProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { t } = useTranslation();
  const { settings, updateSettings, resetToDefaults } = useAccessibility();

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <button type="button" className="settings-backdrop" aria-label={t("a11y.settings.close")} onClick={onClose} />
      <aside className="settings-panel" role="dialog" aria-modal="true" aria-label={t("a11y.settings.title")}>
        <header className="settings-panel-header">
          <h3>{t("a11y.settings.title")}</h3>
          <button type="button" className="secondary" onClick={onClose}>
            {t("common.close")}
          </button>
        </header>

        <section className="settings-section">
          <h4>{t("a11y.settings.sections.reading")}</h4>
          <label>
            {t("a11y.settings.fontFamily")}
            <select
              value={settings.fontFamily}
              onChange={(event) =>
                updateSettings({
                  fontFamily: event.target.value as "Lexend" | "Inter" | "OpenDyslexic",
                })
              }
            >
              <option value="Lexend">{t("a11y.settings.font.lexend")}</option>
              <option value="Inter">{t("a11y.settings.font.inter")}</option>
              <option value="OpenDyslexic">{t("a11y.settings.font.openDyslexic")}</option>
            </select>
          </label>
          <label>
            {t("a11y.settings.fontSize", { value: settings.fontSize })}
            <input
              type="range"
              min={12}
              max={24}
              value={settings.fontSize}
              onChange={(event) => updateSettings({ fontSize: Number(event.target.value) })}
            />
          </label>
          <label>
            {t("a11y.settings.letterSpacing", { value: settings.letterSpacing.toFixed(2) })}
            <input
              type="range"
              min={0}
              max={0.2}
              step={0.01}
              value={settings.letterSpacing}
              onChange={(event) => updateSettings({ letterSpacing: Number(event.target.value) })}
            />
          </label>
          <label>
            {t("a11y.settings.lineSpacing", { value: settings.lineSpacing.toFixed(1) })}
            <input
              type="range"
              min={1.4}
              max={2}
              step={0.1}
              value={settings.lineSpacing}
              onChange={(event) => updateSettings({ lineSpacing: Number(event.target.value) })}
            />
          </label>
        </section>

        <section className="settings-section">
          <h4>{t("a11y.settings.sections.theme")}</h4>
          <label>
            {t("a11y.settings.readingMode")}
            <select
              value={settings.readingMode}
              onChange={(event) =>
                updateSettings({
                  readingMode: event.target.value as "light" | "dark" | "sepia",
                })
              }
            >
              <option value="light">{t("a11y.readingMode.light")}</option>
              <option value="dark">{t("a11y.readingMode.dark")}</option>
              <option value="sepia">{t("a11y.readingMode.sepia")}</option>
            </select>
          </label>
          <label>
            {t("a11y.settings.contrast")}
            <select
              value={settings.contrastLevel}
              onChange={(event) =>
                updateSettings({ contrastLevel: event.target.value as "normal" | "high" })
              }
            >
              <option value="normal">{t("a11y.settings.contrastNormal")}</option>
              <option value="high">{t("a11y.settings.contrastHigh")}</option>
            </select>
          </label>
          <label>
            {t("a11y.settings.zoom", { value: settings.zoomLevel })}
            <input
              type="range"
              min={90}
              max={125}
              value={settings.zoomLevel}
              onChange={(event) => updateSettings({ zoomLevel: Number(event.target.value) })}
            />
          </label>
        </section>

        <section className="settings-section">
          <h4>{t("a11y.settings.sections.timer")}</h4>
          <label>
            {t("a11y.settings.workMinutes")}
            <input
              type="number"
              min={5}
              max={90}
              value={settings.workDuration}
              onChange={(event) => updateSettings({ workDuration: Number(event.target.value) })}
            />
          </label>
          <label>
            {t("a11y.settings.breakMinutes")}
            <input
              type="number"
              min={3}
              max={30}
              value={settings.breakDuration}
              onChange={(event) => updateSettings({ breakDuration: Number(event.target.value) })}
            />
          </label>
          <label>
            {t("a11y.settings.longBreakMinutes")}
            <input
              type="number"
              min={5}
              max={60}
              value={settings.longBreakDuration}
              onChange={(event) => updateSettings({ longBreakDuration: Number(event.target.value) })}
            />
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={settings.autoStartNextSession}
              onChange={(event) => updateSettings({ autoStartNextSession: event.target.checked })}
            />
            {t("a11y.settings.autoStart")}
          </label>
        </section>

        <section className="settings-section">
          <h4>{t("a11y.settings.sections.gamification")}</h4>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={settings.xpSystem}
              onChange={(event) => updateSettings({ xpSystem: event.target.checked })}
            />
            {t("a11y.settings.xpSystem")}
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={settings.badges}
              onChange={(event) => updateSettings({ badges: event.target.checked })}
            />
            {t("a11y.settings.badges")}
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={settings.streakTracking}
              onChange={(event) => updateSettings({ streakTracking: event.target.checked })}
            />
            {t("a11y.settings.streakTracking")}
          </label>
        </section>

        <footer className="settings-panel-footer">
          <button type="button" className="secondary" onClick={resetToDefaults}>
            {t("a11y.settings.reset")}
          </button>
          <button type="button" onClick={onClose}>
            {t("a11y.settings.saveAndClose")}
          </button>
        </footer>
      </aside>
    </>
  );
}
