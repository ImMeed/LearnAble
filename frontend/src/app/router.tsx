import { createBrowserRouter } from "react-router-dom";

import { HomePage }        from "../pages/ar/HomePage";
import { LoginPage }       from "../pages/ar/LoginPage";
import { RegisterPage }    from "../pages/ar/RegisterPage";
import { OnboardingPage }  from "../pages/ar/OnboardingPage";
import { DashboardPage }   from "../pages/ar/DashboardPage";
import { QuizPage }        from "../pages/ar/QuizPage";
import { LibraryPage }     from "../pages/ar/LibraryPage";
import { ForumPage }       from "../pages/ar/ForumPage";
import { GamesPage }       from "../pages/ar/GamesPage";
import { FlashcardsPage }  from "../pages/ar/FlashcardsPage";
import { AIAssistantPage } from "../pages/ar/AIAssistantPage";
import { TeacherPage }     from "../pages/ar/TeacherPage";
import { ParentPage }      from "../pages/ar/ParentPage";
import { AdminPage }       from "../pages/ar/AdminPage";

function routes(p: string) {
  return [
    { path: `${p}`,            element: <HomePage /> },
    { path: `${p}/login`,      element: <LoginPage /> },
    { path: `${p}/register`,   element: <RegisterPage /> },
    { path: `${p}/onboarding`, element: <OnboardingPage /> },
    // Student
    { path: `${p}/dashboard`,  element: <DashboardPage /> },
    { path: `${p}/quizzes`,    element: <QuizPage /> },
    { path: `${p}/library`,    element: <LibraryPage /> },
    { path: `${p}/forum`,      element: <ForumPage /> },
    { path: `${p}/games`,      element: <GamesPage /> },
    { path: `${p}/flashcards`, element: <FlashcardsPage /> },
    { path: `${p}/ai`,         element: <AIAssistantPage /> },
    // Role portals
    { path: `${p}/teacher`,    element: <TeacherPage /> },
    { path: `${p}/parent`,     element: <ParentPage /> },
    { path: `${p}/admin`,      element: <AdminPage /> },
  ];
}

export const router = createBrowserRouter([
  { path: "/", element: <HomePage /> },
  ...routes("/ar"),
  ...routes("/en"),
]);
