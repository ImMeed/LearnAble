type PortalRoleCopy = {
  label: string;
  hint: string;
};

type ReadingLabPortalCopy = {
  sectionTitle: string;
  sectionSubtitle: string;
  classicLink: string;
  auth: {
    eyebrow: string;
    title: string;
    subtitle: string;
    loginTab: string;
    signupTab: string;
    roleLabel: string;
    emailLabel: string;
    passwordLabel: string;
    emailPlaceholder: string;
    passwordPlaceholder: string;
    submitLogin: string;
    submitSignup: string;
    statusPending: string;
    switchPromptLogin: string;
    switchPromptSignup: string;
    switchToLogin: string;
    switchToSignup: string;
    helperTitle: string;
    helperLines: string[];
    roles: {
      student: PortalRoleCopy;
      parent: PortalRoleCopy;
      psychologist: PortalRoleCopy;
    };
  };
  student: {
    title: string;
    subtitle: string;
    introTitle: string;
    introBody: string;
    focusTitle: string;
    quickStart: string;
    lockedTitle: string;
    lockedBody: string;
    gameShelf: string;
    progressTitle: string;
    activePath: string;
    openGames: string;
    sessions: string;
    accuracy: string;
    xp: string;
  };
  parent: {
    title: string;
    subtitle: string;
    heroTitle: string;
    heroBody: string;
    guideTitle: string;
    guideItems: string[];
    notesTitle: string;
    notificationsTitle: string;
  };
  psychologist: {
    title: string;
    subtitle: string;
    heroTitle: string;
    heroBody: string;
    reviewTitle: string;
    planTitle: string;
    metricsTitle: string;
    alertsTitle: string;
  };
};

const arCopy: ReadingLabPortalCopy = {
  sectionTitle: "مسار مختبر القراءة",
  sectionSubtitle: "واجهة مستقلة للأطفال الداعمة للقراءة وللأهل والأخصائيين المتابعين لهم.",
  classicLink: "العودة إلى المسار الرئيسي",
  auth: {
    eyebrow: "واجهة خاصة بالأطفال",
    title: "ادخل إلى مختبر القراءة",
    subtitle: "هذا المسار مخصص للأطفال الذين يتدربون على الحروف والكلمات، وللأهل والأخصائيين الذين يخططون الدعم اليومي.",
    loginTab: "تسجيل الدخول",
    signupTab: "إنشاء حساب",
    roleLabel: "اختر نوع الحساب",
    emailLabel: "البريد الإلكتروني",
    passwordLabel: "كلمة المرور",
    emailPlaceholder: "name@example.com",
    passwordPlaceholder: "أدخل كلمة المرور",
    submitLogin: "ادخل إلى المسار",
    submitSignup: "إنشاء حساب جديد",
    statusPending: "جار تجهيز المسار...",
    switchPromptLogin: "لديك حساب بالفعل؟",
    switchPromptSignup: "هل تحتاج إلى حساب جديد؟",
    switchToLogin: "افتح تسجيل الدخول",
    switchToSignup: "افتح إنشاء الحساب",
    helperTitle: "كيف يعمل هذا المسار؟",
    helperLines: [
      "الطفل يصل إلى الألعاب والأنشطة المناسبة له.",
      "ولي الأمر يحدد الكلمات والحروف والأرقام التي تحتاج إلى دعم إضافي.",
      "الأخصائي يتابع الخطة ويراجع التقدم بشكل منفصل عن منصة +10.",
    ],
    roles: {
      student: { label: "طفل", hint: "يدخل إلى ألعاب القراءة والصوتيات." },
      parent: { label: "ولي أمر", hint: "يدخل معرف الطفل ويحدد الكلمات والحروف والأرقام المستهدفة." },
      psychologist: { label: "أخصائي", hint: "يراجع الحالات ويضبط خطة الدعم." },
    },
  },
  student: {
    title: "لوحة الطفل",
    subtitle: "مساحة هادئة ومرحة للانطلاق إلى الألعاب المناسبة لك.",
    introTitle: "رحلتك اليوم",
    introBody: "ابدأ بجلسة قصيرة، ركز على الرموز الصعبة، ثم العب جولة أو جولتين فقط.",
    focusTitle: "رموز التدريب الحالية",
    quickStart: "ابدأ الآن",
    lockedTitle: "المختبر غير مفعل بعد",
    lockedBody: "سيظهر هذا المسار عندما يفعله ولي الأمر أو الأخصائي لك.",
    gameShelf: "رف الألعاب",
    progressTitle: "تقدمك اليومي",
    activePath: "المسار النشط",
    openGames: "افتح ساحة الألعاب",
    sessions: "جلسات",
    accuracy: "الدقة",
    xp: "الخبرة",
  },
  parent: {
    title: "لوحة الأسرة للأطفال",
    subtitle: "تابع الخطة اليومية وحدد الرموز الصعبة لكل طفل في مختبر القراءة.",
    heroTitle: "استوديو دعم القراءة",
    heroBody: "هنا تتابع ما يحتاجه الطفل بالضبط: كلمات معينة، حروف معينة، أرقام معينة، وملاحظات قصيرة تساعد الجلسات اليومية.",
    guideTitle: "روتين منزلي مقترح",
    guideItems: [
      "جلسة قصيرة من 8 إلى 12 دقيقة تكفي في البداية.",
      "اختر حرفين أو رقمين فقط في كل مرة حتى لا يشعر الطفل بالضغط.",
      "شجع الإجابات الصحيحة بصوت هادئ ولا تحول الجلسة إلى اختبار.",
    ],
    notesTitle: "ملاحظات الأسرة",
    notificationsTitle: "آخر التحديثات",
  },
  psychologist: {
    title: "لوحة الأخصائي للأطفال",
    subtitle: "واجهة مستقلة لمراجعة خطط الأطفال وضبط تدريبات القراءة في هذا المسار.",
    heroTitle: "غرفة متابعة القراءة",
    heroBody: "راجع الحالات المرتبطة بك، اضبط رموز التدريب المستهدفة، ووازن بين الدعم السريري والخطة المنزلية.",
    reviewTitle: "قائمة المراجعات",
    planTitle: "خطة الدعم الحالية",
    metricsTitle: "نظرة عامة سريعة",
    alertsTitle: "آخر التنبيهات",
  },
};

