import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../utils/media";
import CanvasPreview from "../components/CanvasPreview";
import "./MyCanvas.css";
import "./SharedWithMe.css";

function SharedWithMe() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch(`${API_BASE_URL}/api/canvases`, {
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load shared projects.");
      setProjects((data.projects || []).filter((p) => !p.isOwner));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  return (
    <div className="page my-canvas-page">
      <header className="my-canvas-header">
        <div>
          <span className="my-canvas-eyebrow">Producer workspace</span>
          <h1>Shared with Me</h1>
          <p>Projects other producers have shared with you.</p>
          <span className="my-canvas-count-pill">
            {projects.length} project{projects.length === 1 ? "" : "s"}
          </span>
        </div>
      </header>

      {error && (
        <div className="canvas-alert canvas-alert--error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={loadProjects}>Try again</button>
        </div>
      )}

      <section className="my-canvas-panel">
        <div className="my-canvas-panel__heading">
          <div>
            <span>Shared with you</span>
            <h2>Shared Projects</h2>
          </div>
        </div>

        <div className="canvas-gallery" aria-label="Shared projects">
          {!loading &&
            projects.map((project) => (
              <div key={project.projectId} className="shared-card">
                <div className="shared-card__preview">
                  {project.previewPage ? (
                    <CanvasPreview page={project.previewPage} compact />
                  ) : (
                    <span className="shared-card__preview--empty">No preview</span>
                  )}
                </div>

                <div className="shared-card__body">
                  <h3>{project.name}</h3>
                  <p className="shared-card__owner">Shared by {project.ownerName}</p>
                  <div className="shared-card__meta">
                    <span className={`shared-badge shared-badge--${project.myRole}`}>
                      {project.myRole === "viewer" ? "View only" : "Can edit"}
                    </span>
                    <span>{project.pageCount} page{project.pageCount !== 1 ? "s" : ""}</span>
                  </div>

                  {project.myRole === "viewer" ? (
                    <button
                      type="button"
                      className="shared-card__btn shared-card__btn--view"
                      onClick={() => navigate(`/canvas/view/${project.projectId}`)}
                    >
                      👁 View
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="shared-card__btn shared-card__btn--edit"
                      onClick={() =>
                        navigate(`/canvas/edit/${project.projectId}`, {
                          state: { from: "shared" },
                        })
                      }
                    >
                      ✏️ Edit
                    </button>
                  )}
                </div>
              </div>
            ))}

          {loading &&
            Array.from({ length: 3 }).map((_, index) => (
              <div className="canvas-card-skeleton" key={index} aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            ))}
        </div>

        {!loading && !error && projects.length === 0 && (
          <div className="canvas-empty-state">
            <h2>Nothing shared with you yet</h2>
            <p>When another producer shares a project with you, it will appear here.</p>
          </div>
        )}
      </section>
    </div>
  );
}

export default SharedWithMe;