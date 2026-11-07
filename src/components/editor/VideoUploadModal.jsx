import { useEffect, useState } from "react";
import EditorModal from "./EditorModal";
import { API_BASE_URL, resolveMediaUrl } from "../../utils/media";
import "./MediaModals.css";

const MAX_VIDEO_SIZE = 1024 * 1024 * 1024;
const MAX_DELAY_SECONDS = 300;

function normaliseDelaySeconds(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(MAX_DELAY_SECONDS, Math.max(0, Math.round(number)));
}

function VideoUploadModal({ onClose, onDone, initialComponent }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(
    initialComponent?.filePath ? resolveMediaUrl(initialComponent.filePath) : ""
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [volume, setVolume] = useState(initialComponent?.style?.volume ?? 1);
  const [delaySeconds, setDelaySeconds] = useState(
    normaliseDelaySeconds(initialComponent?.style?.delaySeconds ?? 0)
  );

  useEffect(() => () => {
    if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const selectFile = (selectedFile) => {
    setError("");
    if (!selectedFile) return;
    if (!selectedFile.type.startsWith("video/")) {
      setError("Please select a video file.");
      return;
    }

    if (selectedFile.size > MAX_VIDEO_SIZE) {
      setError("Video must be smaller than 1 GB.");
      return;
    }
    if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
  };

  const upload = async () => {
    const safeDelaySeconds = normaliseDelaySeconds(delaySeconds);

    if (Number(delaySeconds) !== safeDelaySeconds) {
      setDelaySeconds(safeDelaySeconds);
    }

    if (!file && initialComponent?.filePath) {
      onDone({ path: initialComponent.filePath, volume, delaySeconds: safeDelaySeconds });
      return;
    }
    if (!file) {
      setError("Select a video file.");
      return;
    }

    try {
      setUploading(true);
      setError("");
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`${API_BASE_URL}/api/uploads/videos`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to upload the video.");
      onDone({ path: data.file.path, volume, delaySeconds: safeDelaySeconds });
    } catch (uploadError) {
      setError(uploadError.message || "Unable to upload the video.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <EditorModal
      title={initialComponent ? "Replace Video" : "Add Video"}
      description="Videos autoplay, replay, and remain muted so TV browsers can play them automatically."
      onClose={uploading ? () => {} : onClose}
      footer={
        <>
          <button type="button" className="editor-modal-button editor-modal-button--secondary" onClick={onClose} disabled={uploading}>Cancel</button>
          <button type="button" className="editor-modal-button editor-modal-button--primary" onClick={upload} disabled={uploading || (!file && !initialComponent?.filePath)}>
            {uploading ? "Uploading…" : "Done"}
          </button>
        </>
      }
    >
      {error && <div className="editor-modal-error" role="alert">{error}</div>}
      <label
        className="media-dropzone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); selectFile(event.dataTransfer.files?.[0]); }}
      >
        <input type="file" accept="video/*" onChange={(event) => selectFile(event.target.files?.[0])} />
        <strong>{file ? "Choose a different video" : "Select or drag a video here"}</strong>
        <span>Any video format · Maximum 1 GB</span>
      </label>

      {previewUrl && (
        <div className="video-upload-preview">
          <video src={previewUrl} controls muted playsInline />
          <div className="video-settings">
            <label>
              Volume: {Math.round(volume * 100)}%
            </label>

            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
            />

            <div className="video-delay-field">
              <label htmlFor="video-delay-seconds">
                Delay before playing video
              </label>
              <div className="video-delay-input-row">
                <input
                  id="video-delay-seconds"
                  type="number"
                  min="0"
                  max={MAX_DELAY_SECONDS}
                  step="1"
                  value={delaySeconds}
                  onChange={(event) => {
                    const value = event.target.value;
                    setDelaySeconds(value === "" ? "" : Number(value));
                  }}
                  onBlur={() => setDelaySeconds(normaliseDelaySeconds(delaySeconds))}
                />
                <span>seconds</span>
              </div>
              <input
                type="range"
                min="0"
                max={MAX_DELAY_SECONDS}
                step="1"
                value={normaliseDelaySeconds(delaySeconds)}
                onChange={(event) => setDelaySeconds(Number(event.target.value))}
              />
              <small>Set how many seconds the display screen should wait before this video starts playing.</small>
            </div>
          </div>
          <button type="button" onClick={() => {
            if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
            setFile(null);
            setPreviewUrl("");
          }}>Remove video</button>
        </div>
      )}
    </EditorModal>
  );
}

export default VideoUploadModal;
