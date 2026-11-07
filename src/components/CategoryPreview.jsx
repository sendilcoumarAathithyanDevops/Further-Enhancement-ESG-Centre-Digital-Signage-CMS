import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import CanvasPreview from "./CanvasPreview";
import "./CategoryPreview.css";

const API_BASE = "http://localhost:5000";
const PROJECTS_ENDPOINT = `${API_BASE}/api/preview/projects`;
const PAGES_PER_FRAME = 4;
const SHOW_NUMBERS_UP_TO = 12;

function normaliseCategory(value) {
  if (!value) return null;
  const v = String(value).toLowerCase();
  if (v.includes("env")) return "environmental";
  if (v.includes("soc")) return "social";
  if (v.includes("gov")) return "governance";
  return v;
}

function normaliseProjects(raw) {
  const list = Array.isArray(raw) ? raw : raw?.projects || [];
  return list.map((p) => ({
    projectId: p.projectId ?? p.id ?? p._id,
    name: p.name ?? p.projectName ?? "Untitled",
    category: normaliseCategory(p.category ?? p.esgCategory ?? p.tag),
    pages: Array.isArray(p.pages) ? p.pages : [],
  }));
}

const CATEGORY_META = {
  environmental: {
    emoji: "🌱",
    label: "Environmental",
  },
  social: {
    emoji: "👥",
    label: "Social",
  },
  governance: {
    emoji: "🏛️",
    label: "Governance",
  },
};

function CategoryBadge({ category }) {
  const key = String(category || "").trim().toLowerCase();
  const meta = CATEGORY_META[key];

  console.log("Category:", key, meta);

  if (!meta) {
    return <span>{category}</span>;
  }

  return (
    <span className={`category-badge ${key}`}>
      {meta.emoji} {meta.label}
    </span>
  );
}

function buildFrames(projects) {
  const frames = [];
  projects.forEach((project) => {
    const pages = Array.isArray(project.pages) ? project.pages : [];
    if (pages.length === 0) {
      frames.push({ projectId: project.projectId, projectName: project.name, category: project.category, pages: [] });
      return;
    }
    for (let i = 0; i < pages.length; i += PAGES_PER_FRAME) {
      frames.push({
        projectId: project.projectId,
        projectName: project.name,
        category: project.category,
        pages: pages.slice(i, i + PAGES_PER_FRAME),
      });
    }
  });
  return frames;
}

function PreviewGrid({ frame }) {
  const pages = frame?.pages || [];
  const cells = Array.from({ length: PAGES_PER_FRAME }, (_, i) => pages[i] || null);

  return (
    <div className="preview-wall__grid">
      {cells.map((page, i) => (
        <div className="preview-wall__cell" key={page?.canvasId ?? page?.clientId ?? i}>
          {page ? (
            <CanvasPreview page={page} pageNumber={i + 1} projectName={frame?.projectName} category={frame?.category} compact />
          ) : (
            <div className="preview-wall__cell-empty" aria-hidden="true" />
          )}
        </div>
      ))}
    </div>
  );
}

function CategoryPreview({ projects: projectsProp = null, initialProjectId = null }) {
  const [searchParams] = useSearchParams();
  // A "Preview" button can link to /category-preview?project=<id> to open that project.
  const deepLinkProjectId = initialProjectId ?? searchParams.get("project");

  const [projects, setProjects] = useState(projectsProp || []);
  const [loading, setLoading] = useState(!projectsProp);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const [frame, setFrame] = useState(0);

  // ── Load projects (only if not passed in) ────────────────────────────────
  useEffect(() => {
    if (projectsProp) {
      setProjects(projectsProp);
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(PROJECTS_ENDPOINT, { credentials: "include" });
        if (!res.ok) throw new Error(`Could not load projects (${res.status}).`);
        const data = await res.json();
        if (active) setProjects(normaliseProjects(data));
      } catch (err) {
        if (active) setError(err.message || "Could not load projects.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [projectsProp]);

  const frames = useMemo(() => buildFrames(projects), [projects]);

  // Jump to the deep-linked project once, after data has loaded.
  const appliedDeepLink = useRef(false);
  useEffect(() => {
    if (appliedDeepLink.current || !frames.length) return;
    if (deepLinkProjectId) {
      const idx = frames.findIndex(
        (f) => String(f.projectId) === String(deepLinkProjectId)
      );
      if (idx >= 0) setFrame(idx);
    }
    appliedDeepLink.current = true;
  }, [frames, deepLinkProjectId]);

  // ── Render states ────────────────────────────────────────────────────────
  if (loading) {
    return <div className="preview-wall preview-wall--message">Loading projects…</div>;
  }
  if (error) {
    return (
      <div className="preview-wall preview-wall--message preview-wall--error">{error}</div>
    );
  }

  const total = frames.length;
  const safeFrame = Math.min(frame, Math.max(0, total - 1));
  const currentFrame = frames[safeFrame] || null;

  const goToFrame = (i) =>
    setFrame(Math.min(Math.max(0, i), Math.max(0, total - 1)));

  return (
    <>
      <button
        type="button"
        className="button-back preview-wall__back"
        onClick={() => navigate(-1)}
      >
        ← Back
      </button>

      <div className="preview-wall">
        {total === 0 ? (
          <div className="preview-wall__placeholder">
            No published projects to preview yet.
          </div>
        ) : (
          <>
            <div className="preview-wall__stage" key={`ind-${safeFrame}`}>
              <div className="preview-wall__title">
                <h2>{currentFrame?.projectName || "Untitled Project"}</h2>
                {currentFrame?.category && (
                  <CategoryBadge category={currentFrame.category} />
                )}
              </div>
              <PreviewGrid frame={currentFrame} />
            </div>

            <div className="preview-wall__pager">
              <button
                type="button"
                className="preview-wall__pager-btn"
                onClick={() => goToFrame(safeFrame - 1)}
                disabled={safeFrame === 0}
              >
                ‹ Prev
              </button>

              {total <= SHOW_NUMBERS_UP_TO ? (
                frames.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`preview-wall__pager-num ${i === safeFrame ? "is-current" : ""
                      }`}
                    aria-current={i === safeFrame ? "true" : undefined}
                    onClick={() => goToFrame(i)}
                  >
                    {i + 1}
                  </button>
                ))
              ) : (
                <span className="preview-wall__pager-counter">
                  {safeFrame + 1} / {total}
                </span>
              )}

              <button
                type="button"
                className="preview-wall__pager-btn"
                onClick={() => goToFrame(safeFrame + 1)}
                disabled={safeFrame >= total - 1}
              >
                Next ›
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default CategoryPreview;