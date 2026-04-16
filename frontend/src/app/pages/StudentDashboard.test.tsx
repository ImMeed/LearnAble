import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock("../../api/client", () => ({
  apiClient: {
    get: mocks.get,
    post: mocks.post,
  },
}));

vi.mock("../features", () => ({
  CLASSROOM_SYSTEM_ENABLED: false,
  READING_LAB_ENABLED: false,
}));

vi.mock("../../features/accessibility/AccessibilityContext", () => ({
  useAccessibility: () => ({
    settings: { focusMode: false, badges: true },
    setFocusMode: vi.fn(),
  }),
}));

vi.mock("../components/ADHDToDoList", () => ({
  ADHDToDoList: () => <div>todo-list</div>,
}));

vi.mock("../components/FocusTimer", () => ({
  FocusTimer: () => <div>focus-timer</div>,
}));

vi.mock("../components/ProgressBar", () => ({
  ProgressBar: () => <div>progress-bar</div>,
}));

vi.mock("../components/uiStyles", () => ({
  actionClass: () => "btn",
  cx: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
  inputClass: "input",
  surfaceClass: "surface",
}));

vi.mock("../components/StudentCallFlow", () => ({
  StudentCallFlow: () => <div>student-call-flow</div>,
}));

vi.mock("./roleDashboardShared", () => ({
  DashboardShell: ({ children }: { title: string; children: ReactNode }) => <div>{children}</div>,
  errorMessage: () => "error",
  localePrefix: () => "/en",
  localeRequestConfig: () => ({ headers: { "x-lang": "en" } }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { resolvedLanguage: "en" },
    t: (key: string) => key,
  }),
}));

import { StudentDashboardPageV2 } from "./StudentDashboard";

describe("StudentDashboardPageV2 achievements", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.post.mockReset();

    mocks.get.mockImplementation((url: string) => {
      if (url === "/study/lessons") {
        return Promise.resolve({ data: { items: [] } });
      }
      if (url === "/gamification/progress-summary/me") {
        return Promise.resolve({
          data: {
            completed_sessions: 2,
            total_rounds_completed: 7,
            games_completed: 2,
            quizzes_completed: 2,
            total_xp: 180,
            current_level: 2,
            next_level_xp: 200,
            streak_days: 3,
            tracked_course_minutes: 70,
            estimated_course_minutes: 75,
            total_course_minutes: 145,
            badges: [
              { code: "XP_CHAMPION", title: "XP Champion", description: "", threshold_xp: 250, unlocked: false },
              { code: "QUIZ_EXPLORER", title: "Quiz Explorer", description: "", threshold_xp: 50, unlocked: true },
              { code: "FOCUSED_LEARNER", title: "Focused Learner", description: "", threshold_xp: 100, unlocked: true },
              { code: "STREAK_FIRE", title: "Streak Fire", description: "", threshold_xp: 150, unlocked: false },
              { code: "LEVEL_MASTER", title: "Level Master", description: "", threshold_xp: 200, unlocked: false },
            ],
          },
        });
      }
      if (url === "/teacher/presence/active") {
        return Promise.resolve({ data: { items: [] } });
      }
      if (url === "/teacher/assistance/requests") {
        return Promise.resolve({ data: { items: [] } });
      }
      throw new Error(`Unexpected GET ${url}`);
    });
  });

  it("shows all obtainable achievements with locked gray and unlocked colorful states", async () => {
    render(
      <MemoryRouter initialEntries={["/en/student/dashboard"]}>
        <StudentDashboardPageV2 />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mocks.get).toHaveBeenCalledWith("/gamification/progress-summary/me", { headers: { "x-lang": "en" } });
    });

    await userEvent.click(screen.getByRole("button", { name: "dashboards.studentV2.sectionProgress" }));

    await waitFor(() => {
      expect(screen.getByText("Quiz Explorer")).toBeInTheDocument();
      expect(screen.getByText("Focused Learner")).toBeInTheDocument();
      expect(screen.getByText("Streak Fire")).toBeInTheDocument();
      expect(screen.getByText("Level Master")).toBeInTheDocument();
      expect(screen.getByText("XP Champion")).toBeInTheDocument();
    });

    const unlockedBadge = screen.getByText("Quiz Explorer").closest("article");
    const lockedBadge = screen.getByText("XP Champion").closest("article");

    expect(unlockedBadge).toHaveClass("unlocked");
    expect(lockedBadge).toHaveClass("locked");
  });
});
