import { ReactElement } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { getInitialLocale } from "../../app/locale";
import { getSession } from "../../state/auth";

type ProtectedRouteProps = {
  children: ReactElement;
  roles?: string[];
};

export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const location = useLocation();
  const session = getSession();
  const localePrefix = getInitialLocale(location.pathname) === "en" ? "/en" : "/ar";

  if (!session?.accessToken) {
    return <Navigate to={`${localePrefix}/login`} replace state={{ from: location.pathname }} />;
  }

  if (roles && roles.length > 0 && !roles.includes(session.role)) {
    return <Navigate to={`${localePrefix}/login`} replace state={{ from: location.pathname }} />;
  }

  return children;
}
