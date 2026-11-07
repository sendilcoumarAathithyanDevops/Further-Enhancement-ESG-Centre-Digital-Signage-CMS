import { useMemo, useState } from "react";
import EditorModal from "./EditorModal";
import { resolveMediaUrl } from "../../utils/media";
import "./MediaModals.css";

const RATIO_OPTIONS = [
  { value: "original", label: "Original" },
  { value: "16:9", label: "16:9", ratio: 16 / 9 },
  { value: "4:3", label: "4:3", ratio: 4 / 3 },
  { value: "1:1", label: "1:1", ratio: 1 },
  { value: "3:2", label: "3:2", ratio: 3 / 2 },
];

function ImageSettingsModal({ component, onClose, onDone }) {
  const initialStyle = component.style || {};
  const paths = Array.isArray(initialStyle.imagePaths) && initialStyle.imagePaths.length > 0
    ? initialStyle.imagePaths
    : component.filePath
      ? [component.filePath]
      : [];
  const initialSettings = paths.map((path, index) => ({
    path,
    aspectRatioChoice:
      initialStyle.imageSettings?.[index]?.aspectRatioChoice ||
      initialStyle.aspectRatioChoice ||
      "original",
    aspectRatio:
      Number(initialStyle.imageSettings?.[index]?.aspectRatio) ||
      Number(initialStyle.aspectRatio) ||
      16 / 9,
    objectFit:
      initialStyle.imageSettings?.[index]?.objectFit || initialStyle.objectFit || "cover",
    focusX: Number(initialStyle.imageSettings?.[index]?.focusX ?? initialStyle.focusX ?? 50),
    focusY: Number(initialStyle.imageSettings?.[index]?.focusY ?? initialStyle.focusY ?? 50),
    originalWidth: Number(initialStyle.imageSettings?.[index]?.originalWidth) || null,
    originalHeight: Number(initialStyle.imageSettings?.[index]?.originalHeight) || null,
  }));
  const [settings, setSettings] = useState(initialSettings);
  const [activeIndex, setActiveIndex] = useState(0);
  const [interval, setIntervalValue] = useState(Number(initialStyle.slideshowInterval) || 5);
  const active = settings[activeIndex];

  const previewRatio = useMemo(() => Number(active?.aspectRatio) || 16 / 9, [active]);

  const updateActive = (patch) => {
    setSettings((current) =>
      current.map((item, index) => (index === activeIndex ? { ...item, ...patch } : item))
    );
  };

  const changeRatio = (choice) => {
    const selected = RATIO_OPTIONS.find((item) => item.value === choice);
    const originalRatio =
      active.originalWidth && active.originalHeight
        ? active.originalWidth / active.originalHeight
        : active.aspectRatio || 16 / 9;
    updateActive({
      aspectRatioChoice: choice,
      aspectRatio: selected?.ratio || originalRatio,
    });
  };

  const submit = () => {
    const first = settings[0] || {};
    onDone({
      ...initialStyle,
      widgetKind: "image",
      imagePaths: paths,
      imageSettings: settings.map(({ path, ...item }) => item),
      slideshowInterval: Math.min(Math.max(Number(interval) || 5, 1), 120),
      aspectRatioChoice: first.aspectRatioChoice || "original",
      aspectRatio: Number(first.aspectRatio) || 16 / 9,
      objectFit: first.objectFit || "cover",
      focusX: first.focusX ?? 50,
      focusY: first.focusY ?? 50,
      lockAspectRatio: true,
    });
  };

  return (
    <EditorModal
      title="Image Settings"
      description="Adjust the crop focus, ratio, fitting, and slideshow speed."
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="editor-modal-button editor-modal-button--secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="editor-modal-button editor-modal-button--primary" onClick={submit}>Done</button>
        </>
      }
    >
      <div className="image-editor-layout">
        <div className="image-editor-thumbnails">
          {settings.map((item, index) => (
            <div key={`${item.path}-${index}`} className={`image-thumbnail ${index === activeIndex ? "is-active" : ""}`}>
              <button type="button" onClick={() => setActiveIndex(index)}>
                <img src={resolveMediaUrl(item.path)} alt={`Slideshow item ${index + 1}`} />
                <span>Image {index + 1}</span>
              </button>
            </div>
          ))}
        </div>

        {active && (
          <div className="image-crop-panel">
            <div className="image-crop-preview" style={{ aspectRatio: previewRatio }}>
              <img
                src={resolveMediaUrl(active.path)}
                alt="Crop preview"
                style={{
                  objectFit: active.objectFit === "fill" ? "fill" : active.objectFit,
                  objectPosition: `${active.focusX}% ${active.focusY}%`,
                }}
              />
            </div>
            <div className="editor-modal-grid">
              <label className="editor-modal-field">
                <span>Image ratio</span>
                <select value={active.aspectRatioChoice} onChange={(event) => changeRatio(event.target.value)}>
                  {RATIO_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="editor-modal-field">
                <span>Image fitting</span>
                <select value={active.objectFit} onChange={(event) => updateActive({ objectFit: event.target.value })}>
                  <option value="cover">Cover</option>
                  <option value="contain">Contain</option>
                  <option value="fill">Fill</option>
                </select>
              </label>
            </div>
            <label className="editor-modal-field">
              <span>Horizontal crop focus: {active.focusX}%</span>
              <input type="range" min="0" max="100" value={active.focusX} onChange={(event) => updateActive({ focusX: Number(event.target.value) })} />
            </label>
            <label className="editor-modal-field">
              <span>Vertical crop focus: {active.focusY}%</span>
              <input type="range" min="0" max="100" value={active.focusY} onChange={(event) => updateActive({ focusY: Number(event.target.value) })} />
            </label>
            {initialStyle.displayMode === "slideshow" && (
              <label className="editor-modal-field">
                <span>Slideshow interval (seconds)</span>
                <input type="number" min="1" max="120" value={interval} onChange={(event) => setIntervalValue(event.target.value)} />
              </label>
            )}
          </div>
        )}
      </div>
    </EditorModal>
  );
}

export default ImageSettingsModal;
