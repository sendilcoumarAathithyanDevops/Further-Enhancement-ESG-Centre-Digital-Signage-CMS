import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiImage, FiRefreshCw, FiSearch, FiVideo } from "react-icons/fi";
import "./MediaLibrary.css";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const CATEGORIES = ["environmental", "social", "governance"];

async function readJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    await response.text();
    throw new Error(`Server returned a non-JSON response (${response.status}).`);
  }
  return response.json();
}

function formatBytes(bytes) {
  const size = Number(bytes || 0);
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function MediaLibrary() {
  const navigate = useNavigate();
  const [media, setMedia] = useState([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [savingPath, setSavingPath] = useState("");
  const [error, setError] = useState("");

  const loadMedia = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/media`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const data = await readJsonResponse(response);
      if (response.status === 401) {
        navigate("/login", { replace: true });
        return;
      }
      if (response.status === 403) {
        navigate("/dashboard", { replace: true });
        return;
      }
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load media.");
      }
      setMedia(Array.isArray(data.media) ? data.media : []);
    } catch (loadError) {
      console.error("Media library load error:", loadError);
      setError(loadError.message || "Unable to load media.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  const filteredMedia = useMemo(() => {
    const term = search.trim().toLowerCase();
    return media.filter((file) => {
      if (categoryFilter !== "all" && (file.category || "") !== categoryFilter) return false;
      if (kindFilter !== "all" && file.kind !== kindFilter) return false;
      if (!term) return true;
      return [file.originalName, file.path, file.kind]
        .some((value) => String(value || "").toLowerCase().includes(term));
    });
  }, [categoryFilter, kindFilter, media, search]);

  const updateCategory = async (file, category) => {
    setSavingPath(file.path);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/media`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path: file.path, category: category || null }),
      });
      const data = await readJsonResponse(response);
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to update category.");
      }
      setMedia((current) =>
        current.map((item) =>
          item.path === file.path ? { ...item, category: data.category } : item
        )
      );
    } catch (saveError) {
      console.error("Media category update error:", saveError);
      setError(saveError.message || "Unable to update category.");
    } finally {
      setSavingPath("");
    }
  };

  return (
    <main className="page media-library-page">
      <header className="media-library-header">
        <div>
          <span className="media-library-eyebrow">Content assets</span>
          <h1>Media Library</h1>
          <p>Search uploaded files, tag them by ESG category, and see which projects use them.</p>
        </div>
        <button
          type="button"
          className="media-refresh-button"
          onClick={loadMedia}
          disabled={loading}
        >
          <FiRefreshCw className={loading ? "media-spin" : ""} aria-hidden="true" />
          Refresh
        </button>
      </header>

      <section className="media-library-toolbar" aria-label="Media filters">
        <label className="media-search">
          <FiSearch aria-hidden="true" />
          <span className="media-visually-hidden">Search media</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by file name or path"
          />
        </label>
        <label>
          <span>Category</span>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="all">All categories</option>
            <option value="">Uncategorized</option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category[0].toUpperCase() + category.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Media type</span>
          <select value={kindFilter} onChange={(event) => setKindFilter(event.target.value)}>
            <option value="all">All types</option>
            <option value="images">Images</option>
            <option value="videos">Videos</option>
            <option value="backgrounds">Backgrounds</option>
          </select>
        </label>
        <strong className="media-result-count">{filteredMedia.length} files</strong>
      </section>

      {error && <div className="media-library-error" role="alert">{error}</div>}

      {loading ? (
        <div className="media-library-empty" aria-busy="true">
          <FiRefreshCw className="media-spin" aria-hidden="true" />
          <span>Loading media library...</span>
        </div>
      ) : filteredMedia.length === 0 ? (
        <div className="media-library-empty">
          <FiImage aria-hidden="true" />
          <span>{media.length ? "No files match these filters." : "No uploaded media files found."}</span>
        </div>
      ) : (
        <section className="media-library-grid" aria-label="Uploaded media">
          {filteredMedia.map((file) => (
            <article className="media-library-card" key={file.path}>
              <div className="media-preview">
                {file.kind === "videos" ? (
                  <video controls preload="metadata" src={`${API_BASE_URL}${file.path}`}>
                    Video preview unavailable.
                  </video>
                ) : (
                  <img src={`${API_BASE_URL}${file.path}`} alt={file.originalName} loading="lazy" />
                )}
              </div>
              <div className="media-card-content">
                <div className="media-file-heading">
                  {file.kind === "videos" ? <FiVideo aria-hidden="true" /> : <FiImage aria-hidden="true" />}
                  <strong title={file.originalName}>{file.originalName}</strong>
                </div>
                <p className="media-file-meta">{file.kind} · {formatBytes(file.size)}</p>
                <label className="media-category-control">
                  <span>ESG category</span>
                  <select
                    value={file.category || ""}
                    onChange={(event) => updateCategory(file, event.target.value)}
                    disabled={savingPath === file.path}
                  >
                    <option value="">Uncategorized</option>
                    {CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category[0].toUpperCase() + category.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="media-usage">
                  <strong>{file.referenceCount} {file.referenceCount === 1 ? "use" : "uses"}</strong>
                  {file.references.length > 0 ? (
                    <ul>
                      {file.references.slice(0, 4).map((reference, index) => (
                        <li key={`${reference.projectId}-${reference.canvasId}-${index}`}>
                          <span>{reference.projectName}</span>
                          <small>{reference.canvasName} · {reference.usage}</small>
                        </li>
                      ))}
                      {file.references.length > 4 && (
                        <li className="media-more-uses">and {file.references.length - 4} more</li>
                      )}
                    </ul>
                  ) : (
                    <p>Not currently used in a canvas.</p>
                  )}
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

export default MediaLibrary;
