import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, Moon, Settings, Sun, Type} from "lucide-react";

import { useAccessibility } from "../../features/accessibility/AccessibilityContext";
import { SettingsPanel } from "../../features/accessibility/SettingsPanel";
import { cx } from "./uiStyles";

function toolbarButtonClass(active = false) {
  return cx(
    "inline-flex !h-[40px] !w-[40px] items-center justify-center !rounded-full !border !p-0 text-[14px] transition duration-200 ease-out",
    active
      ? "!border-primary !bg-primary !text-primary-foreground shadow-[0_10px_24px_rgba(74,144,226,0.22)]"
      : "!border-transparent !bg-transparent !text-muted-foreground hover:!border-border hover:!bg-background hover:!text-foreground",
  );
}

export function AccessibilityToolbar() {
  const { t } = useTranslation();
  const { settings, setDyslexiaMode, setReadingMode, setFontSize } = useAccessibility();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <section
        className="flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-[1.25rem] border border-border bg-card px-2 py-2 shadow-[var(--shadow-soft)] sm:flex-nowrap sm:justify-start"
        aria-label={t("a11y.toolbar.label")}
      >
        <button
          type="button"
          className={toolbarButtonClass(settings.dyslexiaMode)}
          onClick={() => setDyslexiaMode(!settings.dyslexiaMode)}
          aria-label={t("a11y.toolbar.toggleDyslexia")}
          aria-pressed={settings.dyslexiaMode}
          title={t("a11y.toolbar.toggleDyslexia")}
        >
          <BookOpen aria-hidden="true" />
        </button>

        <span className="hidden h-5 w-px bg-border sm:block" />

        <button
          type="button"
          className={toolbarButtonClass(settings.readingMode === "light")}
          onClick={() => setReadingMode("light")}
          aria-label={t("a11y.readingMode.light")}
          aria-pressed={settings.readingMode === "light"}
          title={t("a11y.readingMode.light")}
        >
          <Sun aria-hidden="true" />
        </button>
        <button
          type="button"
          className={toolbarButtonClass(settings.readingMode === "dark")}
          onClick={() => setReadingMode("dark")}
          aria-label={t("a11y.readingMode.dark")}
          aria-pressed={settings.readingMode === "dark"}
          title={t("a11y.readingMode.dark")}
        >
          <Moon aria-hidden="true" />
        </button>
        <button
          type="button"
          className={toolbarButtonClass(settings.readingMode === "sepia")}
          onClick={() => setReadingMode("sepia")}
          aria-label={t("a11y.readingMode.sepia")}
          aria-pressed={settings.readingMode === "sepia"}
          title={t("a11y.readingMode.sepia")}
        >
          <Type aria-hidden="true" />
        </button>

        <span className="hidden h-5 w-px bg-border sm:block" />

        <button
          type="button"
          className={toolbarButtonClass()}
          onClick={() => setFontSize(settings.fontSize - 2)}
          aria-label={t("a11y.toolbar.decreaseFont")}
          title={t("a11y.toolbar.decreaseFont")}
        >
          <span aria-hidden="true" className="text-[14px] font-semibold tracking-[-0.02em]">
            A-
          </span>
        </button>
        <span className="min-w-[58px] rounded-full bg-background px-3 py-2 text-center text-[14px] font-medium leading-none text-muted-foreground">
          {settings.fontSize}px
        </span>
        <button
          type="button"
          className={toolbarButtonClass()}
          onClick={() => setFontSize(settings.fontSize + 2)}
          aria-label={t("a11y.toolbar.increaseFont")}
          title={t("a11y.toolbar.increaseFont")}
        >
          <span aria-hidden="true" className="text-[14px] font-semibold tracking-[-0.02em]">
            A+
          </span>
        </button>

        <span className="hidden h-5 w-px bg-border sm:block" />

        <button
          type="button"
          className={toolbarButtonClass()}
          onClick={() => setShowSettings(true)}
          aria-label={t("a11y.toolbar.moreSettings")}
          title={t("a11y.toolbar.moreSettings")}
        >
          <Settings aria-hidden="true" />
        </button>
      </section>

      <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
}
