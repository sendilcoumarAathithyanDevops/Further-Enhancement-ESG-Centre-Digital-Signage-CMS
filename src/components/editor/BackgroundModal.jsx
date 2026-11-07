import { useEffect, useMemo, useRef, useState } from "react";
import EditorModal from "./EditorModal";
import { API_BASE_URL, hexToRgba, resolveMediaUrl } from "../../utils/media";
import {
  getBackgroundImageStyle,
  normaliseBackgroundSettings,
} from "../../utils/backgroundSettings";
import "./MediaModals.css";

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BACKGROUND_SIZE = 20 * 1024 * 1024;
const DEFAULT_CANVAS_WIDTH = 1920;
const DEFAULT_CANVAS_HEIGHT = 1080;

function validHex(value) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function BackgroundModal({ page, projectName, category, canvasWidth = DEFAULT_CANVAS_WIDTH, canvasHeight = DEFAULT_CANVAS_HEIGHT, onClose, onDone }) {
  const initialSettings = normaliseBackgroundSettings(page?.backgroundSettings || {});
  const initialImagePath = page?.backgroundImagePath || null;
  const previewCanvasWidth = Number(canvasWidth) || DEFAULT_CANVAS_WIDTH;
  const previewCanvasHeight = Number(canvasHeight) || DEFAULT_CANVAS_HEIGHT;

  const [colour, setColour] = useState(page?.backgroundColor || "#ffffff");
  const [colourOpacity, setColourOpacity] = useState(initialSettings.backgroundColorOpacity);
  const [imageOpacity, setImageOpacity] = useState(initialSettings.backgroundImageOpacity);
  const [fit, setFit] = useState(initialSettings.backgroundFit);
  const [imageScale, setImageScale] = useState(initialSettings.backgroundScale);
  const [imageX, setImageX] = useState(initialSettings.backgroundPositionX);
  const [imageY, setImageY] = useState(initialSettings.backgroundPositionY);
  const [originalWidth, setOriginalWidth] = useState(initialSettings.backgroundOriginalWidth);
  const [originalHeight, setOriginalHeight] = useState(initialSettings.backgroundOriginalHeight);
  const [file, setFile] = useState(null);
  const [imagePath, setImagePath] = useState(initialImagePath);
  const [previewUrl, setPreviewUrl] = useState(
    initialImagePath ? resolveMediaUrl(initialImagePath) : ""
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef(null);

  useEffect(() => () => {
    if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (!previewUrl) return undefined;

    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth > 0 && image.naturalHeight > 0) {
        setOriginalWidth(image.naturalWidth);
        setOriginalHeight(image.naturalHeight);
      }
    };
    image.onerror = () => setError("The selected background image could not be loaded.");
    image.src = previewUrl;

    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, [previewUrl]);

  const previewSettings = useMemo(() => normaliseBackgroundSettings({
    backgroundFit: fit,
    backgroundColorOpacity: colourOpacity,
    backgroundImageOpacity: imageOpacity,
    backgroundPositionX: imageX,
    backgroundPositionY: imageY,
    backgroundScale: imageScale,
    backgroundOriginalWidth: originalWidth,
    backgroundOriginalHeight: originalHeight,
  }), [fit, colourOpacity, imageOpacity, imageX, imageY, imageScale, originalWidth, originalHeight]);

  const previewBackgroundStyle = {
    backgroundColor: hexToRgba(colour, colourOpacity),
  };

  const previewImageStyle = previewUrl
    ? {
        backgroundImage: `url(${previewUrl})`,
        ...getBackgroundImageStyle(previewSettings, previewCanvasWidth, previewCanvasHeight),
      }
    : null;

  const chooseFile = (selectedFile) => {
    setError("");
    if (!selectedFile) return;
    if (!ACCEPTED_TYPES.has(selectedFile.type)) {
      setError("Use a PNG, JPG, JPEG, or WebP background image.");
      return;
    }
    if (selectedFile.size > MAX_BACKGROUND_SIZE) {
      setError("Use a background image up to 20 MB.");
      return;
    }

    if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setFile(selectedFile);
    setImagePath(null);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setImageOpacity(1);
    setImageScale(1);
    setImageX(50);
    setImageY(50);
  };

  const removeImage = () => {
    if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setImagePath(null);
    setPreviewUrl("");
    setOriginalWidth(null);
    setOriginalHeight(null);
    setImageOpacity(1);
    setImageScale(1);
    setImageX(50);
    setImageY(50);
    setError("");
  };

  const centreImage = () => {
    setImageX(50);
    setImageY(50);
  };

  const resetImage = () => {
    setFit("fill");
    setImageScale(1);
    setImageX(50);
    setImageY(50);
    setImageOpacity(1);
  };

  const handlePointerDown = (event) => {
    if (!previewUrl) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startPositionX: Number(imageX),
      startPositionY: Number(imageY),
    };
    setIsDragging(true);
  };

  const handlePointerMove = (event) => {
    if (!dragRef.current) return;
    const rectangle = event.currentTarget.getBoundingClientRect();
    const deltaX = ((event.clientX - dragRef.current.startX) / rectangle.width) * 100;
    const deltaY = ((event.clientY - dragRef.current.startY) / rectangle.height) * 100;
    setImageX(Math.min(Math.max(dragRef.current.startPositionX + deltaX, 0), 100));
    setImageY(Math.min(Math.max(dragRef.current.startPositionY + deltaY, 0), 100));
  };

  const handlePointerEnd = (event) => {
    dragRef.current = null;
    setIsDragging(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already be released by the browser.
    }
  };

  const save = async () => {
    if (!validHex(colour)) {
      setError("Enter a valid six-digit HEX colour, such as #FFFFFF.");
      return;
    }

    try {
      setUploading(true);
      setError("");
      let nextPath = imagePath;

      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch(`${API_BASE_URL}/api/uploads/backgrounds`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to upload the background.");
        nextPath = data.file.path;
      }

      onDone({
        backgroundColor: colour,
        backgroundImagePath: nextPath || null,
        backgroundSettings: {
          widgetKind: "backgroundSettings",
          backgroundColor: colour,
          backgroundColorOpacity: Number(colourOpacity),
          backgroundImagePath: nextPath || null,
          backgroundImageOpacity: Number(imageOpacity),
          backgroundFit: fit,
          backgroundPositionX: Number(imageX),
          backgroundPositionY: Number(imageY),
          backgroundScale: Number(imageScale),
          backgroundOriginalWidth: originalWidth ? Number(originalWidth) : null,
          backgroundOriginalHeight: originalHeight ? Number(originalHeight) : null,
          preserveAspectRatio: true,
          // Legacy aliases keep old renderer/code paths safe while the project is updated.
          colorOpacity: Number(colourOpacity),
          imageOpacity: Number(imageOpacity),
        },
        newlyUploadedPath: file && nextPath ? nextPath : null,
      });
    } catch (uploadError) {
      setError(uploadError.message || "Unable to save the background.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <EditorModal
      title="Background Settings"
      description="Preview the actual 55-inch TV canvas layout before applying it. The preview is scaled to fit this window, but uses the same canvas size and keeps images in their original ratio."
      onClose={uploading ? () => {} : onClose}
      wide
      className="editor-modal--background-settings"
      footer={
        <>
          <button type="button" className="editor-modal-button editor-modal-button--secondary" onClick={removeImage} disabled={uploading || !previewUrl}>Remove image</button>
          <button type="button" className="editor-modal-button editor-modal-button--secondary" onClick={onClose} disabled={uploading}>Cancel</button>
          <button type="button" className="editor-modal-button editor-modal-button--primary" onClick={save} disabled={uploading}>{uploading ? "Uploading…" : "Apply Background"}</button>
        </>
      }
    >
      {error && <div className="editor-modal-error" role="alert">{error}</div>}

      <div className="background-settings-layout">
        <section className="background-preview-panel" aria-label="Background preview">
          <div
            className={`background-preview background-preview--large ${isDragging ? "is-dragging" : ""}`}
            style={{
              ...previewBackgroundStyle,
              "--background-preview-aspect-ratio": `${previewCanvasWidth} / ${previewCanvasHeight}`,
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
          >
            {previewUrl && <div className="background-preview__image" style={previewImageStyle} />}
            <div className="background-preview__template-header" aria-hidden="true">
              <img src="/rp-logo.avif" alt="" />
              <strong>{projectName || "Untitled Project"}</strong>
              <span>{category || "category"}</span>
            </div>
            <div className="background-preview__editable-area-outline" aria-hidden="true" />
            <div className="background-preview__template-footer" aria-hidden="true">
              Republic Polytechnic
            </div>
            <div className="background-preview__safe-label">Preview matches editor canvas · {previewCanvasWidth} × {previewCanvasHeight} scaled</div>
          </div>
          <p className="background-preview-help">
            This preview uses the same background sizing calculation as the actual editor canvas and display screen. The window is larger so you can check the layout before applying. Drag to reposition the image and use zoom without changing its original ratio.
          </p>
          <div className="background-preview-actions">
            <button type="button" onClick={centreImage} disabled={!previewUrl}>Centre image</button>
            <button type="button" onClick={resetImage} disabled={!previewUrl}>Reset image</button>
          </div>
        </section>

        <section className="background-control-panel" aria-label="Background controls">
          <label
            className="media-dropzone media-dropzone--small"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              chooseFile(event.dataTransfer.files?.[0]);
            }}
          >
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseFile(event.target.files?.[0])} />
            <strong>{previewUrl ? "Change background image" : "Upload background image"}</strong>
            <span>PNG, JPG, JPEG, or WebP · Maximum 20 MB</span>
          </label>

          <label className="editor-modal-field">
            <span>Background colour</span>
            <div className="colour-input-row">
              <input type="color" value={validHex(colour) ? colour : "#ffffff"} onChange={(event) => setColour(event.target.value)} />
              <input type="text" value={colour} pattern="#[0-9a-fA-F]{6}" onChange={(event) => setColour(event.target.value)} aria-label="Background HEX colour" />
            </div>
          </label>

          <label className="editor-modal-field">
            <span>Colour opacity: {Math.round(Number(colourOpacity) * 100)}%</span>
            <input type="range" min="0" max="1" step="0.01" value={colourOpacity} onChange={(event) => setColourOpacity(Number(event.target.value))} />
          </label>

          <label className="editor-modal-field">
            <span>Image opacity: {Math.round(Number(imageOpacity) * 100)}%</span>
            <input type="range" min="0" max="1" step="0.01" value={imageOpacity} onChange={(event) => setImageOpacity(Number(event.target.value))} disabled={!previewUrl} />
          </label>

          <label className="editor-modal-field">
            <span>Image fit mode</span>
            <select value={fit} onChange={(event) => setFit(event.target.value)} disabled={!previewUrl}>
              <option value="fit">Fit within canvas</option>
              <option value="fill">Fill canvas, keep ratio</option>
              <option value="original">Original size</option>
            </select>
          </label>

          <label className="editor-modal-field">
            <span>Zoom: {Math.round(Number(imageScale) * 100)}%</span>
            <input type="range" min="0.1" max="4" step="0.01" value={imageScale} onChange={(event) => setImageScale(Number(event.target.value))} disabled={!previewUrl} />
          </label>

          <label className="editor-modal-field">
            <span>Position X: {Math.round(Number(imageX))}%</span>
            <input type="range" min="0" max="100" step="1" value={imageX} onChange={(event) => setImageX(Number(event.target.value))} disabled={!previewUrl} />
          </label>

          <label className="editor-modal-field">
            <span>Position Y: {Math.round(Number(imageY))}%</span>
            <input type="range" min="0" max="100" step="1" value={imageY} onChange={(event) => setImageY(Number(event.target.value))} disabled={!previewUrl} />
          </label>
        </section>
      </div>
    </EditorModal>
  );
}

export default BackgroundModal;
