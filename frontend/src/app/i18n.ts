import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { getInitialLocale, persistLocale, setDocumentLocale } from "./locale";

const initialLocale = getInitialLocale(window.location.pathname);
setDocumentLocale(initialLocale);

void i18n.use(initReactI18next).init({
  lng: initialLocale,
  fallbackLng: "ar",
  resources: {
    ar: {
      translation: {
        appTitle: "ليرن إيبِل",
        subtitle: "منصة تعلم عربية لذوي التنوع العصبي",
        underConstruction: "قيد التطوير في المرحلة الحالية.",
        nav: {
          forum: "المنتدى",
          quizzes: "الاختبارات",
          games: "الألعاب",
          library: "المكتبة",
        },
        language: {
          switcherLabel: "تبديل اللغة",
        },
      },
    },
    en: {
      translation: {
        appTitle: "LearnAble",
        subtitle: "An inclusive learning platform for neurodivergent learners",
        underConstruction: "This section is under development in the current phase.",
        nav: {
          forum: "Forum",
          quizzes: "Quizzes",
          games: "Games",
          library: "Library",
        },
        language: {
          switcherLabel: "Language switcher",
        },
      },
    },
  },
  interpolation: { escapeValue: false },
});

void i18n.changeLanguage(initialLocale);
i18n.on("languageChanged", (locale) => {
  if (locale === "ar" || locale === "en") {
    persistLocale(locale);
    setDocumentLocale(locale);
  }
});

export default i18n;
