import { createBrowserRouter } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { ProtectedRoute } from "../features/auth/ProtectedRoute";
import CallPage, { CallRedirect } from "../pages/CallPage";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { ReadingLabAuthPage } from "./pages/ReadingLabAuthPage";
import { StudentOnboardingPageV2 } from "./pages/StudentOnboarding";
import { StudentDashboardPageV2 } from "./pages/StudentDashboard";
import { CoursePageV2 } from "./pages/CoursePage";
import { ReadingLabPage } from "./pages/ReadingLabPage";
import { ReadingLabStudentDashboardPage } from "./pages/ReadingLabStudentDashboard";
import { TeacherDashboardPageV2 } from "./pages/TeacherDashboard";
import { ParentDashboardPageV2 } from "./pages/ParentDashboard";
import { ReadingLabParentDashboardPage } from "./pages/ReadingLabParentDashboard";
import { PsychologistDashboardPageV2 } from "./pages/PsychologistDashboard";
import { ReadingLabPsychologistDashboardPage } from "./pages/ReadingLabPsychologistDashboard";
import { AdminDashboardPageV2 } from "./pages/AdminDashboard";
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
  { path: "/reading-lab", element: <ReadingLabAuthPage /> },
  { path: "/reading-lab/login", element: <ReadingLabAuthPage defaultMode="login" /> },
  { path: "/reading-lab/signup", element: <ReadingLabAuthPage defaultMode="signup" /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/signup", element: <LoginPage defaultMode="register" /> },
  { path: "/ar/login", element: <LoginPage /> },
  { path: "/ar/signup", element: <LoginPage defaultMode="register" /> },
  { path: "/en/login", element: <LoginPage /> },
  { path: "/en/signup", element: <LoginPage defaultMode="register" /> },
  { path: "/ar/reading-lab", element: <ReadingLabAuthPage /> },
  { path: "/ar/reading-lab/login", element: <ReadingLabAuthPage defaultMode="login" /> },
  { path: "/ar/reading-lab/signup", element: <ReadingLabAuthPage defaultMode="signup" /> },
  { path: "/en/reading-lab", element: <ReadingLabAuthPage /> },
  { path: "/en/reading-lab/login", element: <ReadingLabAuthPage defaultMode="login" /> },
  { path: "/en/reading-lab/signup", element: <ReadingLabAuthPage defaultMode="signup" /> },
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
      <ProtectedRoute roles={["ROLE_STUDENT"]} platformTracks={["PLUS_TEN"]}>
        <StudentDashboardPageV2 />
      </ProtectedRoute>
    ),
  },
  {
    path: "/student/course/:id",
    element: (
      <ProtectedRoute roles={["ROLE_STUDENT"]} platformTracks={["PLUS_TEN"]}>
        <CoursePageV2 />
      </ProtectedRoute>
    ),
  },
  {
    path: "/student/reading-lab",
    element: (
      <ProtectedRoute roles={["ROLE_STUDENT"]} loginPath="/reading-lab/login" platformTracks={["READING_LAB"]}>
        <ReadingLabPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/reading-lab/student/dashboard",
    element: (
      <ProtectedRoute roles={["ROLE_STUDENT"]} loginPath="/reading-lab/login" platformTracks={["READING_LAB"]}>
        <ReadingLabStudentDashboardPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/reading-lab/student/lab",
    element: (
      <ProtectedRoute roles={["ROLE_STUDENT"]} loginPath="/reading-lab/login" platformTracks={["READING_LAB"]}>
        <ReadingLabPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/reading-lab/parent/dashboard",
    element: (
      <ProtectedRoute roles={["ROLE_PARENT"]} loginPath="/reading-lab/login" platformTracks={["READING_LAB"]}>
        <ReadingLabParentDashboardPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/reading-lab/psychologist/dashboard",
    element: (
      <ProtectedRoute roles={["ROLE_PSYCHOLOGIST"]} loginPath="/reading-lab/login" platformTracks={["READING_LAB"]}>
        <ReadingLabPsychologistDashboardPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/teacher/dashboard",
    element: (
      <ProtectedRoute roles={["ROLE_TUTOR"]} platformTracks={["PLUS_TEN"]}>
        <TeacherDashboardPageV2 />
      </ProtectedRoute>
    ),
  },
  {
    path: "/psychologist/dashboard",
    element: (
      <ProtectedRoute roles={["ROLE_PSYCHOLOGIST"]} platformTracks={["PLUS_TEN"]}>
        <PsychologistDashboardPageV2 />
      </ProtectedRoute>
    ),
  },
  {
    path: "/parent/dashboard",
    element: (
      <ProtectedRoute roles={["ROLE_PARENT"]} platformTracks={["PLUS_TEN"]}>
        <ParentDashboardPageV2 />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/dashboard",
    element: (
      <ProtectedRoute roles={["ROLE_ADMIN"]} platformTracks={["PLUS_TEN"]}>
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
      <ProtectedRoute roles={["ROLE_STUDENT"]} platformTracks={["PLUS_TEN"]}>
        <StudentDashboardPageV2 />
      </ProtectedRoute>
    ),
  },
  {
    path: "/ar/student/course/:id",
    element: (
      <ProtectedRoute roles={["ROLE_STUDENT"]} platformTracks={["PLUS_TEN"]}>
        <CoursePageV2 />
      </ProtectedRoute>
    ),
  },
  {
    path: "/ar/student/reading-lab",
    element: (
      <ProtectedRoute roles={["ROLE_STUDENT"]} loginPath="/reading-lab/login" platformTracks={["READING_LAB"]}>
        <ReadingLabPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/ar/reading-lab/student/dashboard",
    element: (
      <ProtectedRoute roles={["ROLE_STUDENT"]} loginPath="/reading-lab/login" platformTracks={["READING_LAB"]}>
        <ReadingLabStudentDashboardPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/ar/reading-lab/student/lab",
    element: (
      <ProtectedRoute roles={["ROLE_STUDENT"]} loginPath="/reading-lab/login" platformTracks={["READING_LAB"]}>
        <ReadingLabPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/ar/reading-lab/parent/dashboard",
    element: (
      <ProtectedRoute roles={["ROLE_PARENT"]} loginPath="/reading-lab/login" platformTracks={["READING_LAB"]}>
        <ReadingLabParentDashboardPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/ar/reading-lab/psychologist/dashboard",
    element: (
      <ProtectedRoute roles={["ROLE_PSYCHOLOGIST"]} loginPath="/reading-lab/login" platformTracks={["READING_LAB"]}>
        <ReadingLabPsychologistDashboardPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/ar/teacher/dashboard",
    element: (
      <ProtectedRoute roles={["ROLE_TUTOR"]} platformTracks={["PLUS_TEN"]}>
        <TeacherDashboardPageV2 />
      </ProtectedRoute>
    ),
  },
  {
    path: "/ar/psychologist/dashboard",
    element: (
      <ProtectedRoute roles={["ROLE_PSYCHOLOGIST"]} platformTracks={["PLUS_TEN"]}>
        <PsychologistDashboardPageV2 />
      </ProtectedRoute>
    ),
  },
  {
    path: "/ar/parent/dashboard",
    element: (
      <ProtectedRoute roles={["ROLE_PARENT"]} platformTracks={["PLUS_TEN"]}>
        <ParentDashboardPageV2 />
      </ProtectedRoute>
    ),
  },
  {
    path: "/ar/admin/dashboard",
    element: (
      <ProtectedRoute roles={["ROLE_ADMIN"]} platformTracks={["PLUS_TEN"]}>
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
      <ProtectedRoute roles={["ROLE_STUDENT"]} platformTracks={["PLUS_TEN"]}>
        <StudentDashboardPageV2 />
      </ProtectedRoute>
    ),
  },
  {
    path: "/en/student/course/:id",
    element: (
      <ProtectedRoute roles={["ROLE_STUDENT"]} platformTracks={["PLUS_TEN"]}>
        <CoursePageV2 />
      </ProtectedRoute>
    ),
  },
  {
    path: "/en/student/reading-lab",
    element: (
      <ProtectedRoute roles={["ROLE_STUDENT"]} loginPath="/reading-lab/login" platformTracks={["READING_LAB"]}>
        <ReadingLabPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/en/reading-lab/student/dashboard",
    element: (
      <ProtectedRoute roles={["ROLE_STUDENT"]} loginPath="/reading-lab/login" platformTracks={["READING_LAB"]}>
        <ReadingLabStudentDashboardPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/en/reading-lab/student/lab",
    element: (
      <ProtectedRoute roles={["ROLE_STUDENT"]} loginPath="/reading-lab/login" platformTracks={["READING_LAB"]}>
        <ReadingLabPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/en/reading-lab/parent/dashboard",
    element: (
      <ProtectedRoute roles={["ROLE_PARENT"]} loginPath="/reading-lab/login" platformTracks={["READING_LAB"]}>
        <ReadingLabParentDashboardPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/en/reading-lab/psychologist/dashboard",
    element: (
      <ProtectedRoute roles={["ROLE_PSYCHOLOGIST"]} loginPath="/reading-lab/login" platformTracks={["READING_LAB"]}>
        <ReadingLabPsychologistDashboardPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/en/teacher/dashboard",
    element: (
      <ProtectedRoute roles={["ROLE_TUTOR"]} platformTracks={["PLUS_TEN"]}>
        <TeacherDashboardPageV2 />
      </ProtectedRoute>
    ),
  },
  {
    path: "/en/psychologist/dashboard",
    element: (
      <ProtectedRoute roles={["ROLE_PSYCHOLOGIST"]} platformTracks={["PLUS_TEN"]}>
        <PsychologistDashboardPageV2 />
      </ProtectedRoute>
    ),
  },
  {
    path: "/en/parent/dashboard",
    element: (
      <ProtectedRoute roles={["ROLE_PARENT"]} platformTracks={["PLUS_TEN"]}>
        <ParentDashboardPageV2 />
      </ProtectedRoute>
    ),
  },
  {
    path: "/en/admin/dashboard",
    element: (
      <ProtectedRoute roles={["ROLE_ADMIN"]} platformTracks={["PLUS_TEN"]}>
        <AdminDashboardPageV2 />
      </ProtectedRoute>
    ),
  },
  { path: "/ar/forum", element: <PlaceholderPage titleKey="nav.forum" /> },
  { path: "/ar/quizzes", element: <PlaceholderPage titleKey="nav.quizzes" /> },
  { path: "/ar/games", element: <PlaceholderPage titleKey="nav.games" /> },
  { path: "/ar/library", element: <PlaceholderPage titleKey="nav.library" /> },
  { path: "/ar/checkpoint", element: <PhaseCheckpointPage /> },
  { path: "/en/forum", element: <PlaceholderPage titleKey="nav.forum" /> },
  { path: "/en/quizzes", element: <PlaceholderPage titleKey="nav.quizzes" /> },
  { path: "/en/games", element: <PlaceholderPage titleKey="nav.games" /> },
  { path: "/en/library", element: <PlaceholderPage titleKey="nav.library" /> },
  { path: "/en/checkpoint", element: <PhaseCheckpointPage /> },
]);
