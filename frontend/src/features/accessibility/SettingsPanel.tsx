import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Bell, BookOpen, Crosshair, Palette, Settings, Timer, X, type LucideIcon } from "lucide-react";

import { useAccessibility } from "./AccessibilityContext";

type SettingsPanelProps = {
  isOpen: boolean;
  onClose: () => void;
};

type SettingsSectionId = "reading" | "focus" | "timer" | "theme" | "notifications";

type ToggleRowProps = {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

function ToggleRow({ label, hint, checked, onChange }: ToggleRowProps) {
  return (
    <label className="settings-switch-row">
      <span className="settings-switch-copy">
        <strong>{label}</strong>
        {hint ? <small>{hint}</small> : null}
      </span>
      <input
        type="checkbox"
        className="settings-switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { t } = useTranslation();
  const { settings, updateSettings, resetToDefaults } = useAccessibility();
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("reading");

  const navItems: Array<{ id: SettingsSectionId; label: string; Icon: LucideIcon }> = [
    { id: "reading", label: t("a11y.settings.nav.reading"), Icon: BookOpen },
    { id: "focus", label: t("a11y.settings.nav.focus"), Icon: Crosshair },
    { id: "timer", label: t("a11y.settings.nav.timer"), Icon: Timer },
    { id: "theme", label: t("a11y.settings.nav.theme"), Icon: Palette },
    { id: "notifications", label: t("a11y.settings.nav.notifications"), Icon: Bell },
  ];

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <>
      <button type="button" className="settings-backdrop" aria-label={t("a11y.settings.close")} onClick={onClose} />
      <aside className="settings-panel" role="dialog" aria-modal="true" aria-label={t("a11y.settings.title")}>
        <header className="settings-panel-header">
          <div className="settings-panel-title-wrap">
            <span className="settings-panel-title-icon" aria-hidden="true">
              <Settings size={22} />
            </span>
            <h3>{t("a11y.settings.title")}</h3>
          </div>
          <button
            type="button"
            className="settings-close-button"
            onClick={onClose}
            aria-label={t("a11y.settings.close")}
            title={t("a11y.settings.close")}
          >
            <X size={24} aria-hidden="true" />
          </button>
        </header>

        <div className="settings-panel-body">
          <nav className="settings-panel-nav" aria-label={t("a11y.settings.navLabel")}>
            {navItems.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                className={id === activeSection ? "settings-nav-item active" : "settings-nav-item"}
                onClick={() => setActiveSection(id)}
              >
                <Icon size={20} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          <section className="settings-panel-content">
            {activeSection === "reading" ? (
              <div className="settings-pane-stack">
                <h4 className="settings-pane-title">{t("a11y.settings.sections.reading")}</h4>

                <div className="settings-pane-card">
                  <ToggleRow
                    label={t("a11y.settings.dyslexiaMode")}
                    hint={t("a11y.settings.dyslexiaHint")}
                    checked={settings.dyslexiaMode}
                    onChange={(checked) => updateSettings({ dyslexiaMode: checked })}
                  />
                </div>

                <div className="settings-pane-grid">
                  <label className="settings-field">
                    <span>{t("a11y.settings.fontFamily")}</span>
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

                  <label className="settings-field settings-field--full">
                    <span>{t("a11y.settings.fontSize", { value: settings.fontSize })}</span>
                    <input
                      type="range"
                      min={12}
                      max={24}
                      value={settings.fontSize}
                      onChange={(event) => updateSettings({ fontSize: Number(event.target.value) })}
                    />
                  </label>

                  <label className="settings-field settings-field--full">
                    <span>{t("a11y.settings.letterSpacing", { value: settings.letterSpacing.toFixed(2) })}</span>
                    <input
                      type="range"
                      min={0}
                      max={0.2}
                      step={0.01}
                      value={settings.letterSpacing}
                      onChange={(event) => updateSettings({ letterSpacing: Number(event.target.value) })}
                    />
                  </label>

                  <label className="settings-field settings-field--full">
                    <span>{t("a11y.settings.lineSpacing", { value: settings.lineSpacing.toFixed(1) })}</span>
                    <input
                      type="range"
                      min={1.4}
                      max={2.2}
                      step={0.1}
                      value={settings.lineSpacing}
                      onChange={(event) => updateSettings({ lineSpacing: Number(event.target.value) })}
                    />
                  </label>
                </div>
              </div>
            ) : null}

            {activeSection === "focus" ? (
              <div className="settings-pane-stack">
                <h4 className="settings-pane-title">{t("a11y.settings.sections.focus")}</h4>
                <div className="settings-pane-card">
                  <ToggleRow
                    label={t("a11y.panel.focusMode")}
                    checked={settings.focusMode}
                    onChange={(checked) => updateSettings({ focusMode: checked })}
                  />
                  <ToggleRow
                    label={t("a11y.settings.distractionFreeUI")}
                    checked={settings.distractionFreeUI}
                    onChange={(checked) => updateSettings({ distractionFreeUI: checked })}
                  />
                  <ToggleRow
                    label={t("a11y.settings.contentChunking")}
                    checked={settings.contentChunking}
                    onChange={(checked) => updateSettings({ contentChunking: checked })}
                  />
                  <ToggleRow
                    label={t("a11y.settings.autoScrollLock")}
                    checked={settings.autoScrollLock}
                    onChange={(checked) => updateSettings({ autoScrollLock: checked })}
                  />
                  <ToggleRow
                    label={t("a11y.settings.focusReminders")}
                    checked={settings.focusReminders}
                    onChange={(checked) => updateSettings({ focusReminders: checked })}
                  />
                </div>
              </div>
            ) : null}

            {activeSection === "timer" ? (
              <div className="settings-pane-stack">
                <h4 className="settings-pane-title">{t("a11y.settings.sections.timer")}</h4>
                <div className="settings-pane-grid">
                  <label className="settings-field">
                    <span>{t("a11y.settings.workMinutes")}</span>
                    <input
                      type="number"
                      min={5}
                      max={90}
                      value={settings.workDuration}
                      onChange={(event) => updateSettings({ workDuration: Number(event.target.value) })}
                    />
                  </label>

                  <label className="settings-field">
                    <span>{t("a11y.settings.breakMinutes")}</span>
                    <input
                      type="number"
                      min={3}
                      max={30}
                      value={settings.breakDuration}
                      onChange={(event) => updateSettings({ breakDuration: Number(event.target.value) })}
                    />
                  </label>

                  <label className="settings-field settings-field--full">
                    <span>{t("a11y.settings.longBreakMinutes")}</span>
                    <input
                      type="number"
                      min={5}
                      max={60}
                      value={settings.longBreakDuration}
                      onChange={(event) => updateSettings({ longBreakDuration: Number(event.target.value) })}
                    />
                  </label>
                </div>

                <div className="settings-pane-card">
                  <ToggleRow
                    label={t("a11y.settings.autoStart")}
                    checked={settings.autoStartNextSession}
                    onChange={(checked) => updateSettings({ autoStartNextSession: checked })}
                  />
                </div>
              </div>
            ) : null}

            {activeSection === "theme" ? (
              <div className="settings-pane-stack">
                <h4 className="settings-pane-title">{t("a11y.settings.sections.theme")}</h4>

                <div className="settings-pane-grid">
                  <label className="settings-field">
                    <span>{t("a11y.settings.readingMode")}</span>
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

                  <label className="settings-field">
                    <span>{t("a11y.settings.contrast")}</span>
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

                  <label className="settings-field settings-field--full">
                    <span>{t("a11y.settings.zoom", { value: settings.zoomLevel })}</span>
                    <input
                      type="range"
                      min={90}
                      max={125}
                      value={settings.zoomLevel}
                      onChange={(event) => updateSettings({ zoomLevel: Number(event.target.value) })}
                    />
                  </label>
                </div>
              </div>
            ) : null}

            {activeSection === "notifications" ? (
              <div className="settings-pane-stack">
                <h4 className="settings-pane-title">{t("a11y.settings.sections.notifications")}</h4>

                <div className="settings-pane-card">
                  <ToggleRow
                    label={t("a11y.settings.soundAlerts")}
                    checked={settings.soundAlerts}
                    onChange={(checked) => updateSettings({ soundAlerts: checked })}
                  />
                  <ToggleRow
                    label={t("a11y.settings.breakAlerts")}
                    checked={settings.breakAlerts}
                    onChange={(checked) => updateSettings({ breakAlerts: checked })}
                  />
                  <ToggleRow
                    label={t("a11y.settings.teacherMessages")}
                    checked={settings.teacherMessages}
                    onChange={(checked) => updateSettings({ teacherMessages: checked })}
                  />
                  <ToggleRow
                    label={t("a11y.settings.psychologistAlerts")}
                    checked={settings.psychologistAlerts}
                    onChange={(checked) => updateSettings({ psychologistAlerts: checked })}
                  />
                  <ToggleRow
                    label={t("a11y.settings.progressFeedback")}
                    checked={settings.progressFeedback}
                    onChange={(checked) => updateSettings({ progressFeedback: checked })}
                  />
                </div>

                <h5 className="settings-subsection-title">{t("a11y.settings.sections.gamification")}</h5>
                <div className="settings-pane-card">
                  <ToggleRow
                    label={t("a11y.settings.xpSystem")}
                    checked={settings.xpSystem}
                    onChange={(checked) => updateSettings({ xpSystem: checked })}
                  />
                  <ToggleRow
                    label={t("a11y.settings.badges")}
                    checked={settings.badges}
                    onChange={(checked) => updateSettings({ badges: checked })}
                  />
                  <ToggleRow
                    label={t("a11y.settings.streakTracking")}
                    checked={settings.streakTracking}
                    onChange={(checked) => updateSettings({ streakTracking: checked })}
                  />
                </div>
              </div>
            ) : null}
          </section>
        </div>

        <footer className="settings-panel-footer">
          <button type="button" className="secondary" onClick={resetToDefaults}>
            {t("a11y.settings.reset")}
          </button>
          <button type="button" onClick={onClose}>
            {t("a11y.settings.saveAndClose")}
          </button>
        </footer>
      </aside>
    </>,
    document.body,
  );
}
