import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, GraduationCap, Check, X } from 'lucide-react';

import { Button } from '../../app/components/ui/button';
import { Input } from '../../app/components/ui/input';
import { Label } from '../../app/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '../../app/components/ui/card';
import { LanguageSwitcher } from '../../features/accessibility/LanguageSwitcher';
import { useAuth } from '../../hooks/useAuth';
import type { UserRole } from '../../api/auth';

const ROLES: { value: UserRole; labelAr: string; labelEn: string }[] = [
  { value: 'ROLE_STUDENT', labelAr: 'طالب', labelEn: 'Student' },
  { value: 'ROLE_TUTOR', labelAr: 'أستاذ', labelEn: 'Teacher' },
  { value: 'ROLE_PARENT', labelAr: 'ولي أمر', labelEn: 'Parent' },
];

function PasswordRule({ met, label }: { met: boolean; label: string }) {
  return (
    <span className={`flex items-center gap-1 text-xs ${met ? 'text-secondary' : 'text-muted-foreground'}`}>
      {met ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
      {label}
    </span>
  );
}

export function RegisterPage() {
  const { i18n } = useTranslation();
  const isAr = i18n.resolvedLanguage === 'ar';
  const localePrefix = useMemo(() => (isAr ? '/ar' : '/en'), [isAr]);
  const navigate = useNavigate();
  const { register } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>('ROLE_STUDENT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()\-_=+\[\]{};:'",.<>/?\\|`~]/.test(password);
  const hasLength = password.length >= 8;
  const passwordsMatch = password === confirmPassword;

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!passwordsMatch) {
      setError(isAr ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await register(email, password, role);
      navigate(localePrefix + '/dashboard');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string; detail?: unknown } } };
      const detail = e.response?.data?.detail;
      const msg = e.response?.data?.message;
      if (Array.isArray(detail)) {
        setError((detail as { msg: string }[])[0]?.msg || (isAr ? 'حدث خطأ.' : 'Registration failed.'));
      } else {
        setError(msg || (isAr ? 'حدث خطأ. حاول مرة أخرى.' : 'Registration failed. Try again.'));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex justify-end p-4">
        <LanguageSwitcher />
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-3">
              <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
                <GraduationCap className="text-white w-6 h-6" />
              </div>
            </div>
            <CardTitle className="text-2xl font-semibold text-foreground">
              {isAr ? 'إنشاء حساب جديد' : 'Create an Account'}
            </CardTitle>
            <p className="text-muted-foreground text-sm mt-1">
              {isAr ? 'انضم إلى منصة ليرن إيبِل' : 'Join the LearnAble platform'}
            </p>
          </CardHeader>

          <CardContent className="pt-4">
            <form onSubmit={handleRegister} className="flex flex-col gap-4">
              {/* Role selector */}
              <div className="flex flex-col gap-1.5">
                <Label>{isAr ? 'نوع الحساب' : 'Account Type'}</Label>
                <div className="grid grid-cols-3 gap-2">
                  {ROLES.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setRole(r.value)}
                      className={`rounded-lg border py-2.5 px-3 text-sm font-medium transition-all ${
                        role === r.value
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card text-foreground border-border hover:border-primary/50'
                      }`}
                    >
                      {isAr ? r.labelAr : r.labelEn}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">{isAr ? 'البريد الإلكتروني' : 'Email'}</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={isAr ? 'أدخل بريدك الإلكتروني' : 'Enter your email'}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">{isAr ? 'كلمة المرور' : 'Password'}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isAr ? 'أدخل كلمة المرور' : 'Create a password'}
                    required
                    className={isAr ? 'pl-10' : 'pr-10'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground ${isAr ? 'left-3' : 'right-3'}`}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {password && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                    <PasswordRule met={hasLength} label={isAr ? '8 أحرف' : '8+ chars'} />
                    <PasswordRule met={hasUpper} label={isAr ? 'حرف كبير' : 'Uppercase'} />
                    <PasswordRule met={hasDigit} label={isAr ? 'رقم' : 'Number'} />
                    <PasswordRule met={hasSpecial} label={isAr ? 'رمز خاص' : 'Special char'} />
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirm">{isAr ? 'تأكيد كلمة المرور' : 'Confirm Password'}</Label>
                <Input
                  id="confirm"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={isAr ? 'أعد إدخال كلمة المرور' : 'Repeat your password'}
                  required
                  aria-invalid={confirmPassword.length > 0 && !passwordsMatch}
                />
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="text-destructive text-xs">{isAr ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.'}</p>
                )}
              </div>

              {error && <p className="text-destructive text-sm text-center">{error}</p>}

              <Button
                type="submit"
                className="w-full mt-2"
                disabled={loading || !passwordsMatch || !hasUpper || !hasDigit || !hasSpecial || !hasLength}
              >
                {loading ? (isAr ? 'جارٍ الإنشاء...' : 'Creating account...') : (isAr ? 'إنشاء الحساب' : 'Create Account')}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                {isAr ? 'لديك حساب بالفعل؟' : 'Already have an account?'}{' '}
                <Link to={localePrefix + '/login'} className="text-primary hover:underline font-medium">
                  {isAr ? 'تسجيل الدخول' : 'Sign In'}
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
