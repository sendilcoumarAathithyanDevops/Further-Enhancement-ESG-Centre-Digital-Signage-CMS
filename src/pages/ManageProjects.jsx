import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiEye,
  FiFolder,
  FiGlobe,
  FiMonitor,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiUsers,
  FiX,
} from "react-icons/fi";
import "./ManageUsers.css";
import "./manageprojects.css";

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

const CATEGORY_META = {
  environmental: { label: "Environmental", emoji: "🌱" },
  social: { label: "Social", emoji: "👥" },
  governance: { label: "Governance", emoji: "🏛️" },
};

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-SG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function CategoryBadge({ category }) {
  const meta = CATEGORY_META[category];
  if (!meta) return <span>—</span>;
  return (
    <span className={`category-badge ${category}`}>
      {meta.emoji} {meta.label}
    </span>
  );
}

function SummaryCard({ icon, label, value, helper, tone }) {
  return (
    <article className="manage-users-summary-card">
      <span
        className={`manage-users-summary-card__icon manage-users-summary-card__icon--${tone}`}
      >
        {icon}
      </span>
      <div>
        <span>{label}</span>
        <strong>{Number(value || 0).toLocaleString()}</strong>
        <small>{helper}</small>
      </div>
    </article>
  );
}

export default function ManageProjects() {
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // ── Load published projects ──────────────────────────────────────────────
  const loadProjects = useCallback(async ({ refresh = false } = {}) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE_URL}/api/projects`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Could not load projects (${res.status}).`);
      const data = await res.json();
      setProjects(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load projects:", err);
      setError(err.message || "Unable to load published projects.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // ── Stats ────────────────────────────────────────────────────────────────
  const totalPublished = projects.length;
  const environmentalCount = projects.filter(
    (p) => p.category === "environmental"
  ).length;
  const socialCount = projects.filter((p) => p.category === "social").length;
  const governanceCount = projects.filter(
    (p) => p.category === "governance"
  ).length;

  // ── Search + filter ──────────────────────────────────────────────────────
  const filteredProjects = useMemo(() => {
    const term = search.toLowerCase();
    return projects.filter((p) => {
      const matchesSearch =
        !term ||
        p.name?.toLowerCase().includes(term) ||
        p.owner?.toLowerCase().includes(term) ||
        p.category?.toLowerCase().includes(term);

      const matchesCategory =
        categoryFilter === "all" || p.category?.toLowerCase() === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [projects, search, categoryFilter]);

  const hasFilters = Boolean(search || categoryFilter !== "all");

  const submitSearch = (event) => {
    event.preventDefault();
    setSearch(searchDraft.trim());
  };

  const clearFilters = () => {
    setSearchDraft("");
    setSearch("");
    setCategoryFilter("all");
  };

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="page manage-users-page" aria-busy="true">
        <div className="manage-users-page-loading">
          <FiRefreshCw className="manage-users-spin" aria-hidden="true" />
          <p>Loading published projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page manage-users-page">
      <header className="manage-users-header">
        <div>
          <span className="manage-users-eyebrow">Administrator workspace</span>
          <h1>Published Projects</h1>
          <p>Projects published by producers will appear here.</p>
          <span className="manage-users-count-pill">
            {totalPublished} published project{totalPublished === 1 ? "" : "s"}
          </span>
        </div>

        <div className="manage-users-header__actions">
          <button
            type="button"
            className="manage-users-button manage-users-button--secondary"
            onClick={() => loadProjects({ refresh: true })}
            disabled={refreshing}
          >
            <FiRefreshCw className={refreshing ? "manage-users-spin" : ""} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          <button
            type="button"
            className="manage-users-button manage-users-button--primary"
            onClick={() =>
              window.open(
                `${window.location.origin}/category-display`,
                "_blank"
              )
            }
          >
            <FiMonitor /> Category Preview
          </button>
        </div>
      </header>

      {error && (
        <div className="manage-users-alert manage-users-alert--error" role="alert">
          <div>
            <strong>Projects could not be loaded.</strong>
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => loadProjects()}>
            Retry
          </button>
        </div>
      )}

      <section className="manage-users-summary-grid" aria-label="Project statistics">
        <SummaryCard
          icon={<FiFolder />}
          label="Total Published"
          value={totalPublished}
          helper="All published projects"
          tone="green"
        />
        <SummaryCard
          icon={<FiGlobe />}
          label="Environmental"
          value={environmentalCount}
          helper="🌱 Environmental projects"
          tone="green"
        />
        <SummaryCard
          icon={<FiUsers />}
          label="Social"
          value={socialCount}
          helper="👥 Social projects"
          tone="blue"
        />
        <SummaryCard
          icon={<FiShield />}
          label="Governance"
          value={governanceCount}
          helper="🏛️ Governance projects"
          tone="purple"
        />
      </section>

      <section className="manage-users-panel">
        <div className="manage-users-panel__heading">
          <div>
            <span>Directory</span>
            <h2>Published projects</h2>
          </div>
          <strong>
            {filteredProjects.length} result{filteredProjects.length === 1 ? "" : "s"}
          </strong>
        </div>

        <form className="manage-users-filters" onSubmit={submitSearch}>
          <label className="manage-users-search">
            <span className="manage-users-sr-only">
              Search by project name, owner, or category
            </span>
            <FiSearch aria-hidden="true" />
            <input
              type="search"
              placeholder="Search project, owner, or category"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              maxLength={255}
            />
          </label>

          <button
            type="submit"
            className="manage-users-button manage-users-button--primary manage-users-button--compact"
          >
            Search
          </button>

          <label>
            <span className="manage-users-sr-only">Filter by category</span>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="all">All Categories</option>
              <option value="environmental">Environmental</option>
              <option value="social">Social</option>
              <option value="governance">Governance</option>
            </select>
          </label>

          <button
            type="button"
            className="manage-users-clear-button"
            onClick={clearFilters}
            disabled={!hasFilters && !searchDraft}
          >
            Clear filters
          </button>
        </form>

        <div className="manage-users-table-wrap">
          {filteredProjects.length > 0 ? (
            <table className="manage-users-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Project Name</th>
                  <th>Owner</th>
                  <th>Category</th>
                  <th>Published Date</th>
                  <th className="manage-users-table__actions-heading">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((p, i) => (
                  <tr key={p.project_id}>
                    <td data-label="#">{i + 1}</td>
                    <td data-label="Project Name">
                      <strong>{p.name}</strong>
                    </td>
                    <td data-label="Owner">{p.owner}</td>
                    <td data-label="Category">
                      <CategoryBadge category={p.category} />
                    </td>
                    <td data-label="Published Date">{formatDate(p.updated_at)}</td>
                    <td data-label="Actions">
                      <div className="manage-users-row-actions">
                        <button
                          type="button"
                          onClick={() =>
                            navigate(`/category-preview?project=${p.project_id}`)
                          }
                          aria-label={`Preview ${p.name}`}
                          title="Preview project"
                        >
                          <FiEye />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="manage-users-empty-state">
              <FiFolder aria-hidden="true" />
              <h3>{hasFilters ? "No matching projects" : "No published projects"}</h3>
              <p>
                {hasFilters
                  ? "No projects match your current search and filters."
                  : "No projects have been published yet."}
              </p>
              {hasFilters && (
                <button
                  type="button"
                  className="manage-users-button manage-users-button--secondary"
                  onClick={clearFilters}
                >
                  <FiX /> Clear Filters
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}