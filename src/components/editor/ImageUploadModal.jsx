import { useEffect, useMemo, useRef, useState } from "react";
import EditorModal from "./EditorModal";
import { API_BASE_URL } from "../../utils/media";
import "./MediaModals.css";

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_SIZE = 15 * 1024 * 1024;
const RATIO_OPTIONS = [
  { value: "original", label: "Original" },
  { value: "16:9", label: "16:9" },
  { value: "4:3", label: "4:3" },
  { value: "1:1", label: "1:1" },
  { value: "3:2", label: "3:2" },
];

function ratioToNumber(ratio, item) {
  if (ratio === "16:9") return 16 / 9;
  if (ratio === "4:3") return 4 / 3;
  if (ratio === "1:1") return 1;
  if (ratio === "3:2") return 3 / 2;
  return item?.naturalWidth && item?.naturalHeight
    ? item.naturalWidth / item.naturalHeight
    : 16 / 9;
}

async function inspectImage(file) {
  const previewUrl = URL.createObjectURL(file);
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      resolve({
        id: `${file.name}-${file.lastModified}-${Math.random()}`,
        file,
        previewUrl,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        ratio: "original",
        objectFit: "cover",
        focusX: 50,
        focusY: 50,
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(previewUrl);
      resolve(null);
    };
    image.src = previewUrl;
  });
}

