import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";

import { router } from "./app/router";
import "./app/i18n";
import "./app/styles.css";
import "./app/styles/theme.css";
import { AccessibilityProvider } from "./features/accessibility/AccessibilityContext";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AccessibilityProvider>
        <RouterProvider router={router} />
      </AccessibilityProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
