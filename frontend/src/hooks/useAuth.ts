import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';

import { login as apiLogin, loginWithOTP as apiLoginWithOTP, register as apiRegister, UserRole } from '../api/auth';
import { getSession, setSession, clearSession } from '../state/auth';

function dashboardForRole(role: string, prefix: string): string {
  switch (role) {
    case 'ROLE_TUTOR':         return `${prefix}/teacher`;
    case 'ROLE_PARENT':        return `${prefix}/parent`;
    case 'ROLE_PSYCHOLOGIST':  return `${prefix}/psychologist`;
    case 'ROLE_ADMIN':         return `${prefix}/admin`;
    case 'ROLE_STUDENT':
    default:                   return `${prefix}/dashboard`;
  }
}

export function useAuth() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const localePrefix = useMemo(() => (i18n.resolvedLanguage === 'ar' ? '/ar' : '/en'), [i18n.resolvedLanguage]);
  const session = getSession();

  async function login(email: string, password: string): Promise<{ totp_required: boolean; role?: string }> {
    const data = await apiLogin(email, password);
    if (data.totp_required) {
      return { totp_required: true };
    }
    setSession({ accessToken: data.access_token, role: data.role });
    return { totp_required: false, role: data.role };
  }

  async function loginWithOTP(email: string, otp: string): Promise<void> {
    const data = await apiLoginWithOTP(email, otp);
    setSession({ accessToken: data.access_token, role: data.role });
    navigate(dashboardForRole(data.role, localePrefix));
  }

  async function register(email: string, password: string, role: UserRole): Promise<void> {
    const data = await apiRegister(email, password, role);
    setSession({ accessToken: data.access_token, role: data.role });
    // Students go through onboarding first
    if (data.role === 'ROLE_STUDENT') {
      navigate(`${localePrefix}/onboarding`);
    } else {
      navigate(dashboardForRole(data.role, localePrefix));
    }
  }

  function navigateAfterLogin(role: string): void {
    navigate(dashboardForRole(role, localePrefix));
  }

  function logout(): void {
    clearSession();
    navigate(localePrefix + '/');
  }

  return {
    session,
    isAuthenticated: !!session,
    login,
    loginWithOTP,
    register,
    navigateAfterLogin,
    logout,
  };
}
