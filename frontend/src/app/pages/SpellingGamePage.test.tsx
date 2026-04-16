import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  t: vi.fn((key: string, vars?: Record<string, unknown>) => {
    if (key === "dashboards.spellingGame.resultRewards" && vars) {
      return `+${vars.points} points | +${vars.xp} XP | Wallet ${vars.wallet}`;
    }
    if (key === "dashboards.spellingGame.resultProgression" && vars) {
      return `Level ${vars.level} | Total XP ${vars.totalXp}`;
    }
    if (key === "dashboards.spellingGame.resultBadges" && vars) {
      return `New badges: ${vars.badges}`;
    }
    return key;
  }),
}));

vi.mock("../../api/client", () => ({
  apiClient: {
    post: mocks.post,
  },
}));

vi.mock("../../features/accessibility/AccessibilityContext", () => ({
  useAccessibility: () => ({
    settings: { focusMode: false },
  }),
}));

vi.mock("./roleDashboardShared", () => ({
  DashboardShell: ({ children }: { title: string; children: ReactNode }) => <div>{children}</div>,
  errorMessage: () => "error",
  localePrefix: () => "/en",
  localeRequestConfig: () => ({ headers: { "x-lang": "en" } }),
}));

vi.mock("../components/uiStyles", () => ({
  actionClass: () => "btn",
  cx: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
  surfaceClass: "surface",
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { resolvedLanguage: "en" },
    t: mocks.t,
  }),
}));

import { SpellingGamePageV2 } from "./SpellingGamePage";

describe("SpellingGamePageV2", () => {
  beforeEach(() => {
    mocks.post.mockReset();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).speechSynthesis = {
      cancel: vi.fn(),
      speak: vi.fn(),
    };

    mocks.post.mockImplementation((url: string) => {
      if (url === "/spelling/sessions/start") {
        return Promise.resolve({
          data: {
            session_id: "session-1",
            activity_key: "spell_apple",
            activity_title: "Spell the Word",
            difficulty: "EASY",
            audio_text: "apple",
            word_length: 5,
            hint_first_letter: null,
            status: "IN_PROGRESS",
            attempt_count: 0,
            mistakes_count: 0,
            replay_count: 0,
            typed_playback_count: 0,
            started_at: new Date().toISOString(),
            completed_at: null,
          },
        });
      }

      if (url === "/spelling/sessions/session-1/answer") {
        return Promise.resolve({
          data: {
            session_id: "session-1",
            accepted: true,
            is_exact_match: true,
            is_near_match: false,
            solved: true,
            attempt_count: 1,
            mistakes_count: 0,
            feedback: "Excellent! Correct spelling.",
          },
        });
      }

      if (url === "/spelling/sessions/session-1/complete") {
        return Promise.resolve({
          data: {
            session_id: "session-1",
            solved: true,
            is_near_match: false,
            hint_used: false,
            attempt_count: 1,
            mistakes_count: 0,
            replay_count: 0,
            typed_playback_count: 0,
            earned_points: 10,
            earned_xp: 16,
            wallet_balance: 10,
            progression: {
              total_xp: 16,
              current_level: 1,
              next_level_xp: 100,
              leveled_up: false,
              new_badges: [],
            },
            completed_at: new Date().toISOString(),
          },
        });
      }

      return Promise.reject(new Error(`Unexpected POST ${url}`));
    });
  });

  it("renders keyboard flow and completes a spelling round", async () => {
    render(
      <MemoryRouter initialEntries={["/en/student/spelling-game"]}>
        <SpellingGamePageV2 />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalledWith("/spelling/sessions/start", {}, { headers: { "x-lang": "en" } });
    });

    await userEvent.click(screen.getByRole("button", { name: "A" }));
    await userEvent.click(screen.getByRole("button", { name: "P" }));
    await userEvent.click(screen.getByRole("button", { name: "P" }));
    await userEvent.click(screen.getByRole("button", { name: "L" }));
    await userEvent.click(screen.getByRole("button", { name: "E" }));

    await userEvent.click(screen.getByRole("button", { name: "dashboards.spellingGame.submit" }));

    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalledWith(
        "/spelling/sessions/session-1/answer",
        { answer: "APPLE" },
        { headers: { "x-lang": "en" } },
      );
    });

    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalledWith(
        "/spelling/sessions/session-1/complete",
        { replay_count: 0, typed_playback_count: 0 },
        { headers: { "x-lang": "en" } },
      );
    });

    expect(screen.getByText("dashboards.spellingGame.completed")).toBeInTheDocument();
  });
});
