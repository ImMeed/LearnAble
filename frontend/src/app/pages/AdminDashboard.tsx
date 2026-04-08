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

  return (
    <DashboardShell title={t("dashboards.admin.title")} subtitle={t("dashboards.admin.subtitle")}>
      <section className="metrics-grid">
        <article className="card metric-pill">
          <p>{t("dashboards.admin.totalUsers")}</p>
          <strong>6</strong>
        </article>
        <article className="card metric-pill">
          <p>{t("dashboards.admin.activeUsers")}</p>
          <strong>4</strong>
        </article>
        <article className="card metric-pill">
          <p>{t("dashboards.admin.pendingApprovals")}</p>
          <strong>{reports.filter((report) => report.status !== "DISMISSED").length}</strong>
        </article>
        <article className="card metric-pill">
          <p>{t("dashboards.admin.psychologists")}</p>
          <strong>{spaces.length}</strong>
        </article>
      </section>

      <section className="card portal-main-card">
        <div className="request-head-row">
          <h3>{t("dashboards.admin.pendingPsychApprovals")}</h3>
          <p className="muted">{profile?.email ?? t("dashboards.common.none")}</p>
        </div>
        <div className="stack-list">
          {reports.slice(0, 2).map((report) => (
            <article className="request-card" key={report.id}>
              <div>
                <strong>{report.id}</strong>
                <p>{t("dashboards.admin.reportReason", { reason: report.reason })}</p>
                <p className="muted">{t("dashboards.admin.reportType", { type: report.target_type })}</p>
              </div>
              <div className="inline-actions">
                <button type="button" onClick={() => void moderateReport(report.id, "RESTORE")}>
                  {t("dashboards.admin.approve")}
                </button>
                <button type="button" className="secondary" onClick={() => void moderateReport(report.id, "REMOVE")}>
                  {t("dashboards.admin.reject")}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="card portal-main-card">
        <div className="request-head-row">
          <h3>{t("dashboards.admin.userManagement")}</h3>
          <button type="button">{t("dashboards.admin.addUser")}</button>
        </div>

        <div className="inline-actions checkpoint-block">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("dashboards.admin.searchPlaceholder")}
          />
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
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
                <td>{row.role === "STUDENT" ? roleLabels.STUDENT : roleLabels.TEACHER}</td>
                <td>{row.status}</td>
                <td>{row.joined}</td>
                <td>
                  <button type="button" className="secondary">
                    {t("dashboards.admin.deactivate")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <p className="status-line">{status || t("dashboards.common.idle")}</p>
      </section>
    </DashboardShell>
  );
}
