import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiAlertTriangle,
  FiBookOpen,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiEdit2,
  FiEye,
  FiFolder,
  FiKey,
  FiLayout,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiTrash2,
  FiUserCheck,
  FiUsers,
  FiX,
} from "react-icons/fi";
import "./ManageUsers.css";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

const EMPTY_SUMMARY = {
  total: 0,
  admins: 0,
  producers: 0,
  recent: 0,
};

const EMPTY_PAGINATION = {
  page: 1,
  limit: 10,
  totalUsers: 0,
  totalPages: 0,
};

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
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
    throw new ApiError(
      `Server returned a non-JSON response (${response.status}).`,
      response.status
    );
  }

  const data = await response.json();

  if (!response.ok || data.success === false) {
    if (response.status === 401 || response.status === 403) {
      window.dispatchEvent(
        new CustomEvent("manage-users-auth-error", { detail: { status: response.status } })
      );
    }
    throw new ApiError(data.message || "Request failed.", response.status);
  }

  return data;
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user")) || null;
  } catch {
    localStorage.removeItem("user");
    return null;
  }
}

function formatDate(value, includeTime = false) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

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

function RoleBadge({ role }) {
  const isAdmin = role === "admin";
  return (
    <span className={`manage-users-role manage-users-role--${isAdmin ? "admin" : "producer"}`}>
      {isAdmin ? "Administrator" : "Producer"}
    </span>
  );
}

