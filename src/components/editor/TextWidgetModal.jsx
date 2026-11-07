import { useMemo, useState } from "react";
import EditorModal from "./EditorModal";

function TextWidgetModal({ mode = "text", initialComponent, onClose, onDone }) {
  const initialStyle = initialComponent?.style || {};
  const [content, setContent] = useState(initialComponent?.contentText || "");
  const [textType, setTextType] = useState(initialStyle.textType || "title");
  const [color, setColor] = useState(initialStyle.color || "#000000");
  const [backgroundColor, setBackgroundColor] = useState(
    initialStyle.backgroundColor || "#ffffff"
  );
  const [backgroundOpacity, setBackgroundOpacity] = useState(
    initialStyle.backgroundOpacity ?? 0.8
  );
  const [error, setError] = useState("");
  const isTextArea = mode === "textArea";
  const characterLimit = isTextArea ? 1200 : 180;

  const stylePreview = useMemo(() => {
    if (isTextArea) {
      return {
        fontSize: 18,
        color,
        backgroundColor,
        opacity: 1,
      };
    }

    return {
      fontSize: textType === "title" ? 32 : 22,
      fontWeight: 700,
      color,
    };
  }, [backgroundColor, color, isTextArea, textType]);

  const submit = () => {
    const trimmed = content.trim();
    if (!trimmed) {
      setError("Enter text before adding the widget.");
      return;
    }

    onDone({
      contentText: trimmed,
      style: isTextArea
        ? {
          widgetKind: "textArea",
          fontSize: 18,
          fontWeight: 400,
          color,
          backgroundColor,
          backgroundOpacity: Number(backgroundOpacity),
          padding: 24,
          textAlign: initialStyle.textAlign || "left",
        }
        : {
          widgetKind: "text",
          textType,
          fontSize: textType === "title" ? 32 : 22,
          fontWeight: 700,
          color,
          textAlign: initialStyle.textAlign || "left",
        },
    });
  };

  return (
    <EditorModal
      title={isTextArea ? "Edit Text Area" : "Add Text"}
      description={
        isTextArea
          ? "The text area uses a fixed 18px font size for TV readability."
          : "Choose a fixed Title or Subtitle style designed for a 55-inch TV."
      }
      onClose={onClose}
      footer={
        <>
          <button type="button" className="editor-modal-button editor-modal-button--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="editor-modal-button editor-modal-button--primary" onClick={submit}>
            Done
          </button>
        </>
      }
    >
      {error && <div className="editor-modal-error" role="alert">{error}</div>}

      {!isTextArea && (
        <label className="editor-modal-field">
          <span>Text style</span>
          <select value={textType} onChange={(event) => setTextType(event.target.value)}>
            <option value="title">Title — 32px Bold</option>
            <option value="subtitle">Subtitle — 22px Bold</option>
          </select>
        </label>
      )}

      <label className="editor-modal-field">
        <span>{isTextArea ? "Content" : "Text"}</span>
        {isTextArea ? (
          <textarea
            rows={8}
            value={content}
            maxLength={characterLimit}
            placeholder="Enter the information to display"
            onChange={(event) => setContent(event.target.value)}
          />
        ) : (
          <input
            type="text"
            value={content}
            maxLength={characterLimit}
            placeholder="Enter a title or subtitle"
            onChange={(event) => setContent(event.target.value)}
          />
        )}
        <small>{content.length}/{characterLimit} characters</small>
      </label>

      <div className="editor-modal-grid">
        <label className="editor-modal-field">
          <span>Text colour</span>
          <input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
        </label>

        {isTextArea && (
          <label className="editor-modal-field">
            <span>Box colour</span>
            <input
              type="color"
              value={backgroundColor}
              onChange={(event) => setBackgroundColor(event.target.value)}
            />
          </label>
        )}
      </div>

      {isTextArea && (
        <label className="editor-modal-field">
          <span>Box opacity: {Math.round(Number(backgroundOpacity) * 100)}%</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={backgroundOpacity}
            onChange={(event) => setBackgroundOpacity(event.target.value)}
          />
        </label>
      )}

      <div className="text-widget-preview" style={stylePreview}>
        {content || (isTextArea ? "Text area preview" : "Text preview")}
      </div>
    </EditorModal>
  );
}

export default TextWidgetModal;
