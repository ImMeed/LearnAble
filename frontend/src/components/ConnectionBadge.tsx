import React from "react";
import { useTranslation } from "react-i18next";
import { ConnectionQuality } from "../hooks/useConnectionQuality";

interface ConnectionBadgeProps {
  quality: ConnectionQuality;
}

export function ConnectionBadge({ quality }: ConnectionBadgeProps) {
  const { t } = useTranslation();

  if (!quality) return null;

  return (
    <div className="connection-badge">
      <div className={`connection-badge__dot connection-badge__dot--${quality}`} />
      <span>{t(`call.connectionQuality.${quality}`)}</span>
    </div>
  );
}
