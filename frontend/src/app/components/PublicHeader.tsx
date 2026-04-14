import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";

import { BrandLogo } from "./BrandLogo";
import { getInitialLocale } from "../locale";
import { cx } from "./uiStyles";

type PublicHeaderProps = {
  actions?: ReactNode;
  className?: string;
};

export function PublicHeader({ actions, className }: PublicHeaderProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const prefix = getInitialLocale(location.pathname) === "en" ? "/en" : "/ar";

  return (
    <header className={cx("border-b border-border bg-card backdrop-blur", className)}>
      <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-4 px-4 py-4 sm:gap-5 sm:px-6 sm:py-5 lg:px-8">
        <Link
          className="inline-flex shrink-0 items-center gap-3 text-[34px] font-semibold tracking-[-0.04em] leading-none text-foreground"
          to={prefix}
        >
          <BrandLogo className="shrink-0 text-primary" size={36} />
          <span>{t("appTitle")}</span>
        </Link>

        {actions ? (
          <div className="ml-auto flex min-w-0 flex-1 items-center justify-end">
            <div className="flex flex-wrap items-center justify-end gap-3">{actions}</div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
