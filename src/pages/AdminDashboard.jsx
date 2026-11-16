import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiActivity,
  FiClock,
  FiFileText,
  FiMonitor,
  FiRefreshCw,
  FiShield,
  FiUserCheck,
  FiUsers,
} from "react-icons/fi";
import "./AdminDashboard.css";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

const EMPTY_DASHBOARD = {
  users: { total: 0, producers: 0, admins: 0, recent: 0 },
  projects: {
    total: 0,
    draft: 0,
    published: 0,
    environmental: 0,
    social: 0,
    governance: 0,
  },
  monitors: { total: 0, online: 0, offline: 0 },
  recentUsers: [],
  recentMonitors: [],
};

async function readJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    await response.text();
    throw new Error(`Server returned a non-JSON response (${response.status}).`);
  }

  return response.json();
}

function formatDate(value, includeTime = false) {
  if (!value) return "Never";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  return new Intl.DateTimeFormat("en-SG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(includeTime
      ? {
          hour: "2-digit",
          minute: "2-digit",
        }
      : {}),
  }).format(date);
}

function getPercentage(value, total) {
  if (!total) return 0;
  return Math.round((Number(value || 0) / Number(total)) * 100);
}

function StatCard({ label, value, helper, icon, tone, onClick }) {
  const content = (
    <>
      <span className={`admin-stat-card__icon admin-stat-card__icon--${tone}`}>
        {icon}
      </span>
      <div>
        <p className="admin-stat-card__label">{label}</p>
        <strong>{Number(value || 0).toLocaleString()}</strong>
        <span className="admin-stat-card__helper">{helper}</span>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className="admin-stat-card admin-stat-card--button" onClick={onClick}>
        {content}
      </button>
    );
  }

  return <article className="admin-stat-card">{content}</article>;
}