function ImageUploadModal({ onClose, onDone, initialComponent }) {
  const [items, setItems] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [displayMode, setDisplayMode] = useState(
    initialComponent?.style?.displayMode || "individual"
  );
  const [interval, setIntervalValue] = useState(
    Number(initialComponent?.style?.slideshowInterval) || 5
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const itemsRef = useRef([]);
  const activeItem = items.find((item) => item.id === activeId) || items[0];

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => () => {
    itemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
  }, []);

  const addFiles = async (fileList) => {
    setError("");
    const candidates = [...fileList];
    const invalid = candidates.find(
      (file) => !ACCEPTED_TYPES.has(file.type) || file.size > MAX_IMAGE_SIZE
    );
    if (invalid) {
      setError("Use JPG, PNG, or WebP images up to 15 MB each.");
      return;
    }

    if (items.length + candidates.length > 20) {
      setError("You can upload at most 20 images at one time.");
      return;
    }

    const inspected = (await Promise.all(candidates.map(inspectImage))).filter(Boolean);
    if (inspected.length !== candidates.length) {
      setError("One or more images could not be read.");
    }
    setItems((current) => [...current, ...inspected]);
    setActiveId((current) => current || inspected[0]?.id || null);
  };

  const removeItem = (itemId) => {
    setItems((current) => {
      const removed = current.find((item) => item.id === itemId);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      const next = current.filter((item) => item.id !== itemId);
      if (activeId === itemId) setActiveId(next[0]?.id || null);
      return next;
    });
  };

  const updateActive = (patch) => {
    if (!activeItem) return;
    setItems((current) =>
      current.map((item) => (item.id === activeItem.id ? { ...item, ...patch } : item))
    );
  };

  const previewRatio = useMemo(
    () => ratioToNumber(activeItem?.ratio, activeItem),
    [activeItem]
  );

  const upload = async () => {
    if (items.length === 0) {
      setError("Select at least one image.");
      return;
    }
    if (displayMode === "slideshow" && (Number(interval) < 1 || Number(interval) > 120)) {
      setError("The slideshow interval must be between 1 and 120 seconds.");
      return;
    }

    try {
      setUploading(true);
      setError("");
      const formData = new FormData();
      items.forEach((item) => formData.append("files", item.file));

      const response = await fetch(`${API_BASE_URL}/api/uploads/images`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to upload the images.");

      onDone({
        paths: data.files.map((file) => file.path),
        displayMode: items.length === 1 ? "individual" : displayMode,
        slideshowInterval: Number(interval),
        settings: items.map((item) => ({
          aspectRatioChoice: item.ratio,
          aspectRatio: ratioToNumber(item.ratio, item),
          objectFit: item.objectFit,
          focusX: Number(item.focusX),
          focusY: Number(item.focusY),
          originalWidth: item.naturalWidth,
          originalHeight: item.naturalHeight,
        })),
      });
    } catch (uploadError) {
      setError(uploadError.message || "Unable to upload the images.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <EditorModal
      title="Add Images"
      description="Upload, crop, and choose how one or more images should appear."
      onClose={uploading ? () => {} : onClose}
      wide
      footer={
        <>
          <button type="button" className="editor-modal-button editor-modal-button--secondary" onClick={onClose} disabled={uploading}>
            Cancel
          </button>
          <button type="button" className="editor-modal-button editor-modal-button--primary" onClick={upload} disabled={uploading || items.length === 0}>
            {uploading ? "Uploading…" : "Done"}
          </button>
        </>
      }
    >
      {error && <div className="editor-modal-error" role="alert">{error}</div>}

      <label
        className="media-dropzone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); addFiles(event.dataTransfer.files); }}
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(event) => addFiles(event.target.files)}
        />
        <strong>Select or drag image files here</strong>
        <span>JPG, PNG, or WebP · Maximum 15 MB each</span>
      </label>

      {items.length > 0 && (
        <div className="image-editor-layout">
          <div className="image-editor-thumbnails" aria-label="Selected images">
            {items.map((item, index) => (
              <div key={item.id} className={`image-thumbnail ${item.id === activeItem?.id ? "is-active" : ""}`}>
                <button type="button" onClick={() => setActiveId(item.id)}>
                  <img src={item.previewUrl} alt={`Selected upload ${index + 1}`} />
                  <span>{item.file.name}</span>
                </button>
                <button type="button" className="image-thumbnail__remove" onClick={() => removeItem(item.id)} aria-label={`Remove ${item.file.name}`}>
                  ×
                </button>
              </div>
            ))}
          </div>

          {activeItem && (
            <div className="image-crop-panel">
              <div
                className="image-crop-preview"
                style={{ aspectRatio: previewRatio }}
                aria-label="Image crop preview"
              >
                <img
                  src={activeItem.previewUrl}
                  alt="Crop preview"
                  style={{
                    objectFit: activeItem.objectFit === "fill" ? "fill" : activeItem.objectFit,
                    objectPosition: `${activeItem.focusX}% ${activeItem.focusY}%`,
                  }}
                />
              </div>

              <div className="editor-modal-grid">
                <label className="editor-modal-field">
                  <span>Image ratio</span>
                  <select value={activeItem.ratio} onChange={(event) => updateActive({ ratio: event.target.value })}>
                    {RATIO_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="editor-modal-field">
                  <span>Image fitting</span>
                  <select value={activeItem.objectFit} onChange={(event) => updateActive({ objectFit: event.target.value })}>
                    <option value="cover">Cover</option>
                    <option value="contain">Contain</option>
                    <option value="fill">Fill</option>
                  </select>
                </label>
              </div>

              <label className="editor-modal-field">
                <span>Horizontal crop focus: {activeItem.focusX}%</span>
                <input type="range" min="0" max="100" value={activeItem.focusX} onChange={(event) => updateActive({ focusX: event.target.value })} />
              </label>
              <label className="editor-modal-field">
                <span>Vertical crop focus: {activeItem.focusY}%</span>
                <input type="range" min="0" max="100" value={activeItem.focusY} onChange={(event) => updateActive({ focusY: event.target.value })} />
              </label>
            </div>
          )}
        </div>
      )}

      {items.length > 1 && (
        <div className="media-display-options">
          <label>
            <input type="radio" name="image-display-mode" value="individual" checked={displayMode === "individual"} onChange={(event) => setDisplayMode(event.target.value)} />
            <span><strong>Individual images</strong><small>Place and resize each image separately.</small></span>
          </label>
          <label>
            <input type="radio" name="image-display-mode" value="slideshow" checked={displayMode === "slideshow"} onChange={(event) => setDisplayMode(event.target.value)} />
            <span><strong>Slideshow</strong><small>Show all images in one automatically looping widget.</small></span>
          </label>
          {displayMode === "slideshow" && (
            <label className="editor-modal-field media-interval-field">
              <span>Change image every</span>
              <select value={[3, 5, 10].includes(Number(interval)) ? interval : "custom"} onChange={(event) => {
                if (event.target.value !== "custom") setIntervalValue(Number(event.target.value));
              }}>
                <option value="3">3 seconds</option>
                <option value="5">5 seconds</option>
                <option value="10">10 seconds</option>
                <option value="custom">Custom</option>
              </select>
              {![3, 5, 10].includes(Number(interval)) && (
                <input type="number" min="1" max="120" value={interval} onChange={(event) => setIntervalValue(event.target.value)} aria-label="Custom slideshow interval in seconds" />
              )}
            </label>
          )}
        </div>
      )}
    </EditorModal>
  );
}

export default ImageUploadModal;
