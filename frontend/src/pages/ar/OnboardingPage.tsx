import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Brain } from 'lucide-react';

import { Button } from '../../app/components/ui/button';
import { Input } from '../../app/components/ui/input';
import { Card, CardContent } from '../../app/components/ui/card';

type Step = {
  questionEn: string;
  questionAr: string;
  type: 'text' | 'choice';
  choices?: { en: string; ar: string }[];
};

const STEPS: Step[] = [
  {
    questionEn: 'What is your name?',
    questionAr: 'ما اسمك؟',
    type: 'text',
  },
  {
    questionEn: 'How old are you?',
    questionAr: 'كم عمرك؟',
    type: 'choice',
    choices: [
      { en: '6–10 years', ar: '٦–١٠ سنوات' },
      { en: '11–14 years', ar: '١١–١٤ سنة' },
      { en: '15–18 years', ar: '١٥–١٨ سنة' },
      { en: '18+ years', ar: '١٨+ سنة' },
    ],
  },
  {
    questionEn: 'Do you experience reading difficulties?',
    questionAr: 'هل تواجه صعوبات في القراءة؟',
    type: 'choice',
    choices: [
      { en: 'Yes, often', ar: 'نعم، كثيراً' },
      { en: 'Sometimes', ar: 'أحياناً' },
      { en: 'Rarely', ar: 'نادراً' },
      { en: 'No', ar: 'لا' },
    ],
  },
  {
    questionEn: 'How would you describe your attention span during studying?',
    questionAr: 'كيف تصف مستوى تركيزك أثناء الدراسة؟',
    type: 'choice',
    choices: [
      { en: 'Very short — I get distracted easily', ar: 'قصير جداً — أشتت انتباهي بسهولة' },
      { en: 'Short — around 10–15 min', ar: 'قصير — حوالي ١٠–١٥ دقيقة' },
      { en: 'Moderate — around 20–30 min', ar: 'متوسط — حوالي ٢٠–٣٠ دقيقة' },
      { en: 'Good — I can focus for long periods', ar: 'جيد — أستطيع التركيز لفترات طويلة' },
    ],
  },
];

export function OnboardingPage() {
  const { i18n } = useTranslation();
  const isAr = i18n.resolvedLanguage === 'ar';
  const localePrefix = useMemo(() => (isAr ? '/ar' : '/en'), [isAr]);
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>(Array(STEPS.length).fill(''));

  const current = STEPS[step];
  const answer = answers[step];
  const isLast = step === STEPS.length - 1;

  function setAnswer(val: string) {
    setAnswers((prev) => { const a = [...prev]; a[step] = val; return a; });
  }

  function next() {
    if (isLast) {
      navigate(`${localePrefix}/dashboard`);
    } else {
      setStep(step + 1);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Stepper */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
              i === step ? 'bg-primary text-white' : i < step ? 'bg-secondary text-white' : 'bg-muted text-muted-foreground'
            }`}>
              {i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-12 h-0.5 ${i < step ? 'bg-secondary' : 'bg-muted'}`} />
            )}
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        {isAr ? `خطوة ${step + 1} من ${STEPS.length}` : `Step ${step + 1} of ${STEPS.length}`}
      </p>

      <Card className="w-full max-w-lg shadow-sm">
        <CardContent className="pt-8 pb-8">
          {step === 0 && (
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-5 h-5 text-primary" />
              <span className="font-bold text-foreground text-lg">
                {isAr ? 'مرحباً بك في ليرن إيبِل!' : 'Welcome to LearnAble!'}
              </span>
            </div>
          )}
          <p className="text-muted-foreground text-sm mb-6">
            {isAr
              ? 'نحن متحمسون لمساعدتك في التعلّم بالطريقة التي تناسبك.'
              : 'We are excited to help you learn in the way that works best for you.'}
          </p>

          <p className="font-semibold text-foreground mb-4">
            {isAr ? current.questionAr : current.questionEn}
          </p>

          {current.type === 'text' ? (
            <Input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={isAr ? 'اكتب إجابتك...' : 'Type your answer...'}
              className="mb-6"
            />
          ) : (
            <div className="flex flex-col gap-3 mb-6">
              {current.choices?.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setAnswer(c.en)}
                  className={`w-full text-start rounded-xl border px-4 py-3 text-sm transition-all ${
                    answer === c.en
                      ? 'border-primary bg-primary/5 text-foreground font-medium'
                      : 'border-border bg-card hover:border-primary/40 text-foreground'
                  }`}
                >
                  {isAr ? c.ar : c.en}
                </button>
              ))}
            </div>
          )}

          <Button
            className="w-full rounded-xl h-11"
            onClick={next}
            disabled={!answer.trim()}
          >
            {isAr ? (isLast ? 'ابدأ التعلّم →' : 'متابعة →') : (isLast ? 'Start Learning →' : 'Continue →')}
          </Button>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground mt-6 max-w-sm text-center">
        {isAr
          ? 'نستخدم إجاباتك لتخصيص تجربة التعلّم. يمكنك تغيير هذه الإعدادات في أي وقت.'
          : 'We use your responses to personalize your learning experience. You can change these settings anytime.'}
      </p>
    </div>
  );
}
