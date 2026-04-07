import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Brain, LogOut, BarChart2, CheckCircle, AlertCircle } from 'lucide-react';

import { Button } from '../../app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../app/components/ui/card';
import { Badge } from '../../app/components/ui/badge';
import { Progress } from '../../app/components/ui/progress';
import { getMe } from '../../api/users';
import { clearSession, getSession } from '../../state/auth';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

const TABS = ['Overview', 'Attendance', 'Classrooms', 'Courses', 'Schedule', 'Messages'];

const MOCK_STUDENTS = [
  { name: 'Alex Johnson', progress: 75, engagement: 'high engagement', attendanceOk: 18, attendanceMissed: 2, attendanceLate: 1, needsHelp: false },
  { name: 'Maria Garcia', progress: 35, engagement: 'medium engagement', attendanceOk: 15, attendanceMissed: 4, attendanceLate: 2, needsHelp: true },
  { name: 'Sam Williams', progress: 85, engagement: 'high engagement', attendanceOk: 20, attendanceMissed: 0, attendanceLate: 1, needsHelp: false },
];

export function TeacherPage() {
  const { i18n } = useTranslation();
  const isAr = i18n.resolvedLanguage === 'ar';
  const localePrefix = useMemo(() => (isAr ? '/ar' : '/en'), [isAr]);
  const navigate = useNavigate();

  useEffect(() => { if (!getSession()) navigate(localePrefix + '/login', { replace: true }); }, [localePrefix, navigate]);

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: getMe });

  function logout() { clearSession(); navigate(localePrefix + '/'); }

  return (
    <div className="min-h-screen bg-background" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-foreground">
            <Brain className="w-5 h-5 text-primary" />
            <span>{isAr ? 'ليرن إيبِل' : 'LearnAble'}</span>
            <span className="text-xs text-muted-foreground font-normal">{isAr ? 'بوابة الأستاذ' : 'Teacher Portal'}</span>
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
        {/* Tabs */}
        <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
          {TABS.map((t, i) => (
            <button
              key={t}
              className={`rounded-xl px-4 py-2 text-sm font-medium whitespace-nowrap transition-all relative ${
                i === 0 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {t}
              {t === 'Classrooms' && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-white rounded-full text-xs flex items-center justify-center">3</span>
              )}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Students list */}
          <div className="lg:col-span-2">
            <h2 className="text-lg font-bold text-foreground mb-4">{isAr ? 'نظرة عامة على الطلاب' : 'Students Overview'}</h2>
            <div className="flex flex-col gap-3">
              {MOCK_STUDENTS.map((s, i) => (
                <Card key={i}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{s.name}</span>
                        {s.needsHelp && (
                          <Badge className="bg-destructive/10 text-destructive text-xs gap-1">
                            <AlertCircle className="w-3 h-3" /> {isAr ? 'يحتاج مساعدة' : 'Needs Help'}
                          </Badge>
                        )}
                        <Badge className={`text-xs ${s.engagement.startsWith('high') ? 'bg-secondary/20 text-secondary' : 'bg-yellow-100 text-yellow-700'}`}>
                          {s.engagement}
                        </Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">{isAr ? 'التقدم' : 'Progress'}</p>
                        <Progress value={s.progress} className="h-2" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">{isAr ? 'الحضور' : 'Attendance'}</p>
                        <p className="text-xs">
                          <span className="text-secondary">✓ {s.attendanceOk}</span>{' '}
                          <span className="text-destructive">✗ {s.attendanceMissed}</span>{' '}
                          <span className="text-muted-foreground">🔔 {s.attendanceLate}</span>
                        </p>
                      </div>
                    </div>
                    <Link to="#" className="text-xs text-primary hover:underline mt-2 block">
                      {isAr ? 'تفاصيل التحليلات ←' : 'Click for detailed analytics →'}
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Class analytics */}
          <div>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-primary" />
                  {isAr ? 'تحليلات الفصل' : 'Class Analytics'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{isAr ? 'متوسط نسبة الإكمال' : 'Avg. Completion Rate'}</p>
                    <p className="text-2xl font-bold text-primary">78%</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{isAr ? 'الطلاب النشطون' : 'Active Students'}</p>
                    <p className="text-2xl font-bold text-secondary">18/24</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-secondary">
                    <CheckCircle className="w-4 h-4" />
                    {isAr ? 'الحصة تسير بشكل جيد' : 'Class is on track'}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
