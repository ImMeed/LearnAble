import { createBrowserRouter } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { ProtectedRoute } from "../features/auth/ProtectedRoute";
import CallPage, { CallRedirect } from "../pages/CallPage";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { SettingsPage } from "./pages/SettingsPage";
import { StudentOnboardingPageV2 } from "./pages/StudentOnboarding";
import { StudentDashboardPageV2 } from "./pages/StudentDashboard";
import { CoursePageV2 } from "./pages/CoursePage";
import { TeacherDashboardPageV2 } from "./pages/TeacherDashboard";
import { ParentDashboardPageV2 } from "./pages/ParentDashboard";
import { PsychologistDashboardPageV2 } from "./pages/PsychologistDashboard";
import { AdminDashboardPageV2 } from "./pages/AdminDashboard";
import { ForumPage } from "./pages/ForumPage";
import { AIStudyAssistantPage } from "./pages/AIStudyAssistantPage";
import { CompletedLessonsPage } from "./pages/CompletedLessonsPage";
import { FlashcardsPage } from "./pages/FlashcardsPage";
import { LearningGamesPage } from "./pages/LearningGamesPage";
import { QuizCenterPage } from "./pages/QuizCenterPage";
import { PhaseCheckpointPage } from "../pages/checkpoint/PhaseCheckpointPage";

