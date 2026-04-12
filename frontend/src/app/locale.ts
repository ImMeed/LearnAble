export type AppLocale = "ar" | "en";

export const DEFAULT_LOCALE: AppLocale = "ar";

export function isSupportedLocale(value: string | null | undefined): value is AppLocale {
  return value === "ar" || value === "en";
}

export function getDirection(locale: AppLocale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

export function getPathLocale(pathname: string): AppLocale {
  if (pathname === "/en" || pathname.startsWith("/en/")) {
    return "en";
  }
  return "ar";
}

export function getInitialLocale(pathname: string): AppLocale {
  const hasLocaleSegment =
    pathname === "/ar" ||
    pathname.startsWith("/ar/") ||
    pathname === "/en" ||
    pathname.startsWith("/en/");

  if (hasLocaleSegment) {
    return getPathLocale(pathname);
  }

  const stored = localStorage.getItem("learnable_locale");
  if (isSupportedLocale(stored)) {
    return stored;
  }
  return getPathLocale(pathname);
}

export function setDocumentLocale(locale: AppLocale): void {
  document.documentElement.lang = locale;
  document.documentElement.dir = getDirection(locale);
}

export function persistLocale(locale: AppLocale): void {
  localStorage.setItem("learnable_locale", locale);
}
