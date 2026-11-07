import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiAlertTriangle,
  FiBookOpen,
  FiDownload,
  FiEye,
  FiFile,
  FiFileText,
  FiFilter,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import "./KnowledgeBase.css";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

const CATEGORIES = [
  { value: "environmental", label: "Environmental" },
  { value: "social", label: "Social" },
  { value: "governance", label: "Governance" },
];

const FILE_ICON_MAP = {
  pdf: "📄",
  doc: "📝",
  docx: "📝",
  xls: "📊",
  xlsx: "📊",
  ppt: "📋",
  pptx: "📋",
  txt: "📃",
  csv: "📊",
  jpg: "🖼️",
  jpeg: "🖼️",
  png: "🖼️",
  webp: "🖼️",
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

function formatBytes(size) {
  const bytes = Number(size);
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileType) {
  return FILE_ICON_MAP[String(fileType || "").toLowerCase()] || "📁";
}

// ========================
// MODAL COMPONENT
// ========================
function Modal({ title, description, onClose, children, footer, busy = false }) {
  const modalRef = useRef(null);

  useEffect(() => {
    const modal = modalRef.current;
    const prev = document.activeElement;
    const selector =
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    modal?.querySelectorAll(selector)?.[0]?.focus();

    const onKey = (e) => {
      if (e.key === "Escape" && !busy) { onClose(); return; }
      if (e.key !== "Tab" || !modal) return;
      const els = [...modal.querySelectorAll(selector)];
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };

    document.addEventListener("keydown", onKey);
    document.body.classList.add("kb-modal-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("kb-modal-open");
      prev?.focus?.();
    };
  }, [busy, onClose]);

  return (
    <div
      className="kb-modal-backdrop"
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
    >
      <section
        ref={modalRef}
        className="kb-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kb-modal-title"
      >
        <header className="kb-modal__header">
          <div>
            <h2 id="kb-modal-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button
            type="button"
            className="kb-icon-button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close dialog"
          >
            <FiX />
          </button>
        </header>
        <div className="kb-modal__body">{children}</div>
        {footer && <footer className="kb-modal__footer">{footer}</footer>}
      </section>
    </div>
  );
}

// ========================
// UPLOAD MODAL
// ========================
function UploadModal({ onClose, onUploaded }) {
  const [values, setValues] = useState({ title: "", content: "", category: "environmental" });
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [requestError, setRequestError] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  const update = (field, value) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: "" }));
    setRequestError("");
  };

  const validate = () => {
    const errs = {};
    if (!values.title.trim()) errs.title = "Title is required.";
    else if (values.title.trim().length > 200) errs.title = "Title must be 200 characters or fewer.";
    if (!values.category) errs.category = "Please select a category.";
    return errs;
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    setRequestError("");

    try {
      const payload = new FormData();
      payload.append("title", values.title.trim());
      payload.append("content", values.content.trim());
      payload.append("category", values.category);
      if (file) payload.append("file", file);

      const res = await fetch(`${API_BASE_URL}/api/knowledge-base`, {
        method: "POST",
        credentials: "include",
        body: payload,
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Upload failed.");
      onUploaded("Article uploaded successfully.");
    } catch (err) {
      setRequestError(err.message || "Unable to upload article.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Upload Article"
      description="Add a new knowledge base entry with an optional file attachment."
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" className="kb-button kb-button--secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="kb-upload-form" className="kb-button kb-button--primary" disabled={saving}>
            {saving ? "Uploading..." : "Upload Article"}
          </button>
        </>
      }
    >
      <form id="kb-upload-form" className="kb-form" onSubmit={submit} noValidate>
        {requestError && (
          <div className="kb-inline-error" role="alert">{requestError}</div>
        )}

        <label>
          <span>Title</span>
          <input
            type="text"
            value={values.title}
            onChange={(e) => update("title", e.target.value)}
            maxLength={200}
            placeholder="e.g. Carbon Emissions Report 2025"
            aria-invalid={Boolean(errors.title)}
          />
          {errors.title && <small className="kb-field-error">{errors.title}</small>}
        </label>

        <label>
          <span>Description <span className="kb-optional">(optional)</span></span>
          <textarea
            rows={4}
            value={values.content}
            onChange={(e) => update("content", e.target.value)}
            placeholder="Brief description of this document..."
          />
        </label>

        <label>
          <span>Category</span>
          <select
            value={values.category}
            onChange={(e) => update("category", e.target.value)}
            aria-invalid={Boolean(errors.category)}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          {errors.category && <small className="kb-field-error">{errors.category}</small>}
        </label>

        <div className="kb-file-picker">
          <span className="kb-file-picker__label">File attachment <span className="kb-optional">(optional)</span></span>
          {file ? (
            <div className="kb-file-selected">
              <span>{getFileIcon(file.name.split(".").pop())}</span>
              <div>
                <strong>{file.name}</strong>
                <small>{formatBytes(file.size)}</small>
              </div>
              <button
                type="button"
                className="kb-icon-button"
                onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                aria-label="Remove selected file"
              >
                <FiX />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="kb-file-picker__zone"
              onClick={() => fileInputRef.current?.click()}
            >
              <FiFile />
              <span>Click to choose a file</span>
              <small>PDF, Word, Excel, PowerPoint, images — up to 50 MB</small>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="kb-sr-only"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.webp"
            onChange={(e) => {
              const f = e.target.files?.[0] || null;
              setFile(f);
              setRequestError("");
            }}
          />
        </div>
      </form>
    </Modal>
  );
}

// ========================
// DELETE CONFIRM MODAL
// ========================
function DeleteModal({ article, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/knowledge-base/${article.articleId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Unable to delete article.");
      onDeleted("Article deleted successfully.");
    } catch (err) {
      setError(err.message || "Unable to delete article.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal
      title="Delete article"
      description="This action cannot be undone."
      onClose={onClose}
      busy={deleting}
      footer={
        <>
          <button type="button" className="kb-button kb-button--secondary" onClick={onClose} disabled={deleting}>
            Cancel
          </button>
          <button type="button" className="kb-button kb-button--danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete Article"}
          </button>
        </>
      }
    >
      {error && <div className="kb-inline-error" role="alert">{error}</div>}
      <div className="kb-delete-warning">
        <FiAlertTriangle aria-hidden="true" />
        <div>
          <strong>Delete "{article.title}"?</strong>
          <p>
            <span className={`kb-category-badge kb-category-badge--${article.category}`}>
              {article.category}
            </span>
          </p>
          {article.filePath && (
            <p className="kb-delete-warning__file">
              The attached file will also be permanently removed from the server.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ========================
// STAT CARD
// ========================
function StatCard({ icon, label, value, helper, tone }) {
  return (
    <article className="kb-stat-card">
      <span className={`kb-stat-card__icon kb-stat-card__icon--${tone}`}>{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{helper}</small>
      </div>
    </article>
  );
}

// ========================
// ARTICLE CARD
// ========================
function ArticleCard({ article, onDelete }) {
  const fileIcon = getFileIcon(article.fileType);
  const fileSize = formatBytes(article.fileSize);
  const viewUrl = article.filePath ? `${API_BASE_URL}${article.filePath}` : null;

  return (
    <article className="kb-article-card">
      <div className="kb-article-card__icon-col">
        <span className="kb-article-card__file-icon">{fileIcon}</span>
      </div>

      <div className="kb-article-card__body">
        <div className="kb-article-card__title-row">
          <strong className="kb-article-card__title">{article.title}</strong>
          <span className={`kb-category-badge kb-category-badge--${article.category}`}>
            {article.category}
          </span>
        </div>

        {article.content && (
          <p className="kb-article-card__desc">{article.content}</p>
        )}

        <div className="kb-article-card__meta">
          {article.fileType && (
            <span className="kb-file-type-pill">{String(article.fileType).toUpperCase()}</span>
          )}
          {fileSize && <span>{fileSize}</span>}
          <span>Uploaded {formatDate(article.createdAt)}</span>
        </div>
      </div>

      <div className="kb-article-card__actions">
        {viewUrl && (
          <>
            <a
              href={viewUrl}
              target="_blank"
              rel="noreferrer"
              className="kb-row-action"
              title="View file"
              aria-label={`View ${article.title}`}
            >
              <FiEye />
            </a>
            <a
              href={viewUrl}
              download
              className="kb-row-action"
              title="Download file"
              aria-label={`Download ${article.title}`}
            >
              <FiDownload />
            </a>
          </>
        )}
        <button
          type="button"
          className="kb-row-action kb-row-action--danger"
          onClick={() => onDelete(article)}
          title="Delete article"
          aria-label={`Delete ${article.title}`}
        >
          <FiTrash2 />
        </button>
      </div>
    </article>
  );
}

// ========================
// MAIN PAGE
// ========================
function KnowledgeBase() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const [dialog, setDialog] = useState(null); // { type: "upload" | "delete", article? }

  const loadArticles = useCallback(async ({ refresh = false } = {}) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE_URL}/api/knowledge-base`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Unable to load knowledge base.");
      setArticles(data.articles || []);
    } catch (err) {
      setError(err.message || "Unable to load knowledge base.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadArticles(); }, [loadArticles]);

  // Auto-dismiss success toast
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(""), 4500);
    return () => clearTimeout(t);
  }, [success]);

  const filteredArticles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return articles.filter((a) => {
      const categoryMatch = activeCategory === "all" || a.category === activeCategory;
      const searchMatch = !q || [a.title, a.content, a.category, a.fileType]
        .join(" ").toLowerCase().includes(q);
      return categoryMatch && searchMatch;
    });
  }, [articles, search, activeCategory]);

  // Stats
  const envCount = articles.filter((a) => a.category === "environmental").length;
  const socialCount = articles.filter((a) => a.category === "social").length;
  const govCount = articles.filter((a) => a.category === "governance").length;
  const withFiles = articles.filter((a) => a.filePath).length;

  const submitSearch = (e) => {
    e.preventDefault();
    setSearch(searchDraft.trim());
  };

  const clearFilters = () => {
    setSearchDraft("");
    setSearch("");
    setActiveCategory("all");
  };

  const hasFilters = Boolean(search || activeCategory !== "all");

  const closeDialog = () => setDialog(null);

  const handleUploaded = async (msg) => {
    closeDialog();
    setSuccess(msg);
    await loadArticles({ refresh: true });
  };

  const handleDeleted = async (msg) => {
    closeDialog();
    setSuccess(msg);
    await loadArticles({ refresh: true });
  };

  if (loading) {
    return (
      <div className="page kb-page" aria-busy="true">
        <div className="kb-page-loading">
          <FiRefreshCw className="kb-spin" aria-hidden="true" />
          <p>Loading knowledge base...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page kb-page">

      {/* ==================== HEADER ==================== */}
      <header className="kb-header">
        <div>
          <span className="kb-eyebrow">Producer workspace</span>
          <h1>Knowledge Base</h1>
          <p>Store, search and share ESG articles and documents with your team.</p>
          <span className="kb-count-pill">
            {articles.length} article{articles.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="kb-header__actions">
          <button
            type="button"
            className="kb-button kb-button--secondary"
            onClick={() => loadArticles({ refresh: true })}
            disabled={refreshing}
          >
            <FiRefreshCw className={refreshing ? "kb-spin" : ""} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          <button
            type="button"
            className="kb-button kb-button--primary"
            onClick={() => setDialog({ type: "upload" })}
          >
            <FiPlus /> Upload Article
          </button>
        </div>
      </header>

      {/* ==================== ALERTS ==================== */}
      {error && (
        <div className="kb-alert kb-alert--error" role="alert">
          <div>
            <strong>Could not load knowledge base.</strong>
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => loadArticles()}>Retry</button>
        </div>
      )}

      {success && (
        <div className="kb-alert kb-alert--success" role="status">
          <span>{success}</span>
          <button type="button" onClick={() => setSuccess("")} aria-label="Dismiss">
            <FiX />
          </button>
        </div>
      )}

      {/* ==================== STATS ==================== */}
      <section className="kb-stats-grid" aria-label="Knowledge base statistics">
        <StatCard icon={<FiBookOpen />} label="Total Articles" value={articles.length} helper="All uploaded entries" tone="green" />
        <StatCard icon={<FiFileText />} label="Environmental" value={envCount} helper="Environmental articles" tone="green" />
        <StatCard icon={<FiFileText />} label="Social" value={socialCount} helper="Social articles" tone="blue" />
        <StatCard icon={<FiFileText />} label="Governance" value={govCount} helper="Governance articles" tone="purple" />
        <StatCard icon={<FiFile />} label="With Files" value={withFiles} helper="Entries with attachments" tone="orange" />
      </section>

      {/* ==================== PANEL ==================== */}
      <section className="kb-panel">
        <div className="kb-panel__heading">
          <div>
            <span>Library</span>
            <h2>Articles &amp; Documents</h2>
          </div>
          <strong>{filteredArticles.length} result{filteredArticles.length === 1 ? "" : "s"}</strong>
        </div>

        {/* FILTERS */}
        <form className="kb-filters" onSubmit={submitSearch}>
          <label className="kb-search">
            <span className="kb-sr-only">Search articles</span>
            <FiSearch aria-hidden="true" />
            <input
              type="search"
              placeholder="Search title, description or category..."
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              maxLength={200}
            />
          </label>

          <button
            type="submit"
            className="kb-button kb-button--primary kb-button--compact"
          >
            Search
          </button>

          <label>
            <span className="kb-sr-only">Filter by category</span>
            <select
              value={activeCategory}
              onChange={(e) => setActiveCategory(e.target.value)}
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </label>

          {hasFilters && (
            <button
              type="button"
              className="kb-clear-button"
              onClick={clearFilters}
            >
              <FiFilter /> Clear filters
            </button>
          )}
        </form>

        {/* CATEGORY TABS */}
        <div className="kb-tabs" role="tablist" aria-label="Category filter">
          {[{ value: "all", label: "All" }, ...CATEGORIES].map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={activeCategory === tab.value}
              className={`kb-tab ${activeCategory === tab.value ? "kb-tab--active" : ""}`}
              onClick={() => setActiveCategory(tab.value)}
            >
              {tab.label}
              <span className="kb-tab__count">
                {tab.value === "all"
                  ? articles.length
                  : articles.filter((a) => a.category === tab.value).length}
              </span>
            </button>
          ))}
        </div>

        {/* ARTICLE LIST */}
        {filteredArticles.length === 0 ? (
          <div className="kb-empty-state">
            <FiBookOpen aria-hidden="true" />
            <h3>{hasFilters ? "No results found" : "No articles yet"}</h3>
            <p>
              {hasFilters
                ? "Try adjusting your search or filter."
                : "Upload your first article to get started."}
            </p>
            {hasFilters ? (
              <button type="button" className="kb-button kb-button--secondary" onClick={clearFilters}>
                Clear filters
              </button>
            ) : (
              <button
                type="button"
                className="kb-button kb-button--primary"
                onClick={() => setDialog({ type: "upload" })}
              >
                <FiPlus /> Upload Article
              </button>
            )}
          </div>
        ) : (
          <div className="kb-article-list">
            {filteredArticles.map((article) => (
              <ArticleCard
                key={article.articleId}
                article={article}
                onDelete={(a) => setDialog({ type: "delete", article: a })}
              />
            ))}
          </div>
        )}
      </section>

      {/* ==================== MODALS ==================== */}
      {dialog?.type === "upload" && (
        <UploadModal onClose={closeDialog} onUploaded={handleUploaded} />
      )}

      {dialog?.type === "delete" && (
        <DeleteModal
          article={dialog.article}
          onClose={closeDialog}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}

export default KnowledgeBase;
