import { useMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Brain, LogOut, Users, CheckCircle, Shield, UserPlus, Search } from 'lucide-react';

import { Button } from '../../app/components/ui/button';
import { Card, CardContent } from '../../app/components/ui/card';
import { Badge } from '../../app/components/ui/badge';
import { Input } from '../../app/components/ui/input';
import { getMe } from '../../api/users';
import { clearSession, getSession } from '../../state/auth';

const MOCK_USERS = [
  { name: 'Alex Johnson',    email: 'alex@student.com',   role: 'student',       status: 'Active',  joined: '15/01/2026' },
  { name: 'Maria Garcia',    email: 'maria@student.com',  role: 'student',       status: 'Active',  joined: '20/01/2026' },
  { name: 'Ms. Sarah Williams', email: 'sarah@teacher.com', role: 'teacher',    status: 'Active',  joined: '10/12/2025' },
  { name: 'John Parent',     email: 'john@parent.com',    role: 'parent',        status: 'Active',  joined: '16/01/2026' },
  { name: 'Dr. Emma Smith',  email: 'emma@psych.com',     role: 'psychologist',  status: 'Pending', joined: '20/03/2026' },
];

const ROLE_COLORS: Record<string, string> = {
  student:      'bg-primary/10 text-primary',
  teacher:      'bg-secondary/20 text-secondary',
  parent:       'bg-yellow-100 text-yellow-700',
  psychologist: 'bg-accent/10 text-accent',
};

export function AdminPage() {
  const { i18n } = useTranslation();
  const isAr = i18n.resolvedLanguage === 'ar';
  const localePrefix = useMemo(() => (isAr ? '/ar' : '/en'), [isAr]);
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  useEffect(() => { if (!getSession()) navigate(localePrefix + '/login', { replace: true }); }, [localePrefix, navigate]);

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: getMe });

  function logout() { clearSession(); navigate(localePrefix + '/'); }

  const pendingPsychologists = MOCK_USERS.filter((u) => u.role === 'psychologist' && u.status === 'Pending');
  const filtered = MOCK_USERS.filter(
    (u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background" dir={isAr ? 'rtl' : 'ltr'}>
      <header className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-foreground">
            <Brain className="w-5 h-5 text-primary" />
            <span>{isAr ? 'ليرن إيبِل' : 'LearnAble'}</span>
            <span className="text-xs text-muted-foreground font-normal">{isAr ? 'بوابة الإدارة' : 'Admin Portal'}</span>
          </div>
          <div className="flex items-center gap-3">
            {me && <span className="text-xs text-muted-foreground hidden sm:inline">{me.email}</span>}
            <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground hover:text-destructive">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { icon: Users,     label: isAr ? 'إجمالي المستخدمين' : 'Total Users',       val: '6',  color: 'text-primary' },
            { icon: CheckCircle, label: isAr ? 'المستخدمون النشطون' : 'Active Users',   val: '4',  color: 'text-secondary' },
            { icon: Shield,    label: isAr ? 'طلبات معلّقة' : 'Pending Approvals',      val: '1',  color: 'text-accent' },
            { icon: Shield,    label: isAr ? 'علماء النفس' : 'Psychologists',           val: '0',  color: 'text-accent' },
          ].map((s, i) => (
            <Card key={i}><CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
                <s.icon className="w-3.5 h-3.5" /> {s.label}
              </div>
              <p className={`text-3xl font-bold ${s.color}`}>{s.val}</p>
            </CardContent></Card>
          ))}
        </div>

        {/* Pending psychologists */}
        {pendingPsychologists.length > 0 && (
          <div className="mb-6">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-accent" />
              {isAr ? 'طلبات موافقة علماء النفس' : 'Pending Psychologist Approvals'}
            </h2>
            {pendingPsychologists.map((u, i) => (
              <Card key={i} className="border-accent/40">
                <CardContent className="pt-4 pb-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-foreground">{u.name}</span>
                      <Badge className="bg-accent/10 text-accent text-xs">psychologist</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Email: {u.email}</p>
                    <p className="text-xs text-muted-foreground">{isAr ? 'التقديم:' : 'Applied:'} {u.joined}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5" /> {isAr ? 'موافقة' : 'Approve'}
                    </Button>
                    <Button size="sm" variant="destructive" className="gap-1.5">
                      ✕ {isAr ? 'رفض' : 'Reject'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* User management */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-foreground">{isAr ? 'إدارة المستخدمين' : 'User Management'}</h2>
          <Button size="sm" className="gap-1.5">
            <UserPlus className="w-4 h-4" /> {isAr ? 'إضافة مستخدم' : 'Add New User'}
          </Button>
        </div>

        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground ${isAr ? 'right-3' : 'left-3'}`} />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isAr ? 'ابحث بالاسم أو البريد...' : 'Search by name or email...'}
              className={isAr ? 'pr-9' : 'pl-9'}
            />
          </div>
          <select className="rounded-lg border border-border bg-card text-foreground text-sm px-3 py-2">
            <option>{isAr ? 'كل الأدوار' : 'All Roles'}</option>
            <option>student</option>
            <option>teacher</option>
            <option>parent</option>
            <option>psychologist</option>
          </select>
        </div>

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  {['Name', 'Email', 'Role', 'Status', 'Joined', 'Actions'].map((h) => (
                    <th key={h} className="text-start px-4 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, i) => (
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium text-foreground">{u.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <Badge className={`text-xs ${ROLE_COLORS[u.role] || 'bg-muted text-muted-foreground'}`}>{u.role}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 text-xs ${u.status === 'Active' ? 'text-secondary' : 'text-accent'}`}>
                        {u.status === 'Active' ? <CheckCircle className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.joined}</td>
                    <td className="px-4 py-3">
                      <Button variant="outline" size="sm" className="text-xs h-7">
                        {u.status === 'Active' ? (isAr ? 'تعطيل' : 'Deactivate') : (isAr ? 'تفعيل' : 'Activate')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
    </div>
  );
}
