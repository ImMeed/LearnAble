import { createBrowserRouter } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { HomePage } from "../pages/ar/HomePage";

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
  { path: "/", element: <HomePage /> },
  { path: "/ar", element: <HomePage /> },
  { path: "/en", element: <HomePage /> },
  { path: "/ar/forum", element: <PlaceholderPage titleKey="nav.forum" /> },
  { path: "/ar/quizzes", element: <PlaceholderPage titleKey="nav.quizzes" /> },
  { path: "/ar/games", element: <PlaceholderPage titleKey="nav.games" /> },
  { path: "/ar/library", element: <PlaceholderPage titleKey="nav.library" /> },
  { path: "/en/forum", element: <PlaceholderPage titleKey="nav.forum" /> },
  { path: "/en/quizzes", element: <PlaceholderPage titleKey="nav.quizzes" /> },
  { path: "/en/games", element: <PlaceholderPage titleKey="nav.games" /> },
  { path: "/en/library", element: <PlaceholderPage titleKey="nav.library" /> },
]);