function SummaryCard({ icon, label, value, helper, tone }) {
  return (
    <article className="manage-users-summary-card">
      <span className={`manage-users-summary-card__icon manage-users-summary-card__icon--${tone}`}>
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

function Modal({ title, description, onClose, children, footer, wide = false, busy = false }) {
  const modalRef = useRef(null);

  useEffect(() => {
    const modal = modalRef.current;
    const previousActiveElement = document.activeElement;
    const focusableSelector =
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const focusable = modal?.querySelectorAll(focusableSelector);
    focusable?.[0]?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !busy) {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !modal) return;

      const elements = [...modal.querySelectorAll(focusableSelector)];
      if (elements.length === 0) return;

      const first = elements[0];
      const last = elements[elements.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.classList.add("manage-users-modal-open");

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.classList.remove("manage-users-modal-open");
      previousActiveElement?.focus?.();
    };
  }, [busy, onClose]);

  return (
    <div
      className="manage-users-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        ref={modalRef}
        className={`manage-users-modal ${wide ? "manage-users-modal--wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-users-modal-title"
      >
        <header className="manage-users-modal__header">
          <div>
            <h2 id="manage-users-modal-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button
            type="button"
            className="manage-users-icon-button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close dialog"
          >
            <FiX />
          </button>
        </header>

        <div className="manage-users-modal__body">{children}</div>

        {footer && <footer className="manage-users-modal__footer">{footer}</footer>}
      </section>
    </div>
  );
}

function validateUserForm(values, mode) {
  const errors = {};
  const username = values.username.trim();
  const email = values.email.trim();

  if (username.length < 3 || username.length > 100) {
    errors.username = "Username must be between 3 and 100 characters.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  if (!["admin", "producer"].includes(values.role)) {
    errors.role = "Choose a valid role.";
  }

  if (mode === "create") {
    if (values.password.length < 8 || values.password.length > 72) {
      errors.password = "Password must be between 8 and 72 characters.";
    }

    if (values.password !== values.confirmPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }
  }

  return errors;
}

function UserFormModal({ mode, user, currentUserId, onClose, onSaved }) {
  const [values, setValues] = useState({
    username: user?.username || "",
    email: user?.email || "",
    role: user?.role || "producer",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [requestError, setRequestError] = useState("");
  const [saving, setSaving] = useState(false);

  const isSelf = mode === "edit" && Number(user?.userId) === Number(currentUserId);

  const updateValue = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
    setRequestError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = validateUserForm(values, mode);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    setRequestError("");

    try {
      const endpoint =
        mode === "create" ? "/api/admin/users" : `/api/admin/users/${user.userId}`;
      const method = mode === "create" ? "POST" : "PUT";
      const payload = {
        username: values.username.trim(),
        email: values.email.trim(),
        role: isSelf ? "admin" : values.role,
        ...(mode === "create"
          ? {
              password: values.password,
              confirmPassword: values.confirmPassword,
            }
          : {}),
      };

      const data = await apiRequest(endpoint, {
        method,
        body: JSON.stringify(payload),
      });

      onSaved(data.message, data.user);
    } catch (error) {
      setRequestError(error.message || "Unable to save the user account.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={mode === "create" ? "Add user" : "Edit user"}
      description={
        mode === "create"
          ? "Create a new producer or administrator account."
          : `Update ${user.username}'s account details.`
      }
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" className="manage-users-button manage-users-button--secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="manage-user-form" className="manage-users-button manage-users-button--primary" disabled={saving}>
            {saving ? "Saving..." : mode === "create" ? "Create User" : "Save Changes"}
          </button>
        </>
      }
    >
      <form id="manage-user-form" className="manage-users-form" onSubmit={submit} noValidate>
        {requestError && <div className="manage-users-inline-error" role="alert">{requestError}</div>}

        <label>
          <span>Username</span>
          <input
            value={values.username}
            onChange={(event) => updateValue("username", event.target.value)}
            maxLength={100}
            autoComplete="off"
            aria-invalid={Boolean(errors.username)}
          />
          {errors.username && <small className="manage-users-field-error">{errors.username}</small>}
        </label>

        <label>
          <span>Email address</span>
          <input
            type="email"
            value={values.email}
            onChange={(event) => updateValue("email", event.target.value)}
            maxLength={255}
            autoComplete="off"
            aria-invalid={Boolean(errors.email)}
          />
          {errors.email && <small className="manage-users-field-error">{errors.email}</small>}
        </label>

        <label>
          <span>Role</span>
          <select
            value={isSelf ? "admin" : values.role}
            onChange={(event) => updateValue("role", event.target.value)}
            disabled={isSelf}
            aria-invalid={Boolean(errors.role)}
          >
            <option value="producer">Producer</option>
            <option value="admin">Administrator</option>
          </select>
          {isSelf && <small>You cannot demote your own administrator account.</small>}
          {errors.role && <small className="manage-users-field-error">{errors.role}</small>}
        </label>

        {mode === "create" && (
          <div className="manage-users-form__two-column">
            <label>
              <span>Password</span>
              <input
                type="password"
                value={values.password}
                onChange={(event) => updateValue("password", event.target.value)}
                autoComplete="new-password"
                aria-invalid={Boolean(errors.password)}
              />
              {errors.password && <small className="manage-users-field-error">{errors.password}</small>}
            </label>

            <label>
              <span>Confirm password</span>
              <input
                type="password"
                value={values.confirmPassword}
                onChange={(event) => updateValue("confirmPassword", event.target.value)}
                autoComplete="new-password"
                aria-invalid={Boolean(errors.confirmPassword)}
              />
              {errors.confirmPassword && (
                <small className="manage-users-field-error">{errors.confirmPassword}</small>
              )}
            </label>
          </div>
        )}
      </form>
    </Modal>
  );
}

function PasswordModal({ user, onClose, onSaved }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();

    if (password.length < 8 || password.length > 72) {
      setError("Password must be between 8 and 72 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const data = await apiRequest(`/api/admin/users/${user.userId}/password`, {
        method: "PUT",
        body: JSON.stringify({ password, confirmPassword }),
      });
      onSaved(data.message);
    } catch (requestError) {
      setError(requestError.message || "Unable to reset the password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Reset password"
      description={`Set a new password for ${user.username}. The current password cannot be viewed.`}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" className="manage-users-button manage-users-button--secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="manage-user-password-form" className="manage-users-button manage-users-button--primary" disabled={saving}>
            {saving ? "Resetting..." : "Reset Password"}
          </button>
        </>
      }
    >
      <form id="manage-user-password-form" className="manage-users-form" onSubmit={submit}>
        {error && <div className="manage-users-inline-error" role="alert">{error}</div>}
        <label>
          <span>New password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError("");
            }}
            autoComplete="new-password"
          />
          <small>Use between 8 and 72 characters.</small>
        </label>
        <label>
          <span>Confirm new password</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              setError("");
            }}
            autoComplete="new-password"
          />
        </label>
      </form>
    </Modal>
  );
}

