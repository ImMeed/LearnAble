import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

export type ReadingMode = "light" | "dark" | "sepia";
export type ContrastLevel = "normal" | "high";
export type FontFamily = "Lexend" | "Inter" | "OpenDyslexic";
export type TextAlignment = "left" | "center" | "justify";
export type ContentWidth = "narrow" | "medium" | "wide";

export type AccessibilitySettings = {
  dyslexiaMode: boolean;
  textAlignment: TextAlignment;
  highlightLine: boolean;
  wordHighlighting: boolean;
  focusMode: boolean;
  distractionFreeUI: boolean;
  contentChunking: boolean;
  autoScrollLock: boolean;
  focusReminders: boolean;
  readingMode: ReadingMode;
  contrastLevel: ContrastLevel;
  fontFamily: FontFamily;
  fontSize: number;
  letterSpacing: number;
  lineSpacing: number;
  zoomLevel: number;
  contentWidth: ContentWidth;
  readingColumnMode: boolean;
  fullscreenMode: boolean;
  workDuration: number;
  breakDuration: number;
  longBreakDuration: number;
  soundAlerts: boolean;
  autoStartNextSession: boolean;
  xpSystem: boolean;
  badges: boolean;
  streakTracking: boolean;
  progressFeedback: boolean;
  breakAlerts: boolean;
  teacherMessages: boolean;
  psychologistAlerts: boolean;
};

type AccessibilityContextValue = {
  settings: AccessibilitySettings;
  updateSettings: (next: Partial<AccessibilitySettings>) => void;
  resetToDefaults: () => void;
  setDyslexiaMode: (enabled: boolean) => void;
  setFocusMode: (enabled: boolean) => void;
  setReadingMode: (mode: ReadingMode) => void;
  setFontSize: (size: number) => void;
};

const STORAGE_KEY = "learnable_accessibility_settings";

const DEFAULT_SETTINGS: AccessibilitySettings = {
  dyslexiaMode: false,
  textAlignment: "left",
  highlightLine: false,
  wordHighlighting: false,
  focusMode: false,
  distractionFreeUI: false,
  contentChunking: false,
  autoScrollLock: false,
  focusReminders: true,
  readingMode: "light",
  contrastLevel: "normal",
  fontFamily: "Lexend",
  fontSize: 16,
  letterSpacing: 0,
  lineSpacing: 1.6,
  zoomLevel: 100,
  contentWidth: "medium",
  readingColumnMode: false,
  fullscreenMode: false,
  workDuration: 25,
  breakDuration: 5,
  longBreakDuration: 15,
  soundAlerts: true,
  autoStartNextSession: false,
  xpSystem: true,
  badges: true,
  streakTracking: true,
  progressFeedback: true,
  breakAlerts: true,
  teacherMessages: true,
  psychologistAlerts: true,
};

const AccessibilityContext = createContext<AccessibilityContextValue | undefined>(undefined);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  return fallback;
}

function asReadingMode(value: unknown, fallback: ReadingMode): ReadingMode {
  return value === "light" || value === "dark" || value === "sepia" ? value : fallback;
}

function asContrastLevel(value: unknown, fallback: ContrastLevel): ContrastLevel {
  return value === "normal" || value === "high" ? value : fallback;
}

function asFontFamily(value: unknown, fallback: FontFamily): FontFamily {
  return value === "Lexend" || value === "Inter" || value === "OpenDyslexic" ? value : fallback;
}

function asTextAlignment(value: unknown, fallback: TextAlignment): TextAlignment {
  return value === "left" || value === "center" || value === "justify" ? value : fallback;
}

