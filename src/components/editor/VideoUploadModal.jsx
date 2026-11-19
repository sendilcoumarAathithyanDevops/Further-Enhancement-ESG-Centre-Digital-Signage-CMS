import { useEffect, useRef, useState } from "react";
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
  const initialStyle = initialComponent?.style || {};
  const videoPreviewRef = useRef(null);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(
    initialComponent?.filePath ? resolveMediaUrl(initialComponent.filePath) : ""
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [volume, setVolume] = useState(initialStyle.volume ?? 1);
  const [autoPlay, setAutoPlay] = useState(initialStyle.autoPlay !== false);
  const [loop, setLoop] = useState(initialStyle.loop !== false);
  const [muted, setMuted] = useState(initialStyle.muted !== false);
  const [objectFit, setObjectFit] = useState(initialStyle.objectFit || "contain");
  const [delaySeconds, setDelaySeconds] = useState(
    normaliseDelaySeconds(initialStyle.delaySeconds ?? 0)
  );
  const [removeRequested, setRemoveRequested] = useState(false);

  useEffect(() => () => {
    if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (!videoPreviewRef.current) return;
    videoPreviewRef.current.volume = Number(volume) || 0;
    videoPreviewRef.current.muted = muted;
    videoPreviewRef.current.loop = loop;
  }, [loop, muted, previewUrl, volume]);

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
    setRemoveRequested(false);
  };

  const upload = async () => {
    const safeDelaySeconds = normaliseDelaySeconds(delaySeconds);

    if (Number(delaySeconds) !== safeDelaySeconds) {
      setDelaySeconds(safeDelaySeconds);
    }

    if (removeRequested && !file) {
      onDone({
        path: null,
        volume,
        delaySeconds: safeDelaySeconds,
        autoPlay,
        loop,
        muted,
        objectFit,
      });
      return;
    }

    if (!file && initialComponent?.filePath) {
      onDone({
        path: initialComponent.filePath,
        volume,
        delaySeconds: safeDelaySeconds,
        autoPlay,
        loop,
        muted,
        objectFit,
      });
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
      onDone({
        path: data.file.path,
        volume,
        delaySeconds: safeDelaySeconds,
        autoPlay,
        loop,
        muted,
        objectFit,
      });
    } catch (uploadError) {
      setError(uploadError.message || "Unable to upload the video.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <EditorModal
      title={initialComponent ? "Replace Video" : "Add Video"}
      description="Choose playback behavior and a video fit mode for the display."
      onClose={uploading ? () => {} : onClose}
      footer={
        <>
          <button type="button" className="editor-modal-button editor-modal-button--secondary" onClick={onClose} disabled={uploading}>Cancel</button>
          <button type="button" className="editor-modal-button editor-modal-button--primary" onClick={upload} disabled={uploading || (!file && !initialComponent?.filePath && !removeRequested)}>
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
          <video
            ref={videoPreviewRef}
            src={previewUrl}
            controls
            autoPlay={autoPlay}
            muted={muted}
            loop={loop}
            playsInline
            style={{ objectFit }}
          />
          <div className="video-settings">
            <div className="editor-modal-grid">
              <label className="editor-modal-field">
                <span>Video fitting</span>
                <select value={objectFit} onChange={(event) => setObjectFit(event.target.value)}>
                  <option value="contain">Fit video</option>
                  <option value="cover">Fill frame</option>
                </select>
              </label>
              <label className="editor-modal-field">
                <span>Volume: {Math.round(Number(volume) * 100)}%</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  aria-label="Video volume"
                  onChange={(event) => setVolume(Number(event.target.value))}
                />
              </label>
            </div>

            <fieldset className="video-playback-options">
              <legend>Playback options</legend>
              <label>
                <input type="checkbox" checked={autoPlay} onChange={(event) => setAutoPlay(event.target.checked)} />
                <span>Play automatically</span>
              </label>
              <label>
                <input type="checkbox" checked={loop} onChange={(event) => setLoop(event.target.checked)} />
                <span>Loop video</span>
              </label>
              <label>
                <input type="checkbox" checked={muted} onChange={(event) => setMuted(event.target.checked)} />
                <span>Mute video</span>
              </label>
            </fieldset>

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
            setRemoveRequested(Boolean(initialComponent?.filePath));
          }}>{removeRequested ? "Video will be removed" : "Remove video"}</button>
        </div>
      )}
      {removeRequested && (
        <div className="video-removal-notice" role="status">
          This video will be removed when you select Done.
          <button type="button" onClick={() => {
            setPreviewUrl(resolveMediaUrl(initialComponent.filePath));
            setRemoveRequested(false);
          }}>
            Keep current video
          </button>
        </div>
      )}
    </EditorModal>
  );
}

export default VideoUploadModal;
