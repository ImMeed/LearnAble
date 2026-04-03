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
        call: {
          gettingCamera: "…جاري تجهيز الكاميرا",
          waitingForPeer: "…في انتظار انضمام شخص آخر",
          connected: "متصل",
          roomFull: "هذه المكالمة قيد التقدم بالفعل",
          roomFullDesc: ".تم الوصول إلى الحد الأقصى لعدد المشاركين",
          peerLeft: "غادر المشارك الآخر المكالمة",
          returnHome: "العودة للرئيسية",
          cameraDenied: ".تم رفض الوصول إلى الكاميرا. يرجى تفعيل أذونات الكاميرا في إعدادات المتصفح",
          noDevice: ".لم يتم العثور على كاميرا أو ميكروفون",
          genericError: ".حدث خطأ ما. يرجى المحاولة مرة أخرى",
          connectionLost: ".فُقد الاتصال بخادم المكالمة",
          copyLink: "نسخ الرابط",
          linkCopied: "!تم النسخ",
          shareLink: ":شارك هذا الرابط لدعوة شخص",
          mute: "كتم الصوت",
          unmute: "إلغاء كتم الصوت",
          cameraOn: "تشغيل الكاميرا",
          cameraOff: "إيقاف الكاميرا",
          endCall: "إنهاء المكالمة",
          reconnecting: "…جاري إعادة الاتصال",
          authRequired: ".يجب تسجيل الدخول للانضمام إلى المكالمة",
          signIn: "تسجيل الدخول",
          peer: "ضيف",
          you: "أنت",
          connectionQuality: {
            good: "الاتصال: جيد",
            fair: "الاتصال: متوسط",
            poor: "الاتصال: ضعيف"
          }
        },
        attention: {
          rolePicker: {
            title: "من أنت؟",
            teacher: "أنا معلم",
            student: "أنا طالب",
          },
          overlay: {
            highFocus: "تركيز عالٍ",
            moderateFocus: "تركيز متوسط",
            lowFocus: "تركيز منخفض",
            waitingData: "…في انتظار بيانات الطالب",
            noData: "لا تتوفر بيانات انتباه",
            unavailable: "تتبع الانتباه غير متاح",
            details: "تفاصيل",
          },
          alert: {
            title: "يبدو أن الطالب مشتت",
            body: "انخفض التركيز عن المستوى المطلوب",
            dismiss: "تجاهل",
          },
          panel: {
            title: "مخطط الانتباه",
            back: "رجوع →",
            collecting: "…جمع البيانات",
            legendHigh: "تركيز عالٍ",
            legendModerate: "متوسط",
            legendLow: "منخفض",
          },
          consent: {
            tracking: "تتبع الانتباه نشط",
          },
          tabInactive: "علامة تبويب الطالب غير نشطة",
        }
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
        call: {
          gettingCamera: "Getting your camera ready…",
          waitingForPeer: "Waiting for someone to join…",
          connected: "Connected",
          roomFull: "This call is already in progress",
          roomFullDesc: "The maximum number of participants has been reached.",
          peerLeft: "The other participant has left the call",
          returnHome: "Return Home",
          cameraDenied: "Camera access was denied. Please enable camera permissions in your browser settings.",
          noDevice: "No camera or microphone found on this device.",
          genericError: "Something went wrong. Please try again.",
          connectionLost: "Connection to the call server was lost.",
          copyLink: "Copy Link",
          linkCopied: "Copied!",
          shareLink: "Share this link to invite someone:",
          mute: "Mute",
          unmute: "Unmute",
          cameraOn: "Turn camera on",
          cameraOff: "Turn camera off",
          endCall: "End call",
          reconnecting: "Reconnecting…",
          authRequired: "You must be signed in to join a call.",
          signIn: "Sign In",
          peer: "Guest",
          you: "You",
          connectionQuality: {
            good: "Connection: Good",
            fair: "Connection: Fair",
            poor: "Connection: Poor"
          }
        },
        attention: {
          rolePicker: {
            title: "Who are you?",
            teacher: "I'm a Teacher",
            student: "I'm a Student",
          },
          overlay: {
            highFocus: "High Focus",
            moderateFocus: "Moderate Focus",
            lowFocus: "Low Focus",
            waitingData: "Waiting for student data…",
            noData: "No attention data available",
            unavailable: "Attention tracking unavailable",
            details: "Details",
          },
          alert: {
            title: "Student appears distracted",
            body: "Focus dropped below threshold",
            dismiss: "Dismiss",
          },
          panel: {
            title: "Attention Timeline",
            back: "← Back",
            collecting: "Collecting data…",
            legendHigh: "High Focus",
            legendModerate: "Moderate",
            legendLow: "Low",
          },
          consent: {
            tracking: "Attention tracking is active",
          },
          tabInactive: "Student tab inactive",
        }
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
