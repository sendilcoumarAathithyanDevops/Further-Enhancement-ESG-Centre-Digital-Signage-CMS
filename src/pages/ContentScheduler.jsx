import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiCalendar,
  FiClock,
  FiEdit2,
  FiMonitor,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiXCircle,
  FiX,
} from "react-icons/fi";
import "./ContentScheduler.css";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

const CATEGORY_LABELS = {
  environmental: "Environmental",
  social: "Social",
  governance: "Governance",
};

const EMPTY_FORM = {
  monitorId: "",
  projectId: "",
  startAt: "",
  endAt: "",
  notes: "",
};

function formatLocalInput(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function defaultForm() {
  const start = new Date();
  start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    ...EMPTY_FORM,
    startAt: formatLocalInput(start),
    endAt: formatLocalInput(end),
  };
}

function formatDateTime(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    await response.text();
    throw new Error(`Server returned a non-JSON response (${response.status}).`);
  }
  const data = await response.json();
  if (!response.ok || data?.success === false) {
    throw new Error(data?.message || `Request failed (${response.status}).`);
  }
  return data;
}

function ContentScheduler() {
  const [schedules, setSchedules] = useState([]);
  const [monitors, setMonitors] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalSchedule, setModalSchedule] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadData = useCallback(async ({ refresh = false } = {}) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const [scheduleData, monitorData, projectData] = await Promise.all([
        apiRequest("/api/admin/schedules"),
        apiRequest("/api/admin/scheduler/monitors"),
        apiRequest("/api/projects"),
      ]);
      setSchedules(Array.isArray(scheduleData.schedules) ? scheduleData.schedules : []);
      setMonitors(Array.isArray(monitorData.monitors) ? monitorData.monitors : []);
      setProjects(Array.isArray(projectData) ? projectData : []);
    } catch (requestError) {
      console.error("Unable to load content schedules:", requestError);
      setError(requestError.message || "Unable to load content schedules.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredSchedules = useMemo(() => {
    const term = search.trim().toLowerCase();
    return schedules.filter((schedule) => {
      const matchesStatus = statusFilter === "all" || schedule.status === statusFilter;
      const searchable = [
        schedule.monitor_name,
        schedule.monitor_category,
        schedule.location,
        schedule.project_name,
        schedule.created_by_username,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchesStatus && (!term || searchable.includes(term));
    });
  }, [schedules, search, statusFilter]);

  const selectedMonitor = monitors.find(
    (monitor) => String(monitor.monitor_id) === String(form.monitorId)
  );
  const compatibleProjects = projects.filter(
    (project) => project.category === selectedMonitor?.monitor_category
  );

  const counts = useMemo(
    () => ({
      scheduled: schedules.filter((schedule) => schedule.status === "scheduled").length,
      active: schedules.filter((schedule) => schedule.status === "active").length,
      completed: schedules.filter((schedule) => schedule.status === "completed").length,
    }),
    [schedules]
  );

  const openCreateModal = () => {
    setError("");
    setModalSchedule(null);
    setForm(defaultForm());
    setIsModalOpen(true);
  };

  const openEditModal = (schedule) => {
    setError("");
    setModalSchedule(schedule);
    setForm({
      monitorId: String(schedule.monitor_id),
      projectId: String(schedule.project_id),
      startAt: formatLocalInput(schedule.start_at_iso),
      endAt: formatLocalInput(schedule.end_at_iso),
      notes: schedule.notes || "",
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (!saving) setIsModalOpen(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const start = new Date(form.startAt);
    const end = new Date(form.endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      setError("The end time must be after the start time.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const payload = JSON.stringify({
        monitorId: Number(form.monitorId),
        projectId: Number(form.projectId),
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        notes: form.notes.trim(),
      });
      await apiRequest(
        modalSchedule
          ? `/api/admin/schedules/${modalSchedule.schedule_id}`
          : "/api/admin/schedules",
        {
          method: modalSchedule ? "PUT" : "POST",
          body: payload,
        }
      );
      setIsModalOpen(false);
      setNotice(modalSchedule ? "Schedule updated." : "Schedule created.");
      await loadData({ refresh: true });
    } catch (requestError) {
      console.error("Unable to save content schedule:", requestError);
      setError(requestError.message || "Unable to save the schedule.");
    } finally {
      setSaving(false);
    }
  };

  const cancelSchedule = async (schedule) => {
    if (!window.confirm(`Cancel the schedule for "${schedule.project_name}"?`)) return;
    setError("");
    setNotice("");
    try {
      await apiRequest(`/api/admin/schedules/${schedule.schedule_id}/cancel`, {
        method: "POST",
      });
      setNotice("Schedule cancelled.");
      await loadData({ refresh: true });
    } catch (requestError) {
      console.error("Unable to cancel content schedule:", requestError);
      setError(requestError.message || "Unable to cancel the schedule.");
    }
  };

  const deleteSchedule = async (schedule) => {
    if (!window.confirm(`Delete this ${schedule.status} schedule for "${schedule.project_name}"?`)) {
      return;
    }
    setError("");
    setNotice("");
    try {
      await apiRequest(`/api/admin/schedules/${schedule.schedule_id}`, {
        method: "DELETE",
      });
      setNotice("Schedule deleted.");
      await loadData({ refresh: true });
    } catch (requestError) {
      console.error("Unable to delete content schedule:", requestError);
      setError(requestError.message || "Unable to delete the schedule.");
    }
  };

  return (
    <main className="content-scheduler-page">
      <header className="content-scheduler-hero">
        <div>
          <span className="content-scheduler-eyebrow">Content operations</span>
          <h1>Content Scheduler</h1>
          <p>Choose which published project plays on each display and when.</p>
          <small>Times are shown in your browser’s local timezone. Schedules are one-time only.</small>
        </div>
        <div className="content-scheduler-hero__actions">
          <button
            type="button"
            className="content-scheduler-button content-scheduler-button--secondary"
            onClick={() => loadData({ refresh: true })}
            disabled={refreshing}
          >
            <FiRefreshCw className={refreshing ? "content-scheduler-spin" : ""} />
            Refresh
          </button>
          <button
            type="button"
            className="content-scheduler-button content-scheduler-button--primary"
            onClick={openCreateModal}
          >
            <FiPlus />
            New schedule
          </button>
        </div>
      </header>

      {error && !isModalOpen && (
        <div className="content-scheduler-alert content-scheduler-alert--error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} aria-label="Dismiss error">
            <FiX />
          </button>
        </div>
      )}
      {notice && (
        <div className="content-scheduler-alert content-scheduler-alert--success" role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")} aria-label="Dismiss notification">
            <FiX />
          </button>
        </div>
      )}

      <section className="content-scheduler-summary" aria-label="Schedule summary">
        <article>
          <FiCalendar aria-hidden="true" />
          <span>Upcoming</span>
          <strong>{counts.scheduled}</strong>
        </article>
        <article>
          <FiMonitor aria-hidden="true" />
          <span>Active</span>
          <strong>{counts.active}</strong>
        </article>
        <article>
          <FiClock aria-hidden="true" />
          <span>Completed</span>
          <strong>{counts.completed}</strong>
        </article>
      </section>

      <section className="content-scheduler-panel" aria-labelledby="schedule-list-heading">
        <div className="content-scheduler-panel__header">
          <div>
            <span>Display assignments</span>
            <h2 id="schedule-list-heading">Schedules</h2>
          </div>
          <div className="content-scheduler-filters">
            <label className="content-scheduler-search">
              <FiSearch aria-hidden="true" />
              <input
                type="search"
                placeholder="Search project or display"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label className="content-scheduler-status-filter">
              <span className="sr-only">Filter by status</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">All statuses</option>
                <option value="scheduled">Upcoming</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
          </div>
        </div>

        {loading ? (
          <div className="content-scheduler-empty">Loading schedules…</div>
        ) : filteredSchedules.length === 0 ? (
          <div className="content-scheduler-empty">
            {schedules.length === 0
              ? "No content schedules yet. Create one to assign a project to a display."
              : "No schedules match these filters."}
          </div>
        ) : (
          <div className="content-scheduler-table-wrap">
            <table className="content-scheduler-table">
              <thead>
                <tr>
                  <th scope="col">Project</th>
                  <th scope="col">Display</th>
                  <th scope="col">Starts</th>
                  <th scope="col">Ends</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSchedules.map((schedule) => (
                  <tr key={schedule.schedule_id}>
                    <td>
                      <strong>{schedule.project_name}</strong>
                      <small>{schedule.monitor_category ? CATEGORY_LABELS[schedule.monitor_category] : "Project"}</small>
                    </td>
                    <td>
                      <strong>{schedule.monitor_name}</strong>
                      <small>{schedule.location || "No location set"}</small>
                    </td>
                    <td>{formatDateTime(schedule.start_at_iso)}</td>
                    <td>{formatDateTime(schedule.end_at_iso)}</td>
                    <td>
                      <span className={`content-scheduler-status content-scheduler-status--${schedule.status}`}>
                        {schedule.status}
                      </span>
                    </td>
                    <td>
                      <div className="content-scheduler-row-actions">
                        {schedule.status === "scheduled" && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditModal(schedule)}
                              aria-label={`Edit schedule for ${schedule.project_name}`}
                              title="Edit schedule"
                            >
                              <FiEdit2 />
                            </button>
                            <button
                              type="button"
                              onClick={() => cancelSchedule(schedule)}
                              aria-label={`Cancel schedule for ${schedule.project_name}`}
                              title="Cancel schedule"
                            >
                              <FiXCircle />
                            </button>
                          </>
                        )}
                        {schedule.status !== "active" && (
                          <button
                            type="button"
                            className="content-scheduler-row-actions__danger"
                            onClick={() => deleteSchedule(schedule)}
                            aria-label={`Delete schedule for ${schedule.project_name}`}
                            title="Delete schedule"
                          >
                            <FiTrash2 />
                          </button>
                        )}
                        {schedule.status === "active" && <span className="content-scheduler-no-action">In progress</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isModalOpen && (
        <div
          className="content-scheduler-modal-overlay"
          onMouseDown={(event) => event.target === event.currentTarget && closeModal()}
        >
          <section
            className="content-scheduler-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="content-scheduler-modal-title"
          >
            <header>
              <div>
                <span>{modalSchedule ? "Update assignment" : "Plan an assignment"}</span>
                <h2 id="content-scheduler-modal-title">
                  {modalSchedule ? "Edit schedule" : "New content schedule"}
                </h2>
              </div>
              <button type="button" onClick={closeModal} disabled={saving} aria-label="Close dialog">
                <FiX />
              </button>
            </header>
            <form onSubmit={handleSubmit}>
              {error && (
                <div className="content-scheduler-alert content-scheduler-alert--error" role="alert">
                  {error}
                </div>
              )}
              <label>
                Display
                <select
                  required
                  value={form.monitorId}
                  onChange={(event) =>
                    setForm({ ...form, monitorId: event.target.value, projectId: "" })
                  }
                >
                  <option value="">Choose a display</option>
                  {monitors.map((monitor) => (
                    <option key={monitor.monitor_id} value={monitor.monitor_id}>
                      {monitor.monitor_name} · {CATEGORY_LABELS[monitor.monitor_category] || monitor.monitor_category}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Published project
                <select
                  required
                  value={form.projectId}
                  onChange={(event) => setForm({ ...form, projectId: event.target.value })}
                  disabled={!selectedMonitor}
                >
                  <option value="">
                    {selectedMonitor ? "Choose a project" : "Choose a display first"}
                  </option>
                  {compatibleProjects.map((project) => (
                    <option key={project.project_id} value={project.project_id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                {selectedMonitor && compatibleProjects.length === 0 && (
                  <small className="content-scheduler-form-hint">
                    No published projects are available for this display category.
                  </small>
                )}
              </label>
              <div className="content-scheduler-form-grid">
                <label>
                  Starts
                  <input
                    type="datetime-local"
                    required
                    value={form.startAt}
                    onChange={(event) => setForm({ ...form, startAt: event.target.value })}
                  />
                </label>
                <label>
                  Ends
                  <input
                    type="datetime-local"
                    required
                    value={form.endAt}
                    onChange={(event) => setForm({ ...form, endAt: event.target.value })}
                  />
                </label>
              </div>
              <label>
                Notes <span className="content-scheduler-optional">(optional)</span>
                <textarea
                  rows="3"
                  maxLength="500"
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  placeholder="Add a note for administrators"
                />
              </label>
              <p className="content-scheduler-form-hint">
                The project category must match the selected display. Times use your local timezone.
              </p>
              <footer>
                <button
                  type="button"
                  className="content-scheduler-button content-scheduler-button--secondary"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="content-scheduler-button content-scheduler-button--primary"
                  disabled={saving || !monitors.length || !projects.length}
                >
                  {saving ? "Saving…" : modalSchedule ? "Save changes" : "Create schedule"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

export default ContentScheduler;