function asContentWidth(value: unknown, fallback: ContentWidth): ContentWidth {
  return value === "narrow" || value === "medium" || value === "wide" ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getFontStack(fontFamily: FontFamily): string {
  if (fontFamily === "OpenDyslexic") {
    return '"OpenDyslexic", "Lexend", "Noto Kufi Arabic", "Tajawal", sans-serif';
  }

  if (fontFamily === "Inter") {
    return '"Inter", "Lexend", "Noto Kufi Arabic", "Tajawal", sans-serif';
  }

  return '"Lexend", "Noto Kufi Arabic", "Tajawal", sans-serif';
}

function normalizeSettings(payload: Partial<AccessibilitySettings>): AccessibilitySettings {
  const merged = { ...DEFAULT_SETTINGS, ...payload };

  const readingMode = asReadingMode(merged.readingMode, DEFAULT_SETTINGS.readingMode);
  const contrastLevel = asContrastLevel(merged.contrastLevel, DEFAULT_SETTINGS.contrastLevel);
  const fontFamily = asFontFamily(merged.fontFamily, DEFAULT_SETTINGS.fontFamily);
  const textAlignment = asTextAlignment(merged.textAlignment, DEFAULT_SETTINGS.textAlignment);
  const contentWidth = asContentWidth(merged.contentWidth, DEFAULT_SETTINGS.contentWidth);

  return {
    ...merged,
    dyslexiaMode: asBoolean(merged.dyslexiaMode, DEFAULT_SETTINGS.dyslexiaMode),
    textAlignment,
    highlightLine: asBoolean(merged.highlightLine, DEFAULT_SETTINGS.highlightLine),
    wordHighlighting: asBoolean(merged.wordHighlighting, DEFAULT_SETTINGS.wordHighlighting),
    focusMode: asBoolean(merged.focusMode, DEFAULT_SETTINGS.focusMode),
    distractionFreeUI: asBoolean(merged.distractionFreeUI, DEFAULT_SETTINGS.distractionFreeUI),
    contentChunking: asBoolean(merged.contentChunking, DEFAULT_SETTINGS.contentChunking),
    autoScrollLock: asBoolean(merged.autoScrollLock, DEFAULT_SETTINGS.autoScrollLock),
    focusReminders: asBoolean(merged.focusReminders, DEFAULT_SETTINGS.focusReminders),
    readingMode,
    contrastLevel,
    fontFamily,
    fontSize: clamp(asNumber(merged.fontSize, DEFAULT_SETTINGS.fontSize), 12, 24),
    letterSpacing: clamp(asNumber(merged.letterSpacing, DEFAULT_SETTINGS.letterSpacing), 0, 0.2),
    lineSpacing: clamp(asNumber(merged.lineSpacing, DEFAULT_SETTINGS.lineSpacing), 1.4, 2.2),
    zoomLevel: clamp(asNumber(merged.zoomLevel, DEFAULT_SETTINGS.zoomLevel), 80, 150),
    contentWidth,
    readingColumnMode: asBoolean(merged.readingColumnMode, DEFAULT_SETTINGS.readingColumnMode),
    fullscreenMode: asBoolean(merged.fullscreenMode, DEFAULT_SETTINGS.fullscreenMode),
    workDuration: clamp(asNumber(merged.workDuration, DEFAULT_SETTINGS.workDuration), 5, 90),
    breakDuration: clamp(asNumber(merged.breakDuration, DEFAULT_SETTINGS.breakDuration), 3, 30),
    longBreakDuration: clamp(
      asNumber(merged.longBreakDuration, DEFAULT_SETTINGS.longBreakDuration),
      5,
      60,
    ),
    soundAlerts: asBoolean(merged.soundAlerts, DEFAULT_SETTINGS.soundAlerts),
    autoStartNextSession: asBoolean(
      merged.autoStartNextSession,
      DEFAULT_SETTINGS.autoStartNextSession,
    ),
    xpSystem: asBoolean(merged.xpSystem, DEFAULT_SETTINGS.xpSystem),
    badges: asBoolean(merged.badges, DEFAULT_SETTINGS.badges),
    streakTracking: asBoolean(merged.streakTracking, DEFAULT_SETTINGS.streakTracking),
    progressFeedback: asBoolean(merged.progressFeedback, DEFAULT_SETTINGS.progressFeedback),
    breakAlerts: asBoolean(merged.breakAlerts, DEFAULT_SETTINGS.breakAlerts),
    teacherMessages: asBoolean(merged.teacherMessages, DEFAULT_SETTINGS.teacherMessages),
    psychologistAlerts: asBoolean(merged.psychologistAlerts, DEFAULT_SETTINGS.psychologistAlerts),
  };
}

function readStoredSettings(): AccessibilitySettings {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return DEFAULT_SETTINGS;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AccessibilitySettings>;
    return normalizeSettings(parsed);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return DEFAULT_SETTINGS;
  }
}

function applyDocumentState(settings: AccessibilitySettings): void {
  const root = document.documentElement;

  root.classList.toggle("dark", settings.readingMode === "dark");
  root.classList.toggle("sepia", settings.readingMode === "sepia");
  root.classList.toggle("high-contrast", settings.contrastLevel === "high");
  root.classList.toggle("dyslexia-mode", settings.dyslexiaMode);

  root.dataset.readingMode = settings.readingMode;
  root.dataset.focusMode = settings.focusMode ? "on" : "off";
  root.dataset.contentWidth = settings.contentWidth;
  root.dataset.readingColumnMode = settings.readingColumnMode ? "on" : "off";
  root.dataset.distractionFree = settings.distractionFreeUI ? "on" : "off";
  root.dataset.fullscreenMode = settings.fullscreenMode ? "on" : "off";

  root.style.setProperty("--font-family", getFontStack(settings.fontFamily));
  root.style.setProperty("--font-size", `${settings.fontSize}px`);
  root.style.setProperty("--letter-spacing", `${settings.letterSpacing}em`);
  root.style.setProperty("--line-height", String(settings.lineSpacing));
  root.style.setProperty("--zoom-level", `${settings.zoomLevel}%`);
  root.style.setProperty("--text-align", settings.textAlignment);
}

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => readStoredSettings());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    applyDocumentState(settings);
  }, [settings]);

  const value = useMemo<AccessibilityContextValue>(() => {
    const updateSettings = (next: Partial<AccessibilitySettings>) => {
      setSettings((prev) => normalizeSettings({ ...prev, ...next }));
    };

    return {
      settings,
      updateSettings,
      resetToDefaults: () => setSettings(DEFAULT_SETTINGS),
      setDyslexiaMode: (enabled: boolean) => {
        setSettings((prev) =>
          normalizeSettings({
            ...prev,
            dyslexiaMode: enabled,
            letterSpacing: enabled ? Math.max(prev.letterSpacing, 0.12) : prev.letterSpacing,
            lineSpacing: enabled ? Math.max(prev.lineSpacing, 1.8) : prev.lineSpacing,
          }),
        );
      },
      setFocusMode: (enabled: boolean) => {
        setSettings((prev) =>
          normalizeSettings({
            ...prev,
            focusMode: enabled,
            distractionFreeUI: enabled ? true : prev.distractionFreeUI,
            contentChunking: enabled ? true : prev.contentChunking,
          }),
        );
      },
      setReadingMode: (mode: ReadingMode) => {
        setSettings((prev) => normalizeSettings({ ...prev, readingMode: mode }));
      },
      setFontSize: (size: number) => {
        setSettings((prev) => normalizeSettings({ ...prev, fontSize: clamp(size, 12, 24) }));
      },
    };
  }, [settings]);

  return <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>;
}

export function useAccessibility(): AccessibilityContextValue {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error("useAccessibility must be used within AccessibilityProvider");
  }
  return context;
}