const enCopy: ReadingLabPortalCopy = {
  sectionTitle: "Reading Lab Track",
  sectionSubtitle: "A separate experience for younger readers, parents, and psychologists supporting dyslexic kids.",
  classicLink: "Back to main platform",
  auth: {
    eyebrow: "Kids reading support",
    title: "Enter Reading Lab",
    subtitle: "This space is dedicated to the child-friendly reading track and the adults who guide it at home and in support sessions.",
    loginTab: "Log in",
    signupTab: "Sign up",
    roleLabel: "Choose account type",
    emailLabel: "Email",
    passwordLabel: "Password",
    emailPlaceholder: "name@example.com",
    passwordPlaceholder: "Enter your password",
    submitLogin: "Enter the Reading Lab",
    submitSignup: "Create Reading Lab account",
    statusPending: "Preparing your Reading Lab access...",
    switchPromptLogin: "Already have an account?",
    switchPromptSignup: "Need a separate Reading Lab account?",
    switchToLogin: "Open login",
    switchToSignup: "Open sign up",
    helperTitle: "What changes in this track?",
    helperLines: [
      "Kids get a calmer, game-first dashboard focused on reading practice.",
      "Parents enter the child ID, then choose the exact words, letters, and numbers for practice.",
      "Psychologists enter the child ID to follow the same track and review activity in a separate workspace.",
    ],
    roles: {
      student: { label: "Kid", hint: "Access games, audio prompts, and daily practice." },
      parent: { label: "Parent", hint: "Enter the child ID and choose exact practice words, letters, and numbers." },
      psychologist: { label: "Psychologist", hint: "Enter the child ID to review progress and adjust the reading track." },
    },
  },
  student: {
    title: "Kid Dashboard",
    subtitle: "A playful starting point before jumping into your reading games.",
    introTitle: "Your mission today",
    introBody: "Start with a short practice burst, focus on the tricky symbols, and keep the session light and encouraging.",
    focusTitle: "Your current focus symbols",
    quickStart: "Quick start",
    lockedTitle: "Reading Lab is still locked",
    lockedBody: "This track will open as soon as your parent or psychologist enables it for you.",
    gameShelf: "Game shelf",
    progressTitle: "Your daily progress",
    activePath: "Active path",
    openGames: "Open the game arena",
    sessions: "Sessions",
    accuracy: "Accuracy",
    xp: "XP",
  },
  parent: {
    title: "Kids Parent Dashboard",
    subtitle: "A separate family workspace for the Reading Lab child track.",
    heroTitle: "Family reading studio",
    heroBody: "This dashboard is focused only on the younger-reader Reading Lab: the child ID flow, exact practice words, target symbols, and calmer progress tracking.",
    guideTitle: "Suggested home routine",
    guideItems: [
      "Keep each session short: 8 to 12 minutes is enough at the start.",
      "Target only one or two hard letters or numbers at a time.",
      "Use warm encouragement and avoid turning practice into a test.",
    ],
    notesTitle: "Family support notes",
    notificationsTitle: "Recent updates",
  },
  psychologist: {
    title: "Kids Psychologist Dashboard",
    subtitle: "A dedicated workspace for the Reading Lab support track.",
    heroTitle: "Reading support review room",
    heroBody: "Review linked children, adjust target symbols, and manage the younger-reader plan separately from the general +10 platform.",
    reviewTitle: "Review queue",
    planTitle: "Current support plan",
    metricsTitle: "Quick metrics",
    alertsTitle: "Recent alerts",
  },
};

export function getReadingLabPortalCopy(locale: string | undefined): ReadingLabPortalCopy {
  return locale === "en" ? enCopy : arCopy;
}
