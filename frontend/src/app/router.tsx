import { createBrowserRouter } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { ProtectedRoute } from "../features/auth/ProtectedRoute";
import CallPage, { CallRedirect } from "../pages/CallPage";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { READING_LAB_ENABLED } from "./features";
import { StudentOnboardingPageV2 } from "./pages/StudentOnboarding";
import { StudentDashboardPageV2 } from "./pages/StudentDashboard";
import { StudentGamesPageV2 } from "./pages/StudentGamesPage";
import { SpellingGamePageV2 } from "./pages/SpellingGamePage";
import { CoursePageV2 } from "./pages/CoursePage";
import { ReadingLabPageV2 } from "./pages/ReadingLab";
import { TeacherDashboardPageV2 } from "./pages/TeacherDashboard";
import { ParentDashboardPageV2 } from "./pages/ParentDashboard";
import { PsychologistDashboardPageV2 } from "./pages/PsychologistDashboard";
import { AdminDashboardPageV2 } from "./pages/AdminDashboard";
import { PhaseCheckpointPage } from "../pages/checkpoint/PhaseCheckpointPage";
import { AuthenticatedHomePage } from "../pages/AuthenticatedHomePage";
import { TeacherCourseReviewPage } from "./pages/TeacherCourseReviewPage";
import { StudentCoursesListPage } from "./pages/StudentCoursesListPage";
import { StudentCoursePage } from "./pages/StudentCoursePage";

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
    path: "/home",
    element: (
      <ProtectedRoute>
        <AuthenticatedHomePage />
      </ProtectedRoute>
    ),
  },
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
    path: "/student/spelling-game",
    element: (
      <ProtectedRoute roles={["ROLE_STUDENT"]}>
        <SpellingGamePageV2 />
      </ProtectedRoute>
    ),
  },
  ...(READING_LAB_ENABLED
    ? [{
        path: "/student/reading-lab",
        element: (
          <ProtectedRoute roles={["ROLE_STUDENT"]}>
            <ReadingLabPageV2 />
          </ProtectedRoute>
        ),
      }]
    : []),
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
    path: "/ar/home",
    element: (
      <ProtectedRoute>
        <AuthenticatedHomePage />
      </ProtectedRoute>
    ),
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
    path: "/ar/student/spelling-game",
    element: (
      <ProtectedRoute roles={["ROLE_STUDENT"]}>
        <SpellingGamePageV2 />
      </ProtectedRoute>
    ),
  },
  ...(READING_LAB_ENABLED
    ? [{
        path: "/ar/student/reading-lab",
        element: (
          <ProtectedRoute roles={["ROLE_STUDENT"]}>
            <ReadingLabPageV2 />
          </ProtectedRoute>
        ),
      }]
    : []),
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
    path: "/en/home",
    element: (
      <ProtectedRoute>
        <AuthenticatedHomePage />
      </ProtectedRoute>
    ),
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
    path: "/en/student/spelling-game",
    element: (
      <ProtectedRoute roles={["ROLE_STUDENT"]}>
        <SpellingGamePageV2 />
      </ProtectedRoute>
    ),
  },
  ...(READING_LAB_ENABLED
    ? [{
        path: "/en/student/reading-lab",
        element: (
          <ProtectedRoute roles={["ROLE_STUDENT"]}>
            <ReadingLabPageV2 />
          </ProtectedRoute>
        ),
      }]
    : []),
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
  // Teacher course review
  { path: "/ar/teacher/courses/:courseId/review", element: <ProtectedRoute roles={["ROLE_TUTOR"]}><TeacherCourseReviewPage /></ProtectedRoute> },
  { path: "/en/teacher/courses/:courseId/review", element: <ProtectedRoute roles={["ROLE_TUTOR"]}><TeacherCourseReviewPage /></ProtectedRoute> },
  // Student course list
  { path: "/ar/student/courses", element: <ProtectedRoute roles={["ROLE_STUDENT"]}><StudentCoursesListPage /></ProtectedRoute> },
  { path: "/en/student/courses", element: <ProtectedRoute roles={["ROLE_STUDENT"]}><StudentCoursesListPage /></ProtectedRoute> },
  // Student course reader
  { path: "/ar/student/courses/:courseId", element: <ProtectedRoute roles={["ROLE_STUDENT"]}><StudentCoursePage /></ProtectedRoute> },
  { path: "/en/student/courses/:courseId", element: <ProtectedRoute roles={["ROLE_STUDENT"]}><StudentCoursePage /></ProtectedRoute> },
  { path: "/ar/forum", element: <PlaceholderPage titleKey="nav.forum" /> },
  { path: "/ar/quizzes", element: <PlaceholderPage titleKey="nav.quizzes" /> },
  {
    path: "/ar/games",
    element: (
      <ProtectedRoute roles={["ROLE_STUDENT"]}>
        <StudentGamesPageV2 />
      </ProtectedRoute>
    ),
  },
  { path: "/ar/library", element: <PlaceholderPage titleKey="nav.library" /> },
  { path: "/ar/checkpoint", element: <PhaseCheckpointPage /> },
  { path: "/en/forum", element: <PlaceholderPage titleKey="nav.forum" /> },
  { path: "/en/quizzes", element: <PlaceholderPage titleKey="nav.quizzes" /> },
  {
    path: "/en/games",
    element: (
      <ProtectedRoute roles={["ROLE_STUDENT"]}>
        <StudentGamesPageV2 />
      </ProtectedRoute>
    ),
  },
  { path: "/en/library", element: <PlaceholderPage titleKey="nav.library" /> },
  { path: "/en/checkpoint", element: <PhaseCheckpointPage /> },
]);
