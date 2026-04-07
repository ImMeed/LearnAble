import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Brain, User, Lock } from 'lucide-react';

import { Button } from '../../app/components/ui/button';
import { Input } from '../../app/components/ui/input';
import { Label } from '../../app/components/ui/label';
import { Card, CardContent } from '../../app/components/ui/card';
import { LanguageSwitcher } from '../../features/accessibility/LanguageSwitcher';
import { useAuth } from '../../hooks/useAuth';
import type { UserRole } from '../../api/auth';

type RoleOption = { value: UserRole | 'ROLE_ADMIN'; emoji: string; labelEn: string; labelAr: string };

const ROLES: RoleOption[] = [
  { value: 'ROLE_STUDENT', emoji: '🎓', labelEn: 'Student', labelAr: 'طالب' },
  { value: 'ROLE_TUTOR',   emoji: '👨‍🏫', labelEn: 'Teacher', labelAr: 'أستاذ' },
  { value: 'ROLE_PARENT',  emoji: '👨‍👩‍👦', labelEn: 'Parent',  labelAr: 'ولي أمر' },
  { value: 'ROLE_ADMIN',   emoji: '🔒', labelEn: 'Admin',   labelAr: 'مسؤول' },
];

export function LoginPage() {
  const { i18n } = useTranslation();
  const isAr = i18n.resolvedLanguage === 'ar';
  const localePrefix = useMemo(() => (isAr ? '/ar' : '/en'), [isAr]);
  const navigate = useNavigate();
  const { login, loginWithOTP, navigateAfterLogin } = useAuth();

  const [selectedRole, setSelectedRole] = useState<string>('ROLE_STUDENT');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.totp_required) {
        setStep('otp');
      } else if (result.role) {
        navigateAfterLogin(result.role);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || (isAr ? 'بيانات غير صحيحة.' : 'Invalid credentials.'));
    } finally {
      setLoading(false);
    }
  }

  async function handleOTP(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginWithOTP(email, otpCode);
      navigate(localePrefix + '/dashboard');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || (isAr ? 'رمز غير صحيح.' : 'Invalid OTP code.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <Link to={localePrefix + '/'} className="flex items-center gap-2 font-bold text-foreground">
          <Brain className="w-5 h-5 text-primary" />
          <span>{isAr ? 'ليرن إيبِل' : 'LearnAble'}</span>
        </Link>
        <LanguageSwitcher />
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-bold text-foreground text-center mb-1">
            {isAr ? 'مرحباً بعودتك' : 'Welcome Back'}
          </h1>
          <p className="text-muted-foreground text-center mb-8">
            {isAr ? 'سجّل دخولك لمواصلة التعلّم' : 'Sign in to continue learning'}
          </p>

          <Card className="shadow-sm">
            <CardContent className="pt-6 pb-6">
              {step === 'credentials' ? (
                <form onSubmit={handleLogin} className="flex flex-col gap-5">
                  {/* Role selector */}
                  <div>
                    <p className="text-sm font-medium text-foreground mb-3">{isAr ? 'أنا...' : 'I am a...'}</p>
                    <div className="grid grid-cols-2 gap-3">
                      {ROLES.map((r) => (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => setSelectedRole(r.value)}
                          className={`flex flex-col items-center gap-2 rounded-xl border py-4 px-3 text-sm font-medium transition-all ${
                            selectedRole === r.value
                              ? 'border-primary bg-primary/5 text-foreground'
                              : 'border-border bg-card text-muted-foreground hover:border-primary/40'
                          }`}
                        >
                          <span className="text-2xl">{r.emoji}</span>
                          <span>{isAr ? r.labelAr : r.labelEn}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Username */}
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="email">{isAr ? 'اسم المستخدم' : 'Username'}</Label>
                    <div className="relative">
                      <User className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground ${isAr ? 'right-3' : 'left-3'}`} />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={isAr ? 'أدخل بريدك الإلكتروني' : 'Enter your username'}
                        className={isAr ? 'pr-9' : 'pl-9'}
                        required
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="password">{isAr ? 'كلمة المرور' : 'Password'}</Label>
                    <div className="relative">
                      <Lock className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground ${isAr ? 'right-3' : 'left-3'}`} />
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={isAr ? 'أدخل كلمة المرور' : 'Enter your password'}
                        className={isAr ? 'pr-9' : 'pl-9'}
                        required
                      />
                    </div>
                  </div>

                  {error && <p className="text-destructive text-sm text-center">{error}</p>}

                  <Button type="submit" className="w-full rounded-xl h-11" disabled={loading}>
                    {loading ? (isAr ? 'جارٍ الدخول...' : 'Signing in...') : (isAr ? 'تسجيل الدخول' : 'Sign In')}
                  </Button>

                  <p className="text-center text-sm text-muted-foreground">
                    <Link to="#" className="text-primary hover:underline">
                      {isAr ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
                    </Link>
                    {' • '}
                    <Link to={localePrefix + '/register'} className="text-primary hover:underline">
                      {isAr ? 'إنشاء حساب' : 'Create account'}
                    </Link>
                  </p>
                </form>
              ) : (
                <form onSubmit={handleOTP} className="flex flex-col gap-5">
                  <p className="text-sm text-muted-foreground text-center">
                    {isAr ? 'أدخل رمز التحقق من تطبيق المصادقة.' : 'Enter the 6-digit code from your authenticator app.'}
                  </p>
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="text-center text-2xl tracking-widest h-14"
                    required
                  />
                  {error && <p className="text-destructive text-sm text-center">{error}</p>}
                  <Button type="submit" className="w-full rounded-xl h-11" disabled={loading || otpCode.length !== 6}>
                    {loading ? '...' : (isAr ? 'تأكيد' : 'Verify')}
                  </Button>
                  <button type="button" className="text-sm text-muted-foreground text-center hover:text-foreground" onClick={() => { setStep('credentials'); setError(''); }}>
                    ← {isAr ? 'رجوع' : 'Back'}
                  </button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
