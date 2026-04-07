import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Brain, CheckCircle, Menu, X } from 'lucide-react';

import { Button } from '../../app/components/ui/button';
import { Card, CardContent } from '../../app/components/ui/card';
import { LanguageSwitcher } from '../../features/accessibility/LanguageSwitcher';
import { AccessibilityPanel } from '../../features/accessibility/AccessibilityPanel';

const FEATURES = [
  { emoji: '🧠', titleEn: 'Dyslexia Smart Reading', titleAr: 'وضع القراءة الذكي', descEn: 'Accessible fonts, improved spacing, and simplified layout to reduce reading fatigue.', descAr: 'خطوط سهلة القراءة وتباعد محسّن لتقليل إجهاد القراءة.' },
  { emoji: '⏱️', titleEn: 'Focus Mode & ADHD Tools', titleAr: 'وضع التركيز وأدوات ADHD', descEn: 'Pomodoro timer, guided sections, and minimal distractions to maintain attention.', descAr: 'مؤقت بومودورو وأقسام موجّهة للحفاظ على الانتباه.' },
  { emoji: '🎮', titleEn: 'Interactive Learning Games', titleAr: 'ألعاب تعليمية تفاعلية', descEn: 'Phonics, spelling, and word recognition games that reinforce reading skills.', descAr: 'ألعاب مبنية على الصوتيات والتهجئة لتعزيز مهارات القراءة.' },
  { emoji: '🤖', titleEn: 'AI Study Assistant', titleAr: 'مساعد الدراسة بالذكاء الاصطناعي', descEn: 'Explains lessons in simple language, summarizes content, and answers questions.', descAr: 'يشرح الدروس بلغة بسيطة ويلخّص المحتوى ويجيب على الأسئلة.' },
  { emoji: '🏆', titleEn: 'Gamification & XP', titleAr: 'نقاط الخبرة والإنجازات', descEn: 'Earn XP and unlock badges for completing lessons, quizzes, and focus sessions.', descAr: 'اكسب نقاطاً وافتح شارات عند إكمال الدروس والاختبارات.' },
  { emoji: '👨‍👩‍👦', titleEn: 'Multi-Role Support', titleAr: 'دعم متعدد الأدوار', descEn: 'Tailored portals for students, teachers, psychologists, and parents.', descAr: 'بوابات مخصصة للطلاب والأساتذة وعلماء النفس وأولياء الأمور.' },
];

export function HomePage() {
  const { i18n } = useTranslation();
  const isAr = i18n.resolvedLanguage === 'ar';
  const localePrefix = useMemo(() => (isAr ? '/ar' : '/en'), [isAr]);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          {/* Logo */}
          <Link to={localePrefix + '/'} className="flex items-center gap-2 font-bold text-foreground">
            <Brain className="w-6 h-6 text-primary" />
            <span className="text-lg">{isAr ? 'ليرن إيبِل' : 'LearnAble'}</span>
          </Link>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-3">
            <LanguageSwitcher />
            <Button variant="ghost" size="sm" asChild>
              <Link to={localePrefix + '/login'}>{isAr ? 'تسجيل الدخول' : 'Sign In'}</Link>
            </Button>
            <Button size="sm" className="bg-secondary text-secondary-foreground hover:bg-secondary/90" asChild>
              <Link to={localePrefix + '/register'}>{isAr ? 'ابدأ مجاناً' : 'Get Started Free'}</Link>
            </Button>
          </div>

          <button className="md:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-border bg-background px-6 py-4 flex flex-col gap-3">
            <div className="flex justify-center"><LanguageSwitcher /></div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <Link to={localePrefix + '/login'}>{isAr ? 'تسجيل الدخول' : 'Sign In'}</Link>
              </Button>
              <Button size="sm" className="flex-1 bg-secondary text-secondary-foreground" asChild>
                <Link to={localePrefix + '/register'}>{isAr ? 'ابدأ مجاناً' : 'Get Started Free'}</Link>
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-6 pt-24 pb-20 text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-foreground leading-tight mb-6">
          {isAr ? (
            <>تعلّم بشكل مختلف.<br />انجح بثقة.</>
          ) : (
            <>Learn differently.<br />Succeed confidently.</>
          )}
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          {isAr
            ? 'منصة تعليمية شاملة مصمّمة خصيصاً لطلاب عسر القراءة واضطراب ADHD، تجمع بين الدعم التعليمي والذكاء الاصطناعي ومراقبة الصحة النفسية.'
            : 'An inclusive learning platform designed specifically for students with dyslexia and ADHD, integrating educational support, AI assistance, and mental well-being monitoring.'}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" className="rounded-xl px-8" asChild>
            <Link to={localePrefix + '/login'}>{isAr ? 'تسجيل الدخول' : 'Sign In'}</Link>
          </Button>
          <Button size="lg" className="rounded-xl px-8 bg-secondary text-secondary-foreground hover:bg-secondary/90" asChild>
            <Link to={localePrefix + '/register'}>{isAr ? 'ابدأ مجاناً' : 'Get Started Free'}</Link>
          </Button>
        </div>
      </section>

      {/* Key Features */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <h2 className="text-3xl font-bold text-foreground text-center mb-10">
          {isAr ? 'الميزات الأساسية' : 'Key Features'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <Card key={i} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6 pb-6">
                <div className="text-3xl mb-3">{f.emoji}</div>
                <h3 className="font-semibold text-foreground mb-1">{isAr ? f.titleAr : f.titleEn}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{isAr ? f.descAr : f.descEn}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-bold text-foreground">
            <Brain className="w-5 h-5 text-primary" />
            {isAr ? 'ليرن إيبِل' : 'LearnAble'}
          </div>
          <p className="text-xs text-muted-foreground">
            {isAr ? '© 2026 ليرن إيبِل — مشروع ISIMM' : '© 2026 LearnAble — ISIMM Project'}
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-secondary" />
            {isAr ? 'مجاني تماماً' : 'Completely free'}
          </p>
        </div>
      </footer>

      {/* Floating accessibility panel */}
      <div className="fixed bottom-4 right-4 z-50">
        <AccessibilityPanel />
      </div>
    </div>
  );
}
