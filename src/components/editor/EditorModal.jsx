import { useEffect, useRef } from "react";
import "./EditorModal.css";

function EditorModal({ title, description, children, onClose, footer, wide = false, className = "" }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const previousActiveElement = document.activeElement;
    const dialog = dialogRef.current;
    const firstFocusable = dialog?.querySelector(
      "button, input, textarea, select, [tabindex]:not([tabindex='-1'])"
    );
    firstFocusable?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialog) return;
      const focusable = [...dialog.querySelectorAll(
        "button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex='-1'])"
      )];
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousActiveElement?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="editor-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className={`editor-modal ${wide ? "editor-modal--wide" : ""} ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-modal-title"
      >
        <header className="editor-modal__header">
          <div>
            <h2 id="editor-modal-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button type="button" className="editor-modal__close" onClick={onClose} aria-label="Close dialog">
            ×
          </button>
        </header>
        <div className="editor-modal__body">{children}</div>
        {footer && <footer className="editor-modal__footer">{footer}</footer>}
      </section>
    </div>
  );
}

export default EditorModal;