function DeleteModal({ user, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const deleteUser = async () => {
    setDeleting(true);
    setError("");

    try {
      const data = await apiRequest(`/api/admin/users/${user.userId}`, {
        method: "DELETE",
      });
      onDeleted(data.message);
    } catch (requestError) {
      setError(requestError.message || "Unable to delete the user account.");
    } finally {
      setDeleting(false);
    }
  };

  const projectCount = Number(user.projectCount || 0);
  const canvasCount = Number(user.canvasCount || 0);
  const knowledgeCount = Number(user.knowledgeBaseCount || 0);

  return (
    <Modal
      title="Delete user"
      description="This action cannot be undone."
      onClose={onClose}
      busy={deleting}
      footer={
        <>
          <button type="button" className="manage-users-button manage-users-button--secondary" onClick={onClose} disabled={deleting}>
            Cancel
          </button>
          <button type="button" className="manage-users-button manage-users-button--danger" onClick={deleteUser} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete User"}
          </button>
        </>
      }
    >
      {error && <div className="manage-users-inline-error" role="alert">{error}</div>}

      <div className="manage-users-delete-warning">
        <FiAlertTriangle aria-hidden="true" />
        <div>
          <strong>Delete {user.username}?</strong>
          <p>{user.email}</p>
          <RoleBadge role={user.role} />
        </div>
      </div>

      {(projectCount > 0 || canvasCount > 0 || knowledgeCount > 0) && (
        <div className="manage-users-cascade-warning">
          <strong>Related content will also be removed by the database:</strong>
          <ul>
            <li>{projectCount} project{projectCount === 1 ? "" : "s"}</li>
            <li>{canvasCount} canvas page{canvasCount === 1 ? "" : "s"}</li>
            <li>{knowledgeCount} knowledge-base record{knowledgeCount === 1 ? "" : "s"}</li>
          </ul>
        </div>
      )}
    </Modal>
  );
}

function DetailModal({ user, loading, error, onClose, onEdit }) {
  return (
    <Modal
      title="User details"
      description="Account information and owned content."
      onClose={onClose}
      wide
      footer={
        user ? (
          <>
            <button type="button" className="manage-users-button manage-users-button--secondary" onClick={onClose}>
              Close
            </button>
            <button type="button" className="manage-users-button manage-users-button--primary" onClick={() => onEdit(user)}>
              <FiEdit2 aria-hidden="true" /> Edit User
            </button>
          </>
        ) : (
          <button type="button" className="manage-users-button manage-users-button--secondary" onClick={onClose}>
            Close
          </button>
        )
      }
    >
      {loading && (
        <div className="manage-users-detail-loading" aria-live="polite">
          <FiRefreshCw className="manage-users-spin" /> Loading user details...
        </div>
      )}

      {error && <div className="manage-users-inline-error" role="alert">{error}</div>}

      {user && !loading && (
        <>
          <div className="manage-users-detail-profile">
            <span className="manage-users-avatar manage-users-avatar--large">
              {user.username?.charAt(0).toUpperCase() || "?"}
            </span>
            <div>
              <h3>{user.username}</h3>
              <p>{user.email}</p>
              <RoleBadge role={user.role} />
            </div>
          </div>

          <dl className="manage-users-detail-list">
            <div><dt>Created</dt><dd>{formatDate(user.createdAt, true)}</dd></div>
            <div><dt>Last updated</dt><dd>{formatDate(user.updatedAt, true)}</dd></div>
          </dl>

          <div className="manage-users-detail-stats">
            <article><FiFolder /><strong>{user.projectCount || 0}</strong><span>Projects</span></article>
            <article><FiLayout /><strong>{user.canvasCount || 0}</strong><span>Canvas pages</span></article>
            <article><FiBookOpen /><strong>{user.knowledgeBaseCount || 0}</strong><span>Knowledge files</span></article>
          </div>
        </>
      )}
    </Modal>
  );
}

function ManageUsers() {
  const navigate = useNavigate();
  const initialLoadRef = useRef(true);
  const [users, setUsers] = useState([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [currentUser, setCurrentUser] = useState(getStoredUser);

  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [dialog, setDialog] = useState(null);
  const [detailUser, setDetailUser] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const handleAuthError = useCallback(
    (requestError) => {
      if (requestError.status === 401) {
        localStorage.removeItem("user");
        navigate("/login", { replace: true });
        return true;
      }

      if (requestError.status === 403) {
        navigate("/dashboard", { replace: true });
        return true;
      }

      return false;
    },
    [navigate]
  );

  const loadUsers = useCallback(
    async ({ refresh = false } = {}) => {
      const isInitial = initialLoadRef.current;
      if (refresh) setRefreshing(true);
      else if (isInitial) setLoading(true);
      else setTableLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
          sort,
        });
        if (search) params.set("search", search);
        if (role) params.set("role", role);

        const data = await apiRequest(`/api/admin/users?${params.toString()}`);
        setUsers(Array.isArray(data.users) ? data.users : []);
        setSummary({ ...EMPTY_SUMMARY, ...(data.summary || {}) });
        setPagination({ ...EMPTY_PAGINATION, ...(data.pagination || {}) });

        if (data.currentUser) {
          const storedUser = getStoredUser() || {};
          const nextCurrentUser = {
            ...storedUser,
            ...data.currentUser,
            user_id: data.currentUser.userId ?? storedUser.user_id,
          };
          setCurrentUser(nextCurrentUser);
          localStorage.setItem("user", JSON.stringify(nextCurrentUser));
        }

        if (data.pagination?.page && Number(data.pagination.page) !== page) {
          setPage(Number(data.pagination.page));
        }
      } catch (requestError) {
        if (!handleAuthError(requestError)) {
          setError(requestError.message || "Unable to load user accounts.");
        }
      } finally {
        initialLoadRef.current = false;
        setLoading(false);
        setTableLoading(false);
        setRefreshing(false);
      }
    },
    [handleAuthError, limit, page, role, search, sort]
  );

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    const handleAuthEvent = (event) => {
      const status = event.detail?.status;
      if (status === 401) {
        localStorage.removeItem("user");
        navigate("/login", { replace: true });
      } else if (status === 403) {
        navigate("/dashboard", { replace: true });
      }
    };

    window.addEventListener("manage-users-auth-error", handleAuthEvent);
    return () => window.removeEventListener("manage-users-auth-error", handleAuthEvent);
  }, [navigate]);

  useEffect(() => {
    if (!success) return undefined;
    const timeout = window.setTimeout(() => setSuccess(""), 4500);
    return () => window.clearTimeout(timeout);
  }, [success]);

  const hasFilters = Boolean(search || role || sort !== "newest");

  const resultRange = useMemo(() => {
    if (pagination.totalUsers === 0) return "0 results";
    const first = (pagination.page - 1) * pagination.limit + 1;
    const last = Math.min(pagination.page * pagination.limit, pagination.totalUsers);
    return `${first}–${last} of ${pagination.totalUsers}`;
  }, [pagination]);

  const closeDialog = useCallback(() => {
    setDialog(null);
    setDetailUser(null);
    setDetailError("");
    setDetailLoading(false);
  }, []);

  const showSuccessAndReload = async (message) => {
    closeDialog();
    setSuccess(message || "Changes saved successfully.");
    await loadUsers({ refresh: true });
  };

  const openDetails = async (user) => {
    setDialog({ type: "details", user });
    setDetailUser(null);
    setDetailLoading(true);
    setDetailError("");

    try {
      const data = await apiRequest(`/api/admin/users/${user.userId}`);
      setDetailUser(data.user);
    } catch (requestError) {
      if (!handleAuthError(requestError)) {
        setDetailError(requestError.message || "Unable to load user details.");
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const submitSearch = (event) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchDraft.trim());
  };

  const clearFilters = () => {
    setSearchDraft("");
    setSearch("");
    setRole("");
    setSort("newest");
    setPage(1);
  };

  const handleDeleteSuccess = async (message) => {
    closeDialog();
    setSuccess(message || "User deleted successfully.");

    if (users.length === 1 && page > 1) {
      setPage((current) => current - 1);
    } else {
      await loadUsers({ refresh: true });
    }
  };

  if (loading) {
    return (
      <div className="page manage-users-page" aria-busy="true">
        <div className="manage-users-page-loading">
          <FiRefreshCw className="manage-users-spin" aria-hidden="true" />
          <p>Loading user accounts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page manage-users-page">
      <header className="manage-users-header">
        <div>
          <span className="manage-users-eyebrow">Administrator workspace</span>
          <h1>Manage Users</h1>
          <p>Create, review and manage user accounts and permissions.</p>
          <span className="manage-users-count-pill">
            {summary.total} registered user{summary.total === 1 ? "" : "s"}
          </span>
        </div>

        <div className="manage-users-header__actions">
          <button
            type="button"
            className="manage-users-button manage-users-button--secondary"
            onClick={() => loadUsers({ refresh: true })}
            disabled={refreshing}
          >
            <FiRefreshCw className={refreshing ? "manage-users-spin" : ""} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          <button
            type="button"
            className="manage-users-button manage-users-button--primary"
            onClick={() => setDialog({ type: "create" })}
          >
            <FiPlus /> Add User
          </button>
        </div>
      </header>

      {error && (
        <div className="manage-users-alert manage-users-alert--error" role="alert">
          <div>
            <strong>User data could not be loaded.</strong>
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => loadUsers()}>Retry</button>
        </div>
      )}

      {success && (
        <div className="manage-users-alert manage-users-alert--success" role="status">
          <FiUserCheck aria-hidden="true" />
          <span>{success}</span>
          <button type="button" onClick={() => setSuccess("")} aria-label="Dismiss success message">
            <FiX />
          </button>
        </div>
      )}

      <section className="manage-users-summary-grid" aria-label="User statistics">
        <SummaryCard icon={<FiUsers />} label="Total Users" value={summary.total} helper="All registered accounts" tone="green" />
        <SummaryCard icon={<FiShield />} label="Administrators" value={summary.admins} helper="System managers" tone="purple" />
        <SummaryCard icon={<FiUserCheck />} label="Producers" value={summary.producers} helper="Content creators" tone="blue" />
        <SummaryCard icon={<FiClock />} label="Added Recently" value={summary.recent} helper="Created in the last 30 days" tone="orange" />
      </section>

      <section className="manage-users-panel">
        <div className="manage-users-panel__heading">
          <div>
            <span>Directory</span>
            <h2>User accounts</h2>
          </div>
          <strong>{pagination.totalUsers} result{pagination.totalUsers === 1 ? "" : "s"}</strong>
        </div>

        <form className="manage-users-filters" onSubmit={submitSearch}>
          <label className="manage-users-search">
            <span className="manage-users-sr-only">Search by username or email</span>
            <FiSearch aria-hidden="true" />
            <input
              type="search"
              placeholder="Search username or email"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              maxLength={255}
            />
          </label>

          <button type="submit" className="manage-users-button manage-users-button--primary manage-users-button--compact">
            Search
          </button>

          <label>
            <span className="manage-users-sr-only">Filter by role</span>
            <select
              value={role}
              onChange={(event) => {
                setRole(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All Roles</option>
              <option value="admin">Administrator</option>
              <option value="producer">Producer</option>
            </select>
          </label>

          <label>
            <span className="manage-users-sr-only">Sort users</span>
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                setPage(1);
              }}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="username_asc">Username A–Z</option>
              <option value="username_desc">Username Z–A</option>
              <option value="updated">Recently Updated</option>
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

        <div className={`manage-users-table-wrap ${tableLoading ? "manage-users-table-wrap--loading" : ""}`} aria-busy={tableLoading}>
          {tableLoading && (
            <div className="manage-users-table-loading" aria-live="polite">
              <FiRefreshCw className="manage-users-spin" /> Updating users...
            </div>
          )}

          {users.length > 0 ? (
            <table className="manage-users-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Created</th>
                  <th>Last Updated</th>
                  <th className="manage-users-table__actions-heading">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isSelf = Number(user.userId) === Number(currentUser?.userId || currentUser?.user_id);
                  const isFinalAdmin = user.role === "admin" && Number(summary.admins) <= 1;
                  const deleteDisabled = isSelf || isFinalAdmin;
                  const deleteTitle = isSelf
                    ? "You cannot delete your own account."
                    : isFinalAdmin
                      ? "The final administrator account cannot be deleted."
                      : "Delete user";

                  return (
                    <tr key={user.userId}>
                      <td data-label="User">
                        <div className="manage-users-user-cell">
                          <span className="manage-users-avatar">
                            {user.username?.charAt(0).toUpperCase() || "?"}
                          </span>
                          <div>
                            <strong>{user.username}</strong>
                            {isSelf && <small>Current account</small>}
                          </div>
                        </div>
                      </td>
                      <td data-label="Email"><span className="manage-users-email">{user.email}</span></td>
                      <td data-label="Role"><RoleBadge role={user.role} /></td>
                      <td data-label="Created">{formatDate(user.createdAt)}</td>
                      <td data-label="Last Updated">{formatDate(user.updatedAt)}</td>
                      <td data-label="Actions">
                        <div className="manage-users-row-actions">
                          <button type="button" onClick={() => openDetails(user)} aria-label={`View ${user.username}`} title="View details">
                            <FiEye />
                          </button>
                          <button type="button" onClick={() => setDialog({ type: "edit", user })} aria-label={`Edit ${user.username}`} title="Edit user">
                            <FiEdit2 />
                          </button>
                          <button type="button" onClick={() => setDialog({ type: "password", user })} aria-label={`Reset password for ${user.username}`} title="Reset password">
                            <FiKey />
                          </button>
                          <button
                            type="button"
                            className="manage-users-row-action--danger"
                            onClick={() => setDialog({ type: "delete", user })}
                            aria-label={`Delete ${user.username}`}
                            title={deleteTitle}
                            disabled={deleteDisabled}
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="manage-users-empty-state">
              <FiUsers aria-hidden="true" />
              <h3>{hasFilters || search ? "No matching users" : "No user accounts"}</h3>
              <p>
                {hasFilters || search
                  ? "No users match your current search and filters."
                  : "No user accounts have been created."}
              </p>
              {(hasFilters || search) && (
                <button type="button" className="manage-users-button manage-users-button--secondary" onClick={clearFilters}>
                  Clear Filters
                </button>
              )}
            </div>
          )}
        </div>

        <footer className="manage-users-pagination">
          <div className="manage-users-pagination__size">
            <label htmlFor="manage-users-page-size">Rows per page</label>
            <select
              id="manage-users-page-size"
              value={limit}
              onChange={(event) => {
                setLimit(Number(event.target.value));
                setPage(1);
              }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>

          <span>{resultRange}</span>

          <div className="manage-users-pagination__buttons">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={pagination.page <= 1 || tableLoading}
            >
              <FiChevronLeft /> Previous
            </button>
            <span>
              Page {pagination.page} of {Math.max(pagination.totalPages, 1)}
            </span>
            <button
              type="button"
              onClick={() => setPage((current) => current + 1)}
              disabled={pagination.totalPages === 0 || pagination.page >= pagination.totalPages || tableLoading}
            >
              Next <FiChevronRight />
            </button>
          </div>
        </footer>
      </section>

      {dialog?.type === "create" && (
        <UserFormModal
          mode="create"
          currentUserId={currentUser?.userId || currentUser?.user_id}
          onClose={closeDialog}
          onSaved={showSuccessAndReload}
        />
      )}

      {dialog?.type === "edit" && (
        <UserFormModal
          mode="edit"
          user={dialog.user}
          currentUserId={currentUser?.userId || currentUser?.user_id}
          onClose={closeDialog}
          onSaved={showSuccessAndReload}
        />
      )}

      {dialog?.type === "password" && (
        <PasswordModal user={dialog.user} onClose={closeDialog} onSaved={showSuccessAndReload} />
      )}

      {dialog?.type === "delete" && (
        <DeleteModal user={dialog.user} onClose={closeDialog} onDeleted={handleDeleteSuccess} />
      )}

      {dialog?.type === "details" && (
        <DetailModal
          user={detailUser}
          loading={detailLoading}
          error={detailError}
          onClose={closeDialog}
          onEdit={(user) => setDialog({ type: "edit", user })}
        />
      )}
    </div>
  );
}

export default ManageUsers;
