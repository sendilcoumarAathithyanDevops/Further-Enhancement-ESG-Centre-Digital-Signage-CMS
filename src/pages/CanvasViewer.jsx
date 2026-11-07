import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE_URL } from "../utils/media";
import CanvasPreview from "../components/CanvasPreview";
import "./SharedWithMe.css";

function CanvasViewer() {
  const { canvasId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/canvases/${canvasId}`, {
          credentials: "include",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to load this project.");
        setProject(data.project);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [canvasId]);

  if (loading) {
    return (
      <div className="page my-canvas-page">
        <p>Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page my-canvas-page">
        <div className="canvas-alert canvas-alert--error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => navigate("/shared")}>
            Back to Shared with Me
          </button>
        </div>
      </div>
    );
  }

  const pages = project?.pages || [];
  const currentPage = pages[pageIndex];

  return (
    <div className="page my-canvas-page">
      <button
        type="button"
        className="button-back"
        onClick={() => navigate("/shared")}
      >
        ← Back to Shared with Me
      </button>

      <header className="viewer-header">
        <h1>
          {project.name}
          <span className="shared-badge shared-badge--viewer">View only</span>
        </h1>
      </header>

      {pages.length > 1 && (
        <div className="viewer-page-tabs" role="tablist" aria-label="Project pages">
          {pages.map((page, index) => (
            <button
              key={page.canvasId || index}
              type="button"
              role="tab"
              aria-selected={index === pageIndex}
              className={`viewer-tab ${index === pageIndex ? "viewer-tab--active" : ""}`}
              onClick={() => setPageIndex(index)}
            >
              {page.name || `Page ${index + 1}`}
            </button>
          ))}
        </div>
      )}

      {currentPage && (
        <div className="viewer-canvas-frame">
          <CanvasPreview
            page={currentPage}
            projectName={project.name}
            description={project.description}
            category={project.category}
            compact
          />
        </div>
      )}
    </div>
  );
}

export default CanvasViewer;