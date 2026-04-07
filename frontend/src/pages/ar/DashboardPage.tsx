import { useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { GraduationCap, Flame, Gem, Star, Zap, BookOpen, Brain, MessageSquare, LogOut, Gamepad2, CreditCard, Sparkles } from 'lucide-react';

import { Button } from '../../app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../app/components/ui/card';
import { Progress } from '../../app/components/ui/progress';
import { getMe } from '../../api/users';
import { getSession, clearSession } from '../../state/auth';

export function DashboardPage() {
  const { i18n } = useTranslation();
  const isAr = i18n.resolvedLanguage === 'ar';
  const localePrefix = useMemo(() => (isAr ? '/ar' : '/en'), [isAr]);
  const navigate = useNavigate();

  // Guard: redirect if not logged in
  useEffect(() => {
    if (!getSession()) navigate(localePrefix + '/login', { replace: true });
  }, [localePrefix, navigate]);

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: getMe });

  function logout() {
    clearSession();
    navigate(localePrefix + '/');
  }

  const stats = [
    { icon: Flame, label: isAr ? 'أيام متتالية' : 'Day Streak', value: '5', color: 'text-orange-500', bg: 'bg-orange-50' },
    { icon: Gem, label: isAr ? 'النقاط' : 'Points', value: '1,250', color: 'text-primary', bg: 'bg-primary/10' },
    { icon: Star, label: isAr ? 'المستوى' : 'Level', value: '3', color: 'text-yellow-500', bg: 'bg-yellow-50' },
    { icon: Zap, label: isAr ? 'الخبرة' : 'XP', value: '750 / 1000', color: 'text-accent', bg: 'bg-accent/10' },
  ];

  const quickActions = [
    { icon: Brain, labelAr: 'الاختبارات', labelEn: 'Quizzes', href: `${localePrefix}/quizzes`, color: 'bg-primary/10 hover:bg-primary/20 text-primary' },
    { icon: BookOpen, labelAr: 'المكتبة', labelEn: 'Library', href: `${localePrefix}/library`, color: 'bg-secondary/10 hover:bg-secondary/20 text-secondary' },
    { icon: Gamepad2, labelAr: 'الألعاب', labelEn: 'Games', href: `${localePrefix}/games`, color: 'bg-accent/10 hover:bg-accent/20 text-accent' },
    { icon: CreditCard, labelAr: 'البطاقات', labelEn: 'Flashcards', href: `${localePrefix}/flashcards`, color: 'bg-primary/10 hover:bg-primary/20 text-primary' },
    { icon: Sparkles, labelAr: 'مساعد الذكاء الاصطناعي', labelEn: 'AI Assistant', href: `${localePrefix}/ai`, color: 'bg-secondary/10 hover:bg-secondary/20 text-secondary' },
    { icon: MessageSquare, labelAr: 'المنتدى', labelEn: 'Forum', href: `${localePrefix}/forum`, color: 'bg-accent/10 hover:bg-accent/20 text-accent' },
  ];

  const navLinks = [
    { labelAr: 'الرئيسية', labelEn: 'Dashboard', href: `${localePrefix}/dashboard` },
    { labelAr: 'الاختبارات', labelEn: 'Quizzes', href: `${localePrefix}/quizzes` },
    { labelAr: 'المكتبة', labelEn: 'Library', href: `${localePrefix}/library` },
    { labelAr: 'المنتدى', labelEn: 'Forum', href: `${localePrefix}/forum` },
  ];

  return (
    <div className="min-h-screen bg-background" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Top navbar */}
      <header className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <Link to={localePrefix + '/'} className="flex items-center gap-2 font-semibold text-foreground">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <GraduationCap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm hidden sm:inline">{isAr ? 'ليرن إيبِل' : 'LearnAble'}</span>
          </Link>

          <nav className="hidden md:flex items-center gap-5">
            {navLinks.map((l) => (
              <Link key={l.href} to={l.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {isAr ? l.labelAr : l.labelEn}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {me && (
              <span className="text-xs text-muted-foreground hidden sm:inline truncate max-w-[140px]">{me.email}</span>
            )}
            <Button variant="ghost" size="sm" onClick={logout} className="gap-1.5 text-muted-foreground hover:text-destructive">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">{isAr ? 'خروج' : 'Logout'}</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground">
            {isAr ? `مرحباً بعودتك${me ? '، ' + me.email.split('@')[0] : ''}! 👋` : `Welcome back${me ? ', ' + me.email.split('@')[0] : ''}! 👋`}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isAr ? 'استمر في رحلتك التعليمية اليوم.' : 'Continue your learning journey today.'}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {stats.map((s, i) => (
            <Card key={i}>
              <CardContent className="pt-5 pb-5">
                <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
                  <s.icon className={`w-4.5 h-4.5 ${s.color}`} />
                </div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-semibold text-foreground mt-0.5">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* XP Progress */}
        <Card className="mb-8">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-accent" />
              {isAr ? 'تقدّم المستوى' : 'Level Progress'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between text-sm text-muted-foreground mb-2">
              <span>{isAr ? 'المستوى 3' : 'Level 3'}</span>
              <span>750 / 1000 XP</span>
            </div>
            <Progress value={75} className="h-3" />
            <p className="text-xs text-muted-foreground mt-2">
              {isAr ? '250 نقطة خبرة للوصول إلى المستوى 4' : '250 XP to reach Level 4'}
            </p>
          </CardContent>
        </Card>

        {/* Quick actions */}
        <div className="mb-2">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            {isAr ? 'إجراءات سريعة' : 'Quick Actions'}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {quickActions.map((a, i) => (
              <Link key={i} to={a.href}>
                <Card className={`cursor-pointer transition-all hover:shadow-md ${a.color}`}>
                  <CardContent className="pt-6 pb-6 flex flex-col items-center text-center gap-3">
                    <a.icon className="w-8 h-8" />
                    <span className="font-medium">{isAr ? a.labelAr : a.labelEn}</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