function ProgressRow({ label, value, total, tone }) {
  const percentage = getPercentage(value, total);

  return (
    <div className="admin-progress-row">
      <div className="admin-progress-row__header">
        <span>{label}</span>
        <strong>
          {Number(value || 0)} <small>({percentage}%)</small>
        </strong>
      </div>
      <div className="admin-progress-track" aria-label={`${label}: ${percentage}%`}>
        <span
          className={`admin-progress-fill admin-progress-fill--${tone}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const safeStatus = String(status || "offline").toLowerCase();
  return <span className={`admin-status admin-status--${safeStatus}`}>{safeStatus}</span>;
}

function CategoryBadge({ category }) {
  const safeCategory = String(category || "unknown").toLowerCase();
  return (
    <span className={`admin-category admin-category--${safeCategory}`}>
      {safeCategory}
    </span>
  );
}

function AdminDashboard() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(EMPTY_DASHBOARD);
  const [username, setUsername] = useState("Admin");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [clientIp, setClientIp] = useState("");

  const loadDashboard = useCallback(
    async ({ refresh = false } = {}) => {
      refresh ? setRefreshing(true) : setLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_BASE_URL}/api/admin/dashboard`, {
          method: "GET",
          credentials: "include",
          headers: { Accept: "application/json" },
        });

        const data = await readJsonResponse(response);

        if (response.status === 401) {
          localStorage.removeItem("user");
          navigate("/login", { replace: true });
          return;
        }

        if (response.status === 403) {
          navigate("/dashboard", { replace: true });
          return;
        }

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Unable to load the admin dashboard.");
        }

        const nextDashboard = data.dashboard || {};
        setDashboard({
          users: { ...EMPTY_DASHBOARD.users, ...(nextDashboard.users || {}) },
          projects: { ...EMPTY_DASHBOARD.projects, ...(nextDashboard.projects || {}) },
          monitors: { ...EMPTY_DASHBOARD.monitors, ...(nextDashboard.monitors || {}) },
          recentUsers: Array.isArray(nextDashboard.recentUsers)
            ? nextDashboard.recentUsers
            : [],
          recentMonitors: Array.isArray(nextDashboard.recentMonitors)
            ? nextDashboard.recentMonitors
            : [],
        });
        setUsername(data.user?.username || "Admin");

        const ipResponse = await fetch(`${API_BASE_URL}/api/admin/client-ip`, {
          credentials: "include",
        });

        const ipData = await ipResponse.json();

        setClientIp(ipData.ip || "Unknown");
      } catch (loadError) {
        console.error("Admin dashboard load error:", loadError);
        setError(loadError.message || "Unable to load the admin dashboard.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [navigate]
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const currentDate = useMemo(
    () =>
      new Intl.DateTimeFormat("en-SG", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date()),
    []
  );

  const { users, projects, monitors, recentUsers, recentMonitors } = dashboard;

  if (loading) {
    return (
      <div className="page admin-dashboard-page" aria-busy="true">
        <div className="admin-dashboard-loading">
          <FiRefreshCw className="admin-spin" aria-hidden="true" />
          <p>Loading administrator overview...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page admin-dashboard-page">
      <header className="admin-dashboard-header">
        <div>
          <span className="admin-dashboard-eyebrow">Administrator workspace</span>
          <h1>Welcome back, {username}</h1>
          <p>Here is an overview of the ESG Centre content management system.</p>
          <span className="admin-dashboard-date">{currentDate}</span>
          <span className="admin-dashboard-ipaddress">IP Address: {clientIp}</span>
        </div>

        <button
          type="button"
          className="admin-refresh-button"
          onClick={() => loadDashboard({ refresh: true })}
          disabled={refreshing}
        >
          <FiRefreshCw className={refreshing ? "admin-spin" : ""} aria-hidden="true" />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      {error && (
        <div className="admin-dashboard-error" role="alert">
          <div>
            <strong>Dashboard data could not be loaded.</strong>
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => loadDashboard()}>
            Retry
          </button>
        </div>
      )}

      <section aria-labelledby="summary-heading">
        <div className="admin-section-heading">
          <div>
            <span>System summary</span>
            <h2 id="summary-heading">At a glance</h2>
          </div>
        </div>

        <div className="admin-stats-grid">
          <StatCard
            label="Total users"
            value={users.total}
            helper="All registered accounts"
            icon={<FiUsers />}
            tone="green"
            onClick={() => navigate("/manage-users")}
          />
          <StatCard
            label="Producers"
            value={users.producers}
            helper="Content creators"
            icon={<FiUserCheck />}
            tone="blue"
            onClick={() => navigate("/manage-users")}
          />
          <StatCard
            label="Administrators"
            value={users.admins}
            helper="System managers"
            icon={<FiShield />}
            tone="purple"
            onClick={() => navigate("/manage-users")}
          />
          <StatCard
            label="New users"
            value={users.recent}
            helper="Registered in 30 days"
            icon={<FiClock />}
            tone="orange"
            onClick={() => navigate("/manage-users")}
          />

          <StatCard
            label="Published projects"
            value={projects.published}
            helper="Available for display"
            icon={<FiActivity />}
            tone="blue"
            onClick={() => navigate("/manage-projects")}
          />

          <StatCard
            label="Total displays"
            value={monitors.total}
            helper="Configured TV screens"
            icon={<FiMonitor />}
            tone="purple"
            onClick={() => navigate("/display-manager")}
          />
          <StatCard
            label="Online displays"
            value={monitors.online}
            helper="Currently connected"
            icon={<FiActivity />}
            tone="green"
            onClick={() => navigate("/display-manager")}
          />
          <StatCard
            label="Offline displays"
            value={monitors.offline}
            helper="Connection unavailable"
            icon={<FiMonitor />}
            tone="grey"
            onClick={() => navigate("/display-manager")}
          />

        </div>
      </section>

      <div className="admin-dashboard-two-column">
        <section className="admin-panel" aria-labelledby="project-status-heading">
          <div className="admin-panel__header">
            <div>
              <span>Content workflow</span>
              <h2 id="project-status-heading">Project Status Overview</h2>
            </div>
            <strong>{projects.total} projects</strong>
          </div>

          <div className="admin-progress-list">
            <ProgressRow label="Draft" value={projects.draft} total={projects.total} tone="draft" />
            <ProgressRow
              label="Published"
              value={projects.published}
              total={projects.total}
              tone="published"
            />
          </div>
        </section>

        <section className="admin-panel" aria-labelledby="category-heading">
          <div className="admin-panel__header">
            <div>
              <span>Content distribution</span>
              <h2 id="category-heading">Projects by ESG Category</h2>
            </div>
          </div>

          <div className="admin-category-grid">
            <article className="admin-category-card admin-category-card--environmental">
              <span>Environmental</span>
              <strong>{projects.environmental}</strong>
              <small>{getPercentage(projects.environmental, projects.total)}% of projects</small>
            </article>
            <article className="admin-category-card admin-category-card--social">
              <span>Social</span>
              <strong>{projects.social}</strong>
              <small>{getPercentage(projects.social, projects.total)}% of projects</small>
            </article>
            <article className="admin-category-card admin-category-card--governance">
              <span>Governance</span>
              <strong>{projects.governance}</strong>
              <small>{getPercentage(projects.governance, projects.total)}% of projects</small>
            </article>
          </div>
        </section>
      </div>

      <section className="admin-panel admin-monitor-panel" aria-labelledby="monitor-status-heading">
        <div className="admin-panel__header admin-panel__header--action">
          <div>
            <span>Display network</span>
            <h2 id="monitor-status-heading">Monitor Status</h2>
          </div>
          <button type="button" className="admin-text-button" onClick={() => navigate("/display-manager")}>
            View All Displays
          </button>
        </div>

        {recentMonitors.length === 0 ? (
          <div className="admin-empty-state">No displays have been configured.</div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Display</th>
                  <th>Category</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Last connected</th>
                </tr>
              </thead>
              <tbody>
                {recentMonitors.map((monitor) => (
                  <tr key={monitor.monitorId}>
                    <td className="admin-table__primary">{monitor.name}</td>
                    <td><CategoryBadge category={monitor.category} /></td>
                    <td>{monitor.location || "Not specified"}</td>
                    <td><StatusBadge status={monitor.status} /></td>
                    <td>{formatDate(monitor.lastConnectedAt, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-panel" aria-labelledby="recent-users-heading">
        <div className="admin-panel__header admin-panel__header--action">
          <div>
            <span>Account activity</span>
            <h2 id="recent-users-heading">Recently Registered Users</h2>
          </div>
          <button type="button" className="admin-text-button" onClick={() => navigate("/manage-users")}>
            View all
          </button>
        </div>

        {recentUsers.length === 0 ? (
          <div className="admin-empty-state">No users have registered yet.</div>
        ) : (
          <div className="admin-record-list">
            {recentUsers.map((user) => (
              <article className="admin-record" key={user.userId}>
                <div className="admin-record__avatar" aria-hidden="true">
                  {String(user.username || "U").charAt(0).toUpperCase()}
                </div>
                <div className="admin-record__main">
                  <div className="admin-record__title-row">
                    <strong>{user.username}</strong>
                    <span className={`admin-role admin-role--${user.role}`}>{user.role}</span>
                  </div>
                  <p>{user.email}</p>
                  <div className="admin-record__meta">
                    <span>Joined {formatDate(user.createdAt)}</span>
                  </div>
                </div>
                <button type="button" onClick={() => navigate("/manage-users")}>
                  Manage
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="admin-panel admin-quick-actions-panel" aria-labelledby="quick-actions-heading">
        <div className="admin-panel__header">
          <div>
            <span>Shortcuts</span>
            <h2 id="quick-actions-heading">Quick Actions</h2>
          </div>
        </div>

        <div className="admin-quick-actions">
          <button type="button" onClick={() => navigate("/manage-users")}>
            <FiUsers aria-hidden="true" />
            <span><strong>Manage Users</strong><small>Review accounts and roles</small></span>
          </button>
          <button type="button" onClick={() => navigate("/manage-projects")}>
            <FiFileText aria-hidden="true" />
            <span><strong>Manage Projects</strong><small>Review published ESG content</small></span>
          </button>
          <button type="button" onClick={() => navigate("/display-manager")}>
            <FiMonitor aria-hidden="true" />
            <span><strong>Manage Displays</strong><small>Configure screens and playlists</small></span>
          </button>
          <button type="button" onClick={() => navigate("/scheduler")}>
            <FiClock aria-hidden="true" />
            <span><strong>Power Scheduler</strong><small>Set display sleep and wake times</small></span>
          </button>
          <button type="button" onClick={() => navigate("/content-scheduler")}>
            <FiClock aria-hidden="true" />
            <span><strong>Content Scheduler</strong><small>Assign published projects to displays</small></span>
          </button>
        </div>
      </section>
    </div>
  );
}

export default AdminDashboard;
