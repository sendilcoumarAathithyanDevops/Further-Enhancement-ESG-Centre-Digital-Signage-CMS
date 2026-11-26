import { useMemo, useState } from "react";
import EditorModal from "./EditorModal";
import { hexToRgba } from "../../utils/media";

const FONT_FAMILIES = [
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "\"Trebuchet MS\", sans-serif", label: "Trebuchet MS" },
  { value: "system-ui, sans-serif", label: "System" },
];
const FONT_WEIGHTS = ["400", "500", "600", "700"];
const TEXT_ALIGNMENTS = ["left", "center", "right"];

function TextWidgetModal({ mode = "text", initialComponent, onClose, onDone }) {
  const initialStyle = initialComponent?.style || {};
  const isTextArea = mode === "textArea";
  const defaultFontSize = isTextArea
    ? 18
    : initialStyle.textType === "subtitle"
      ? 22
      : 32;
  const savedFontSize = Number(initialStyle.fontSize);
  const initialFontSize = Number.isFinite(savedFontSize) && savedFontSize > 0
    ? Math.min(120, Math.max(8, savedFontSize))
    : defaultFontSize;
  const [content, setContent] = useState(initialComponent?.contentText || "");
  const [textType, setTextType] = useState(initialStyle.textType || "title");
  const [fontSize, setFontSize] = useState(initialFontSize);
  const [color, setColor] = useState(initialStyle.color || "#000000");
  const [backgroundColor, setBackgroundColor] = useState(
    initialStyle.backgroundColor || "#ffffff"
  );
  const [backgroundOpacity, setBackgroundOpacity] = useState(
    initialStyle.backgroundOpacity ?? (isTextArea ? 0.8 : 0)
  );
  const [fontWeight, setFontWeight] = useState(
    FONT_WEIGHTS.includes(String(initialStyle.fontWeight))
      ? String(initialStyle.fontWeight)
      : isTextArea ? "400" : "700"
  );
  const [fontFamily, setFontFamily] = useState(
    FONT_FAMILIES.some((option) => option.value === initialStyle.fontFamily)
      ? initialStyle.fontFamily
      : FONT_FAMILIES[0].value
  );
  const [textAlign, setTextAlign] = useState(
    TEXT_ALIGNMENTS.includes(initialStyle.textAlign)
      ? initialStyle.textAlign
      : "left"
  );
  const [lineHeight, setLineHeight] = useState(
    Math.min(2, Math.max(1, Number(initialStyle.lineHeight) || (isTextArea ? 1.4 : 1.2)))
  );
  const savedPadding = Number(initialStyle.padding);
  const [padding, setPadding] = useState(
    Math.min(48, Math.max(0, Number.isFinite(savedPadding) ? savedPadding : 24))
  );
  const [error, setError] = useState("");
  const characterLimit = isTextArea ? 1200 : 180;

  const stylePreview = useMemo(
    () => ({
      display: "flex",
      alignItems: "center",
      fontSize,
      fontWeight,
      fontFamily,
      color,
      textAlign,
      lineHeight,
      padding: `${padding}px`,
      backgroundColor: Number(backgroundOpacity) > 0
        ? hexToRgba(backgroundColor, Number(backgroundOpacity))
        : "transparent",
    }),
    [
      backgroundColor,
      backgroundOpacity,
      color,
      fontFamily,
      fontSize,
      fontWeight,
      lineHeight,
      padding,
      textAlign,
    ]
  );

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
          fontSize,
          fontWeight,
          fontFamily,
          color,
          backgroundColor,
          backgroundOpacity: Number(backgroundOpacity),
          padding,
          textAlign,
          lineHeight,
        }
        : {
          widgetKind: "text",
          textType,
          fontSize,
          fontWeight,
          fontFamily,
          color,
          backgroundColor,
          backgroundOpacity: Number(backgroundOpacity),
          padding,
          textAlign,
          lineHeight,
        },
    });
  };

  return (
    <EditorModal
      title={isTextArea ? "Edit Text Area" : "Add Text"}
      description={
        isTextArea
          ? "Set the typography, alignment, and text box appearance."
          : "Choose a title or subtitle, then tune its typography and appearance."
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
          <select
            value={textType}
            onChange={(event) => {
              const nextTextType = event.target.value;
              setTextType(nextTextType);
              setFontSize(nextTextType === "title" ? 32 : 22);
            }}
          >
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

      <label className="editor-modal-field">
        <span>Font size: {fontSize}px</span>
        <div className="text-widget-size-controls">
          <input
            type="range"
            min="8"
            max="120"
            step="1"
            value={fontSize}
            aria-label="Font size"
            onChange={(event) => setFontSize(Number(event.target.value))}
          />
          <input
            type="number"
            min="8"
            max="120"
            step="1"
            value={fontSize}
            aria-label="Font size in pixels"
            onChange={(event) =>
              setFontSize(Math.min(120, Math.max(8, Number(event.target.value) || 8)))
            }
          />
        </div>
      </label>

      <div className="editor-modal-grid">
        <label className="editor-modal-field">
          <span>Text colour</span>
          <input
            type="color"
            value={color}
            aria-label="Text colour"
            onChange={(event) => setColor(event.target.value)}
          />
        </label>

        <label className="editor-modal-field">
          <span>Box colour</span>
          <input
            type="color"
            value={backgroundColor}
            aria-label="Box colour"
            onChange={(event) => setBackgroundColor(event.target.value)}
          />
        </label>
      </div>

      <div className="editor-modal-grid">
        <label className="editor-modal-field">
          <span>Font weight</span>
          <select value={fontWeight} onChange={(event) => setFontWeight(event.target.value)}>
            <option value="400">Regular</option>
            <option value="500">Medium</option>
            <option value="600">Semi-bold</option>
            <option value="700">Bold</option>
          </select>
        </label>
        <label className="editor-modal-field">
          <span>Font family</span>
          <select value={fontFamily} onChange={(event) => setFontFamily(event.target.value)}>
            {FONT_FAMILIES.map((font) => (
              <option key={font.value} value={font.value}>{font.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="editor-modal-grid">
        <label className="editor-modal-field">
          <span>Text alignment</span>
          <select value={textAlign} onChange={(event) => setTextAlign(event.target.value)}>
            {TEXT_ALIGNMENTS.map((alignment) => (
              <option key={alignment} value={alignment}>
                {alignment[0].toUpperCase() + alignment.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label className="editor-modal-field">
          <span>Line spacing: {Number(lineHeight).toFixed(2)}</span>
          <input
            type="range"
            min="1"
            max="2"
            step="0.05"
            value={lineHeight}
            aria-label="Line spacing"
            onChange={(event) => setLineHeight(Number(event.target.value))}
          />
        </label>
      </div>

      <div className="editor-modal-grid">
        <label className="editor-modal-field">
          <span>Box opacity: {Math.round(Number(backgroundOpacity) * 100)}%</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={backgroundOpacity}
            aria-label="Box opacity"
            onChange={(event) => setBackgroundOpacity(event.target.value)}
          />
        </label>
        <label className="editor-modal-field">
          <span>Box padding: {padding}px</span>
          <input
            type="range"
            min="0"
            max="48"
            step="2"
            value={padding}
            aria-label="Box padding"
            onChange={(event) => setPadding(Number(event.target.value))}
          />
        </label>
      </div>

      <div className="text-widget-preview" style={stylePreview}>
        <span>{content || (isTextArea ? "Text area preview" : "Text preview")}</span>
      </div>
    </EditorModal>
  );
}

export default TextWidgetModal;
