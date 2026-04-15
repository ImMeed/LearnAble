import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { BrandLogo } from "./BrandLogo";
import { AccessibilityToolbar } from "./AccessibilityToolbar";
import { CompactLanguageSwitcher } from "./CompactLanguageSwitcher";
import { getInitialLocale } from "../locale";
import { clearSession, getSession } from "../../state/auth";
import { actionClass, cx } from "./uiStyles";

type PublicHeaderProps = {
  actions?: ReactNode;
  className?: string;
  logoClassName?: string;
};

type JwtPayload = {
  email?: string;
};

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    const json = atob(padded);

    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

function roleChip(role: string): { icon: string; labelKey: string; profilePath: string } {
  switch (role) {
    case "ROLE_STUDENT":
      return { icon: "🎓", labelKey: "header.accountMenu.roles.student", profilePath: "/student/dashboard" };
    case "ROLE_TUTOR":
      return { icon: "📘", labelKey: "header.accountMenu.roles.tutor", profilePath: "/teacher/dashboard" };
    case "ROLE_PARENT":
      return { icon: "👨‍👩‍👧", labelKey: "header.accountMenu.roles.parent", profilePath: "/parent/dashboard" };
    case "ROLE_PSYCHOLOGIST":
      return { icon: "🧠", labelKey: "header.accountMenu.roles.psychologist", profilePath: "/psychologist/dashboard" };
    case "ROLE_ADMIN":
      return { icon: "🛡️", labelKey: "header.accountMenu.roles.admin", profilePath: "/admin/dashboard" };
    default:
      return { icon: "👤", labelKey: "header.accountMenu.roles.account", profilePath: "/home" };
  }
}

export function PublicHeader({ actions, className, logoClassName }: PublicHeaderProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const prefix = getInitialLocale(location.pathname) === "en" ? "/en" : "/ar";
  const session = getSession();
  const email = session?.accessToken ? decodeJwtPayload(session.accessToken)?.email ?? t("common.signedInUser") : "";
  const chip = session ? roleChip(session.role) : null;
  const profileHref = chip ? `${prefix}${chip.profilePath}` : `${prefix}/home`;
  const logoHref = session?.accessToken ? `${prefix}/home` : "/";

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const handleLogout = () => {
    clearSession();
    setMenuOpen(false);
    navigate("/", { replace: true });
  };

  return (
    <header className={cx("border-b border-border bg-card backdrop-blur", className)}>
      <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-4 px-4 py-4 sm:gap-5 sm:px-6 sm:py-5 lg:px-8">
        <Link
          className="inline-flex shrink-0 items-center gap-3 text-[34px] font-semibold tracking-[-0.04em] leading-none text-foreground"
          to={logoHref}
        >
          <BrandLogo className={cx("shrink-0 text-primary", logoClassName)} size={36} />
          <span>{t("appTitle")}</span>
        </Link>

        {session?.accessToken ? (
          <div className="ms-auto flex min-w-0 flex-1 items-center justify-end">
            <div className="flex flex-wrap items-center justify-end gap-3">
              <CompactLanguageSwitcher />
              <AccessibilityToolbar />
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  className="inline-flex min-h-11 max-w-full items-center gap-3 rounded-[1rem] border border-border bg-background px-4 py-2 text-start shadow-[0_10px_24px_rgba(33,40,55,0.08)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(33,40,55,0.12)]"
                  onClick={() => setMenuOpen((current) => !current)}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                >
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-base">
                    {chip?.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {chip ? t(chip.labelKey) : ""}
                    </span>
                    <span className="block max-w-[16rem] truncate text-sm font-medium text-foreground">{email}</span>
                  </span>
                  <ChevronDown className={cx("h-4 w-4 shrink-0 text-muted-foreground transition", menuOpen && "rotate-180")} />
                </button>

                {menuOpen ? (
                  <div
                    className="absolute end-0 top-[calc(100%+0.75rem)] z-20 min-w-[12rem] rounded-[1rem] border border-border bg-card p-2 shadow-[0_18px_36px_rgba(33,40,55,0.16)]"
                    role="menu"
                  >
                    <Link
                      className="block rounded-[0.85rem] px-3 py-2 text-start text-sm font-medium text-foreground transition hover:bg-background"
                      to={profileHref}
                      onClick={() => setMenuOpen(false)}
                      role="menuitem"
                    >
                      {t("header.accountMenu.profile")}
                    </Link>
                    <button
                      type="button"
                      className="block w-full rounded-[0.85rem] px-3 py-2 text-start text-sm font-medium text-foreground transition hover:bg-background"
                      onClick={handleLogout}
                      role="menuitem"
                    >
                      {t("header.accountMenu.logout")}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : actions ? (
          <div className="ms-auto flex min-w-0 flex-1 items-center justify-end">
            <div className="flex flex-wrap items-center justify-end gap-3">{actions}</div>
          </div>
        ) : location.pathname.endsWith("/login") || location.pathname === "/login" ? (
          <div className="ms-auto flex min-w-0 flex-1 items-center justify-end">
            <div className="flex flex-wrap items-center justify-end gap-3">
              <CompactLanguageSwitcher />
              <AccessibilityToolbar />
              <Link className={actionClass("ghost")} to={prefix}>
                {t("common.back")}
              </Link>
            </div>
          </div>
        ) : (
          <div className="ms-auto flex min-w-0 flex-1 items-center justify-end">
            <div className="flex flex-wrap items-center justify-end gap-3">
              <CompactLanguageSwitcher />
              <AccessibilityToolbar />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