function PlaceholderPage({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();

  return (
    <main className="page">
      <section className="card">
        <h2>{t(titleKey)}</h2>
        <p>{t("underConstruction")}</p>
      </section>
    </main>
  );
}

export const router = createBrowserRouter([
  { path: "/call/:roomId", element: <CallPage /> },
  { path: "/call", element: <CallRedirect /> },
  { path: "/", element: <LandingPage /> },
  { path: "/ar", element: <LandingPage /> },
  { path: "/en", element: <LandingPage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/ar/login", element: <LoginPage /> },
  { path: "/en/login", element: <LoginPage /> },
  {
    path: "/onboarding",
    element: <StudentOnboardingPageV2 />,
  },
  {
    path: "/student/onboarding",
    element: <StudentOnboardingPageV2 />,
  },
  {
    path: "/student/dashboard",
    element: (
      <ProtectedRoute roles={["ROLE_STUDENT"]}>
        <StudentDashboardPageV2 />
      </ProtectedRoute>
    ),
  },
  {
    path: "/student/course/:id",
    element: (
      <ProtectedRoute roles={["ROLE_STUDENT"]}>
        <CoursePageV2 />
      </ProtectedRoute>
    ),
  },
  {
    path: "/teacher/dashboard",
    element: (
      <ProtectedRoute roles={["ROLE_TUTOR"]}>
        <TeacherDashboardPageV2 />
      </ProtectedRoute>
    ),
  },
  {
    path: "/psychologist/dashboard",
    element: (
      <ProtectedRoute roles={["ROLE_PSYCHOLOGIST"]}>
        <PsychologistDashboardPageV2 />
      </ProtectedRoute>
    ),
  },
  {
    path: "/parent/dashboard",
    element: (
      <ProtectedRoute roles={["ROLE_PARENT"]}>
        <ParentDashboardPageV2 />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/dashboard",
    element: (
      <ProtectedRoute roles={["ROLE_ADMIN"]}>
        <AdminDashboardPageV2 />
      </ProtectedRoute>
    ),
  },
  {
    path: "/ar/onboarding",
    element: <StudentOnboardingPageV2 />,
  },
  {
    path: "/ar/student/onboarding",
    element: <StudentOnboardingPageV2 />,
  },
  {
    path: "/ar/student/dashboard",
    element: (
      <ProtectedRoute roles={["ROLE_STUDENT"]}>
        <StudentDashboardPageV2 />
      </ProtectedRoute>
    ),
  },
  {
    path: "/ar/student/course/:id",
    element: (
      <ProtectedRoute roles={["ROLE_STUDENT"]}>
        <CoursePageV2 />
      </ProtectedRoute>
    ),
  },
  {
    path: "/ar/teacher/dashboard",
    element: (
      <ProtectedRoute roles={["ROLE_TUTOR"]}>
        <TeacherDashboardPageV2 />
      </ProtectedRoute>
    ),
  },
  {
    path: "/ar/psychologist/dashboard",
    element: (
      <ProtectedRoute roles={["ROLE_PSYCHOLOGIST"]}>
        <PsychologistDashboardPageV2 />
      </ProtectedRoute>
    ),
  },
  {
    path: "/ar/parent/dashboard",
    element: (
      <ProtectedRoute roles={["ROLE_PARENT"]}>
        <ParentDashboardPageV2 />
      </ProtectedRoute>
    ),
  },
  {
    path: "/ar/admin/dashboard",
    element: (
      <ProtectedRoute roles={["ROLE_ADMIN"]}>
        <AdminDashboardPageV2 />
      </ProtectedRoute>
    ),
  },
  {
    path: "/en/onboarding",
    element: <StudentOnboardingPageV2 />,
  },
  {
    path: "/en/student/onboarding",
    element: <StudentOnboardingPageV2 />,
  },
  {
    path: "/en/student/dashboard",
    element: (
      <ProtectedRoute roles={["ROLE_STUDENT"]}>
        <StudentDashboardPageV2 />
      </ProtectedRoute>
    ),
  },
  {
    path: "/en/student/course/:id",
    element: (
      <ProtectedRoute roles={["ROLE_STUDENT"]}>
        <CoursePageV2 />
      </ProtectedRoute>
    ),
  },
  {
    path: "/en/teacher/dashboard",
    element: (
      <ProtectedRoute roles={["ROLE_TUTOR"]}>
        <TeacherDashboardPageV2 />
      </ProtectedRoute>
    ),
  },
  {
    path: "/en/psychologist/dashboard",
    element: (
      <ProtectedRoute roles={["ROLE_PSYCHOLOGIST"]}>
        <PsychologistDashboardPageV2 />
      </ProtectedRoute>
    ),
  },
  {
    path: "/en/parent/dashboard",
    element: (
      <ProtectedRoute roles={["ROLE_PARENT"]}>
        <ParentDashboardPageV2 />
      </ProtectedRoute>
    ),
  },
  {
    path: "/en/admin/dashboard",
    element: (
      <ProtectedRoute roles={["ROLE_ADMIN"]}>
        <AdminDashboardPageV2 />
      </ProtectedRoute>
    ),
  },
  { path: "/ar/forum", element: <ProtectedRoute roles={["ROLE_STUDENT", "ROLE_TUTOR"]}><ForumPage /></ProtectedRoute> },
  { path: "/ar/quizzes", element: <ProtectedRoute roles={["ROLE_STUDENT"]}><QuizCenterPage /></ProtectedRoute> },
  { path: "/ar/games", element: <ProtectedRoute roles={["ROLE_STUDENT"]}><LearningGamesPage /></ProtectedRoute> },
  { path: "/ar/flashcards", element: <ProtectedRoute roles={["ROLE_STUDENT"]}><FlashcardsPage /></ProtectedRoute> },
  { path: "/ar/ai", element: <ProtectedRoute roles={["ROLE_STUDENT"]}><AIStudyAssistantPage /></ProtectedRoute> },
  { path: "/ar/lessons", element: <ProtectedRoute roles={["ROLE_STUDENT"]}><CompletedLessonsPage /></ProtectedRoute> },
  { path: "/ar/library", element: <PlaceholderPage titleKey="nav.library" /> },
  { path: "/ar/checkpoint", element: <PhaseCheckpointPage /> },
  { path: "/en/forum", element: <ProtectedRoute roles={["ROLE_STUDENT", "ROLE_TUTOR"]}><ForumPage /></ProtectedRoute> },
  { path: "/en/quizzes", element: <ProtectedRoute roles={["ROLE_STUDENT"]}><QuizCenterPage /></ProtectedRoute> },
  { path: "/en/games", element: <ProtectedRoute roles={["ROLE_STUDENT"]}><LearningGamesPage /></ProtectedRoute> },
  { path: "/en/flashcards", element: <ProtectedRoute roles={["ROLE_STUDENT"]}><FlashcardsPage /></ProtectedRoute> },
  { path: "/en/ai", element: <ProtectedRoute roles={["ROLE_STUDENT"]}><AIStudyAssistantPage /></ProtectedRoute> },
  { path: "/en/lessons", element: <ProtectedRoute roles={["ROLE_STUDENT"]}><CompletedLessonsPage /></ProtectedRoute> },
  { path: "/en/library", element: <PlaceholderPage titleKey="nav.library" /> },
  { path: "/en/checkpoint", element: <PhaseCheckpointPage /> },
  { path: "/ar/settings", element: <ProtectedRoute><SettingsPage /></ProtectedRoute> },
  { path: "/en/settings", element: <ProtectedRoute><SettingsPage /></ProtectedRoute> },
]);
