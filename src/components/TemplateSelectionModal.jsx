import React, { useEffect, useRef, useState } from "react";
import CanvasPreview from "./CanvasPreview";
import { createPagesFromTemplate } from "../utils/canvasTemplates";
import { API_BASE_URL } from "../utils/media";
import "./TemplateSelectionModal.css";

function normaliseTemplate(template) {
  const templateData =
    template?.templateData ||
    template?.template_data ||
    {};

  const pages = Array.isArray(template?.pages)
    ? template.pages
    : Array.isArray(templateData?.pages)
      ? templateData.pages
      : [];

  return {
    templateId:
      template?.templateId ??
      template?.template_id ??
      null,
    key:
      template?.key ??
      template?.templateKey ??
      template?.template_key ??
      "",
    name:
      template?.name ??
      template?.templateName ??
      template?.template_name ??
      "Untitled Template",
    description: template?.description ?? "",
    category: template?.category ?? "general",
    pages,
  };
}

function TemplatePreviewGraphic({ template }) {
  const previewPages = createPagesFromTemplate(template);
  const previewPage = previewPages[0];

  return (
    <div className="template-preview">
      {previewPage ? (
        <CanvasPreview
          page={previewPage}
          projectName={template.name}
          category={template.category}
          compact
        />
      ) : (
        <div className="template-preview__empty">
          No preview available
        </div>
      )}
    </div>
  );
}

function TemplateSelectionModal({ isOpen, onClose, onSelect }) {
  const closeButtonRef = useRef(null);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousActiveElement = document.activeElement;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.classList.add("modal-open");

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.classList.remove("modal-open");
      previousActiveElement?.focus?.();
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const controller = new AbortController();

    const loadTemplates = async () => {
      try {
        setLoading(true);
        setLoadError("");

        const response = await fetch(`${API_BASE_URL}/api/templates`, {
          credentials: "include",
          signal: controller.signal,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Unable to load templates.");
        }

        const rawTemplates = Array.isArray(data)
          ? data
          : Array.isArray(data.templates)
            ? data.templates
            : [];

        setTemplates(rawTemplates.map(normaliseTemplate));
      } catch (error) {
        if (error.name !== "AbortError") {
          setLoadError(error.message || "Unable to load templates.");
        }
      } finally {
        setLoading(false);
      }
    };

    loadTemplates();

    return () => controller.abort();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="template-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="template-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-modal-title"
      >
        <div className="template-modal__header">
          <div>
            <h2 id="template-modal-title">Select a Template</h2>
            <p>Choose a starting layout for your new canvas project.</p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            className="template-modal__close"
            onClick={onClose}
            aria-label="Close template selection"
          >
            ×
          </button>
        </div>

        {loading && (
          <div className="template-modal__status" role="status">
            Loading templates…
          </div>
        )}

        {!loading && loadError && (
          <div
            className="template-modal__status template-modal__status--error"
            role="alert"
          >
            {loadError}
          </div>
        )}

        {!loading && !loadError && templates.length === 0 && (
          <div className="template-modal__status">
            No active templates are available.
          </div>
        )}

        {!loading && !loadError && templates.length > 0 && (
          <div className="template-modal__grid">
            {templates.map((template) => (
              <button
                key={template.templateId || template.key}
                type="button"
                className="template-option"
                onClick={() => onSelect(template)}
              >
                <TemplatePreviewGraphic template={template} />

                <span className="template-option__name">
                  {template.name}
                </span>

                <span className="template-option__description">
                  {template.description || "No description provided."}
                </span>

              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default TemplateSelectionModal;