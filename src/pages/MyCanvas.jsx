import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import CanvasCard from "../components/CanvasCard";
import TemplateSelectionModal from "../components/TemplateSelectionModal";
import { API_BASE_URL } from "../utils/media";
import "./MyCanvas.css";

function MyCanvas() {
  const navigate = useNavigate();
  const location = useLocation();
  const [projects, setProjects] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState(
    location.state?.successMessage || ""
  );

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_BASE_URL}/api/canvases`, {
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load your canvas projects.");
      }

      setProjects((data.projects || []).filter((p) => p.isOwner));
    } catch (requestError) {
      setError(requestError.message || "Unable to load your canvas projects.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (!location.state?.successMessage) return;

    navigate(location.pathname, {
      replace: true,
      state: null,
    });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    if (!successMessage) return undefined;

    const timer = window.setTimeout(() => setSuccessMessage(""), 4500);
    return () => window.clearTimeout(timer);
  }, [successMessage]);

  const handleTemplateSelect = (template) => {
    setIsModalOpen(false);

    navigate("/canvas/new", {
      state: {
        template,
      },
    });
  };

  const handlePublish = async (projectId) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/canvases/${projectId}/publish`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to publish project.");
      }

      // refresh list after publish
      loadProjects();

      setSuccessMessage(
        data.status === "published"
          ? "Project published successfully!"
          : "Project unpublished successfully!"
      );
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  };

  // =========================
  // DELETE PROJECT ✅ NEW
  // =========================
  const handleDelete = async (projectId) => {
    try {
      const confirmDelete = window.confirm(
        "Are you sure you want to delete this canvas?"
      );

      if (!confirmDelete) return;

      const response = await fetch(
        `${API_BASE_URL}/api/canvases/${projectId}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to delete project.");
      }

      // remove from UI instantly (no reload needed)
      setProjects((prev) =>
        prev.filter((p) => p.projectId !== projectId)
      );

      setSuccessMessage("Project deleted successfully!");
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  };

  return (
    <div className="page my-canvas-page">
      <header className="my-canvas-header">
        <div>
          <span className="my-canvas-eyebrow">Producer workspace</span>
          <h1>My Canvas</h1>
          <p>Create and manage digital signage projects for the ESG Centre.</p>
          <span className="my-canvas-count-pill">
            {projects.length} project{projects.length === 1 ? "" : "s"}
          </span>
        </div>
      </header>

      {successMessage && (
        <div className="canvas-alert canvas-alert--success" role="status">
          {successMessage}
        </div>
      )}

      {error && (
        <div className="canvas-alert canvas-alert--error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={loadProjects}>
            Try again
          </button>
        </div>
      )}

      <section className="my-canvas-panel">
        <div className="my-canvas-panel__heading">
          <div>
            <span>Your library</span>
            <h2>Canvas Projects</h2>
          </div>
        </div>

        <div className="canvas-gallery" aria-label="Canvas projects">
          <button
            type="button"
            className="add-canvas-card"
            onClick={() => setIsModalOpen(true)}
          >
            <span className="add-canvas-card__preview" aria-hidden="true">
              <span className="add-canvas-card__plus">+</span>
            </span>
            <span className="add-canvas-card__label">Add New Canvas</span>
            <span className="add-canvas-card__hint">Choose a template to get started</span>
          </button>

          {!loading &&
            projects.map((project) => (
              <CanvasCard
                key={project.projectId}
                project={project}
                onEdit={(projectId) => navigate(`/canvas/edit/${projectId}`)}
                onPublish={handlePublish}
                onDelete={handleDelete}
              />
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
            <h2>No canvas projects yet</h2>
            <p>Select "Add New Canvas" to create your first digital signage project.</p>
          </div>
        )}
      </section>

      <TemplateSelectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelect={handleTemplateSelect}
      />
    </div>
  );
}

export default MyCanvas;
