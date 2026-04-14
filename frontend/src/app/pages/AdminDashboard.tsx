import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { apiClient } from "../../api/client";
import {
  DashboardShell,
  errorMessage,
  ForumReport,
  ForumSpace,
  localeRequestConfig,
  Profile,
} from "./roleDashboardShared";

export function AdminDashboardPageV2() {
  const { t, i18n } = useTranslation();
  const requestConfig = useMemo(() => localeRequestConfig(i18n.resolvedLanguage), [i18n.resolvedLanguage]);

  const [status, setStatus] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [spaces, setSpaces] = useState<ForumSpace[]>([]);
  const [reports, setReports] = useState<ForumReport[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");

  const roleLabels = useMemo(
    () => ({
      STUDENT: t("dashboards.admin.roleStudent"),
      TEACHER: t("dashboards.admin.roleTeacher"),
    }),
    [t],
  );

  const userRows = useMemo(
    () => [
      {
        id: "u1",
        name: t("dashboards.admin.user1"),
        email: "alex@student.com",
        role: "STUDENT",
        status: t("dashboards.admin.statusActive"),
        joined: "1/15/2026",
      },
      {
        id: "u2",
        name: t("dashboards.admin.user2"),
        email: "maria@student.com",
        role: "STUDENT",
        status: t("dashboards.admin.statusActive"),
        joined: "1/20/2026",
      },
      {
        id: "u3",
        name: t("dashboards.admin.user3"),
        email: "sarah@teacher.com",
        role: "TEACHER",
        status: t("dashboards.admin.statusActive"),
        joined: "12/10/2025",
      },
    ],
    [t],
  );

  const filteredRows = userRows.filter((row) => {
    const roleMatched = roleFilter === "ALL" || row.role === roleFilter;
    const query = search.trim().toLowerCase();
    const searchMatched = !query || `${row.name} ${row.email}`.toLowerCase().includes(query);
    return roleMatched && searchMatched;
  });

  const loadAll = async () => {
    setStatus(t("dashboards.common.loading"));
    try {
      const [profileRes, spacesRes, reportsRes] = await Promise.all([
        apiClient.get<Profile>("/me", requestConfig),
        apiClient.get<{ items: ForumSpace[] }>("/forum/spaces", requestConfig),
        apiClient.get<{ items: ForumReport[] }>("/forum/reports?only_open=false", requestConfig),
      ]);

      setProfile(profileRes.data);
      setSpaces(spacesRes.data.items || []);
      setReports(reportsRes.data.items || []);
      setStatus(t("dashboards.admin.loaded"));
    } catch (error) {
      setStatus(errorMessage(error));
    }
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.resolvedLanguage]);

  const moderateReport = async (reportId: string, action: "HIDE" | "RESTORE" | "REMOVE" | "DISMISS") => {
    try {
      await apiClient.post(
        `/forum/reports/${reportId}/moderate`,
        {
          action,
          review_notes: t("dashboards.admin.moderationNote"),
        },
        requestConfig,
      );
      setStatus(t("dashboards.admin.reportUpdated"));
      await loadAll();
    } catch (error) {
      setStatus(errorMessage(error));
    }
  };

  const ROLE_BADGE_COLORS: Record<string, string> = {
    STUDENT: "badge-student",
    TEACHER: "badge-teacher",
    PARENT: "badge-parent",
    PSYCHOLOGIST: "badge-psych",
    ADMIN: "badge-admin",
  };

  const pendingPsychologist = {
    name: "Dr. Emma Smith",
    role: "psychologist",
    email: "emma@psych.com",
    applied: "20/03/2026",
  };

  return (
    <DashboardShell title={t("dashboards.admin.title")} subtitle={t("dashboards.admin.subtitle")}>
      <div className="admin-stats-row">
        <article className="admin-stat-card stat-blue">
          <span className="admin-stat-icon">👤</span>
          <div>
            <p className="admin-stat-label">{t("dashboards.admin.totalUsers")}</p>
            <p className="admin-stat-value admin-val-blue">6</p>
          </div>
        </article>
        <article className="admin-stat-card stat-green">
          <span className="admin-stat-icon">✅</span>
          <div>
            <p className="admin-stat-label">{t("dashboards.admin.activeUsers")}</p>
            <p className="admin-stat-value admin-val-green">4</p>
          </div>
        </article>
        <article className="admin-stat-card stat-purple">
          <span className="admin-stat-icon">🛡️</span>
          <div>
            <p className="admin-stat-label">{t("dashboards.admin.pendingApprovals")}</p>
            <p className="admin-stat-value admin-val-purple">{reports.filter((r) => r.status !== "DISMISSED").length || 1}</p>
          </div>
        </article>
        <article className="admin-stat-card stat-purple2">
          <span className="admin-stat-icon">🧠</span>
          <div>
            <p className="admin-stat-label">{t("dashboards.admin.psychologists")}</p>
            <p className="admin-stat-value admin-val-purple">{spaces.length}</p>
          </div>
        </article>
      </div>

      <section className="admin-approval-section">
        <h3 className="admin-section-title">
          <span>🛡️</span> {t("dashboards.admin.pendingPsychApprovals")}
        </h3>
        <article className="admin-approval-card">
          <div className="admin-approval-info">
            <div className="admin-approval-name-row">
              <strong>{pendingPsychologist.name}</strong>
              <span className="role-badge badge-psych">{pendingPsychologist.role}</span>
            </div>
            <p className="admin-approval-meta">Email: {pendingPsychologist.email}</p>
            <p className="admin-approval-meta">Applied: {pendingPsychologist.applied}</p>
          </div>
          <div className="admin-approval-actions">
            {reports.slice(0, 1).map((report) => (
              <div key={report.id} className="inline-actions">
                <button
                  type="button"
                  className="btn-approve"
                  onClick={() => void moderateReport(report.id, "RESTORE")}
                >
                  ✓ {t("dashboards.admin.approve")}
                </button>
                <button
                  type="button"
                  className="btn-reject"
                  onClick={() => void moderateReport(report.id, "REMOVE")}
                >
                  ✕ {t("dashboards.admin.reject")}
                </button>
              </div>
            ))}
            {reports.length === 0 && (
              <div className="inline-actions">
                <button type="button" className="btn-approve">✓ {t("dashboards.admin.approve")}</button>
                <button type="button" className="btn-reject">✕ {t("dashboards.admin.reject")}</button>
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="card portal-main-card">
        <div className="admin-um-header">
          <h3>{t("dashboards.admin.userManagement")}</h3>
          <button type="button" className="btn-primary btn-add-user">
            👤+ {t("dashboards.admin.addUser")}
          </button>
        </div>

        <div className="admin-um-filters">
          <div className="admin-search-wrap">
            <span className="admin-search-icon">🔍</span>
            <input
              className="admin-search-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("dashboards.admin.searchPlaceholder")}
            />
          </div>
          <select
            className="admin-role-filter"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
          >
            <option value="ALL">{t("dashboards.admin.allRoles")}</option>
            <option value="STUDENT">{roleLabels.STUDENT}</option>
            <option value="TEACHER">{roleLabels.TEACHER}</option>
          </select>
        </div>

        <table className="admin-table checkpoint-block">
          <thead>
            <tr>
              <th>{t("dashboards.admin.colName")}</th>
              <th>{t("dashboards.admin.colEmail")}</th>
              <th>{t("dashboards.admin.colRole")}</th>
              <th>{t("dashboards.admin.colStatus")}</th>
              <th>{t("dashboards.admin.colJoined")}</th>
              <th>{t("dashboards.admin.colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.email}</td>
                <td>
                  <span className={`role-badge ${ROLE_BADGE_COLORS[row.role] ?? "badge-student"}`}>
                    {row.role === "STUDENT" ? roleLabels.STUDENT : roleLabels.TEACHER}
                  </span>
                </td>
                <td>
                  <span className="status-active">✓ {row.status}</span>
                </td>
                <td>{row.joined}</td>
                <td>
                  <button type="button" className="btn-outline btn-deactivate">
                    {t("dashboards.admin.deactivate")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {status ? (
        <section className="card">
          <p className="status-line">{status}</p>
        </section>
      ) : null}
    </DashboardShell>
  );
}
