import { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { FocusTimerProvider } from "./FocusTimerContext";

export function FocusTimerRuntimeProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const isRtl = i18n.dir(i18n.resolvedLanguage) === "rtl";

  return (
    <FocusTimerProvider isRtl={isRtl}>
      {children}
    </FocusTimerProvider>
  );
}
