import React, { useMemo, useState } from "react";
import CanvasPreview from "./CanvasPreview";
import "./CanvasCard.css";

function formatUpdatedDate(value) {
  if (!value) return "Not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  return new Intl.DateTimeFormat("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function CanvasCard({ project, onEdit, onPublish, onDelete }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const description = project.description || "No description provided.";
  const shouldShowToggle = useMemo(() => description.length > 140, [description]);

  return (
    <article className="saved-canvas-card">
      <div className="saved-canvas-card__preview">
        <CanvasPreview
          page={project.previewPage}
          projectName={project.name}
          description={project.description}
          category={project.category}
          compact
        />
      </div>

      <div className="saved-canvas-card__body">
        <div className="saved-canvas-card__title-row">
          <h2>{project.name}</h2>
          <span className={`category-pill category-pill--${project.category}`}>
            {project.category}
          </span>
        </div>

        <div className="saved-canvas-card__description-wrap">
          <p className={`saved-canvas-card__description ${isExpanded ? "is-expanded" : ""}`}>
            {description}
          </p>
          {shouldShowToggle && (
            <button
              type="button"
              className="saved-canvas-card__read-more"
              onClick={() => setIsExpanded((value) => !value)}
            >
              {isExpanded ? "Show less" : "Read more"}
            </button>
          )}
        </div>

        <div className="saved-canvas-card__meta">
          <span>
            {project.pageCount} {project.pageCount === 1 ? "page" : "pages"}
          </span>
          <span>Updated {formatUpdatedDate(project.updatedAt)}</span>
        </div>

        <div className="saved-canvas-card__actions">
          <button
            type="button"
            className="saved-canvas-card__edit"
            onClick={() => onEdit(project.projectId)}
            disabled={project.status === "published"}
          >
            Edit
          </button>

          <button
            type="button"
            className="saved-canvas-card__publish"
            onClick={() => onPublish?.(project.projectId)}
          >
            {project.status === "published" ? "Unpublish" : "Publish"}
          </button>

          {/* DELETE BUTTON */}
          <button
            type="button"
            className="saved-canvas-card__delete"
            disabled={project.status === "published"}
            onClick={() => {
              if (window.confirm("Are you sure you want to delete this project?")) {
                onDelete?.(project.projectId);
              }
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}

export default CanvasCard;