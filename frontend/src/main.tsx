import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { RouterProvider } from "react-router-dom";

import { router } from "./app/router";
import "./app/i18n";
import "./app/tailwind.css";
import "./app/styles.css";
import "./app/styles/theme.css";
import { AccessibilityProvider } from "./features/accessibility/AccessibilityContext";
import { setDocumentLocale } from "./app/locale";
import { FocusTimerRuntimeProvider } from "./features/focus-timer";

const queryClient = new QueryClient();

function DocumentLocaleSync() {
  const { i18n } = useTranslation();
  const locale = i18n.language === "en" ? "en" : "ar";

  useEffect(() => {
    setDocumentLocale(locale);
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <DocumentLocaleSync />
      <AccessibilityProvider>
        <FocusTimerRuntimeProvider>
          <RouterProvider router={router} />
        </FocusTimerRuntimeProvider>
      </AccessibilityProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
