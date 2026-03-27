import { useEffect, useMemo, useState } from "react";

const READING_MODE_KEY = "learnable_reading_mode";
const FOCUS_MODE_KEY = "learnable_focus_mode";

function usePersistedToggle(key: string): [boolean, (next: boolean) => void] {
  const initial = useMemo(() => localStorage.getItem(key) === "1", [key]);
  const [value, setValue] = useState(initial);

  useEffect(() => {
    localStorage.setItem(key, value ? "1" : "0");
  }, [key, value]);

  return [value, setValue];
}

function useFocusTimer() {
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev: number) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (secondsLeft === 0) {
      setRunning(false);
    }
  }, [secondsLeft]);

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const seconds = String(secondsLeft % 60).padStart(2, "0");

  return {
    label: `${minutes}:${seconds}`,
    running,
    setRunning,
    reset: () => {
      setSecondsLeft(25 * 60);
      setRunning(false);
    },
  };
}

export function AccessibilityPanel() {
  const [readingMode, setReadingMode] = usePersistedToggle(READING_MODE_KEY);
  const [focusMode, setFocusMode] = usePersistedToggle(FOCUS_MODE_KEY);
  const timer = useFocusTimer();

  useEffect(() => {
    document.documentElement.dataset.readingMode = readingMode ? "dyslexia" : "default";
  }, [readingMode]);

  useEffect(() => {
    document.documentElement.dataset.focusMode = focusMode ? "on" : "off";
  }, [focusMode]);

  return (
    <section className="card accessibility-panel">
      <h3>Accessibility</h3>
      <div className="switch-row">
        <label>
          <input
            type="checkbox"
            checked={readingMode}
            onChange={(event) => setReadingMode(event.target.checked)}
          />
          Dyslexia Smart Reading Mode
        </label>
      </div>
      <div className="switch-row">
        <label>
          <input
            type="checkbox"
            checked={focusMode}
            onChange={(event) => setFocusMode(event.target.checked)}
          />
          Focus Mode + Pomodoro
        </label>
      </div>

      {focusMode ? (
        <div className="focus-timer" role="timer" aria-live="polite">
          <strong>{timer.label}</strong>
          <div className="timer-actions">
            <button type="button" onClick={() => timer.setRunning(!timer.running)}>
              {timer.running ? "Pause" : "Start"}
            </button>
            <button type="button" onClick={timer.reset}>
              Reset
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
