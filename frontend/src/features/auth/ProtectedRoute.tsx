import { ReactElement } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { getPathLocale } from "../../app/locale";
import { DEFAULT_PLATFORM_TRACK, getSession } from "../../state/auth";

type ProtectedRouteProps = {
  children: ReactElement;
  roles?: string[];
  loginPath?: string;
  platformTracks?: string[];
};

export function ProtectedRoute({ children, roles, loginPath, platformTracks }: ProtectedRouteProps) {
  const location = useLocation();
  const session = getSession();
  const localePrefix = getPathLocale(location.pathname) === "en" ? "/en" : "/ar";
  const targetLogin = loginPath ? `${localePrefix}${loginPath}` : `${localePrefix}/login`;

  if (!session?.accessToken) {
    return <Navigate to={targetLogin} replace state={{ from: location.pathname }} />;
  }

  if (roles && roles.length > 0 && !roles.includes(session.role)) {
    return <Navigate to={targetLogin} replace state={{ from: location.pathname }} />;
  }

  const sessionTrack = session.platformTrack ?? DEFAULT_PLATFORM_TRACK;
  if (platformTracks && platformTracks.length > 0 && !platformTracks.includes(sessionTrack)) {
    return <Navigate to={targetLogin} replace state={{ from: location.pathname }} />;
  }

  return children;
}
