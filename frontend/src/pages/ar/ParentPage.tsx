import { useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Brain, LogOut, Heart, TrendingUp } from 'lucide-react';

import { Button } from '../../app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../app/components/ui/card';
import { Progress } from '../../app/components/ui/progress';
import { getMe } from '../../api/users';
import { clearSession, getSession } from '../../state/auth';

const WEEK_DAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEK_DAYS_AR = ['إث', 'ثل', 'أر', 'خم', 'جم', 'سب', 'أح'];
const ACTIVE_DAYS = [true, true, true, false, true, false, false];

export function ParentPage() {
  const { i18n } = useTranslation();
  const isAr = i18n.resolvedLanguage === 'ar';
  const localePrefix = useMemo(() => (isAr ? '/ar' : '/en'), [isAr]);
  const navigate = useNavigate();

  useEffect(() => { if (!getSession()) navigate(localePrefix + '/login', { replace: true }); }, [localePrefix, navigate]);

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: getMe });

  function logout() { clearSession(); navigate(localePrefix + '/'); }

  return (
    <div className="min-h-screen bg-background" dir={isAr ? 'rtl' : 'ltr'}>
      <header className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-foreground">
            <Brain className="w-5 h-5 text-primary" />
            <span>{isAr ? 'ليرن إيبِل' : 'LearnAble'}</span>
            <span className="text-xs text-muted-foreground font-normal">{isAr ? 'بوابة ولي الأمر' : 'Parent Portal'}</span>
          </div>
          <div className="flex items-center gap-3">
            {me && <span className="text-xs text-muted-foreground hidden sm:inline">{me.email}</span>}
            <Button variant="ghost" size="sm" onClick={logout} className="gap-1.5 text-muted-foreground hover:text-destructive">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Child selector */}
        <Card className="mb-4">
          <CardContent className="pt-4 pb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">{isAr ? 'اختر الطفل' : 'Select Child'}</span>
              <div className="bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-medium">
                Alex Johnson<br />
                <span className="text-xs opacity-80">ID: STU001</span>
              </div>
            </div>
            <Button size="sm" className="gap-1.5">+ {isAr ? 'إضافة طفل' : 'Add Child'}</Button>
          </CardContent>
        </Card>

        {/* Welcome banner */}
        <Card className="mb-6 bg-gradient-to-r from-primary/10 to-secondary/10 border-0">
          <CardContent className="pt-5 pb-5">
            <h2 className="font-bold text-foreground text-lg">{isAr ? 'مرحباً بعودتك!' : 'Welcome back!'}</h2>
            <p className="text-muted-foreground text-sm">{isAr ? 'إليك كيف يسير أداء Alex Johnson هذا الأسبوع.' : "Here's how Alex Johnson is doing this week."}</p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-4">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: isAr ? 'المستوى' : 'Level', value: '12', color: 'text-accent' },
                { label: isAr ? 'الدروس' : 'Lessons', value: '12/20', color: 'text-primary' },
                { label: isAr ? 'التتابع' : 'Streak', value: isAr ? '٧ أيام' : '7 days', color: 'text-secondary' },
              ].map((s, i) => (
                <Card key={i}><CardContent className="pt-4 pb-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                </CardContent></Card>
              ))}
            </div>

            {/* Progress */}
            <Card>
              <CardContent className="pt-4 pb-4">
                <h3 className="font-semibold text-foreground mb-3">{isAr ? 'التقدم العام' : 'Overall Progress'}</h3>
                <div className="flex justify-between text-sm text-muted-foreground mb-2">
                  <span>{isAr ? 'الوحدة الحالية' : 'Current Module'}</span>
                  <span>12 / 20</span>
                </div>
                <Progress value={60} className="h-3" />
              </CardContent>
            </Card>

            {/* Weekly activity */}
            <Card>
              <CardContent className="pt-4 pb-4">
                <h3 className="font-semibold text-foreground mb-3">{isAr ? 'نشاط هذا الأسبوع' : "This Week's Activity"}</h3>
                <div className="grid grid-cols-7 gap-2">
                  {WEEK_DAYS_EN.map((d, i) => (
                    <div key={d} className="flex flex-col items-center gap-1">
                      <span className="text-xs text-muted-foreground">{isAr ? WEEK_DAYS_AR[i] : d}</span>
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${ACTIVE_DAYS[i] ? 'bg-secondary text-white' : 'bg-muted'}`}>
                        {ACTIVE_DAYS[i] && <span className="text-sm">✓</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Heart className="w-4 h-4 text-destructive" />
                  {isAr ? 'الحالة النفسية' : 'Well-being Status'}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {[
                  { label: isAr ? 'المزاج العام' : 'Overall Mood', val: isAr ? 'إيجابي ومتفاعل' : 'Positive and engaged', emoji: '😊', color: '' },
                  { label: isAr ? 'مستوى التركيز' : 'Focus Level', val: isAr ? 'مرتفع' : 'High', emoji: '', color: 'text-primary font-semibold' },
                  { label: isAr ? 'مستوى التوتر' : 'Stress Level', val: isAr ? 'منخفض' : 'Low', emoji: '', color: 'text-secondary font-semibold' },
                ].map((item, i) => (
                  <div key={i} className="bg-muted/40 rounded-lg px-3 py-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-foreground">{item.label}</span>
                      {item.emoji && <span>{item.emoji}</span>}
                    </div>
                    <p className={`text-sm ${item.color || 'text-muted-foreground'}`}>{item.val}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  {isAr ? 'توصيات' : 'Recommendations'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-muted-foreground flex flex-col gap-2">
                  {(isAr ? [
                    'شجّع جلسات تعلّم يومية (٢٠–٣٠ دقيقة)',
                    'احتفل بالإنجازات الصغيرة للحفاظ على الدافعية',
                    'اقترح استخدام وضع التركيز للمواد الصعبة',
                  ] : [
                    'Encourage consistent daily learning sessions (20-30 minutes)',
                    'Celebrate small wins to maintain motivation',
                    'Consider using focus mode for complex topics',
                  ]).map((r, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
