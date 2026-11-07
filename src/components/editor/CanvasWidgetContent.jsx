import { useEffect, useRef, useState } from "react";
import ImageSlideshow from "./ImageSlideshow";
import { hexToRgba, resolveMediaUrl } from "../../utils/media";
import "./CanvasWidgetContent.css";

function CanvasWidgetContent({ component, readOnly = false }) {
  const style = component?.style || {};
  const widgetKind = style.widgetKind || component.type;

  const videoRef = useRef(null);
  const [isVideoWaiting, setIsVideoWaiting] = useState(false);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = style.volume ?? 1;
    }
  }, [style.volume]);

  useEffect(() => {
    if (component.type !== "video" || !component.filePath) return undefined;

    const video = videoRef.current;
    if (!video) return undefined;

    const delaySeconds = Math.max(0, Math.min(300, Number(style.delaySeconds) || 0));
    const shouldAutoPlay = style.autoPlay !== false;
    const muted = style.muted !== false;
    let timeoutId;
    let fallbackId;
    let cancelled = false;

    setIsVideoWaiting(delaySeconds > 0 && shouldAutoPlay);

    video.pause();
    video.muted = muted;
    video.playsInline = style.playsInline !== false;
    video.volume = style.volume ?? 1;

    try {
      video.currentTime = 0;
    } catch {
      // The browser may block currentTime before metadata is available.
    }

    const playVideo = () => {
      const activeVideo = videoRef.current;
      if (!activeVideo || cancelled || !shouldAutoPlay) return;

      activeVideo.muted = muted;
      activeVideo.playsInline = style.playsInline !== false;
      const playPromise = activeVideo.play();
      setIsVideoWaiting(false);

      if (playPromise?.catch) {
        playPromise.catch((error) => {
          console.warn("Delayed editor video playback failed:", error.message);
        });
      }
    };

    const playWhenReady = () => {
      const activeVideo = videoRef.current;
      if (!activeVideo || cancelled) return;

      if (activeVideo.readyState >= 2) {
        playVideo();
        return;
      }

      activeVideo.addEventListener("canplay", playVideo, { once: true });
      fallbackId = window.setTimeout(playVideo, 1000);
      activeVideo.load();
    };

    if (shouldAutoPlay) {
      timeoutId = window.setTimeout(playWhenReady, delaySeconds * 1000);
    }

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      window.clearTimeout(fallbackId);
      video.removeEventListener("canplay", playVideo);
      video.pause();
      setIsVideoWaiting(false);
    };
  }, [component.type, component.filePath, component.clientId, component.componentId, style.delaySeconds, style.autoPlay, style.muted, style.playsInline, style.volume]);

  if (component.type === "image") {
    return (
      <ImageSlideshow
        component={component}
        className="canvas-widget-content__media"
        alt={component.contentText || "Canvas image"}
      />
    );
  }

  if (component.type === "video") {
    if (!component.filePath) {
      return <div className="canvas-widget-placeholder">Video</div>;
    }

    const delaySeconds = Math.max(0, Math.min(300, Number(style.delaySeconds) || 0));

    return (
      <div className="canvas-widget-content__video-wrap">
        <video
          ref={videoRef}
          src={resolveMediaUrl(component.filePath)}
          controls={!readOnly}
          autoPlay={false}
          muted={style.muted !== false}
          loop={style.loop !== false}
          playsInline={style.playsInline !== false}
          preload="auto"
          style={{
            width: "100%",
            height: "100%",
            objectFit: style.objectFit || "contain",
            display: "block",
          }}
        />
        {isVideoWaiting && (
          <div className="canvas-widget-content__video-delay" aria-label={`Video starts after ${delaySeconds} seconds`}>
            Video starts after {delaySeconds}s
          </div>
        )}
      </div>
    );
  }

  if (widgetKind === "textArea") {
    return (
      <div
        className="canvas-widget-content__text-area"
        style={{
          color: style.color || "#000000",
          backgroundColor: hexToRgba(
            style.backgroundColor || "#ffffff",
            style.backgroundOpacity ?? 0.8
          ),
          padding: `${((Number(style.padding) || 24) / 1080) * 100}cqh`,
          textAlign: style.textAlign || "left",
        }}
      >
        {component.contentText || "Enter text…"}
      </div>
    );
  }

  if (component.type === "shape") {
    return (
      <div
        className="canvas-widget-content__shape"
        style={{
          color: style.color || "#315a49",
          backgroundColor: style.backgroundColor || "#dcefe4",
          borderColor: style.borderColor || "#acd3bc",
          borderRadius: `${((Number(style.borderRadius) || 0) / 1080) * 100}cqh`,
          textAlign: style.textAlign || "center",
        }}
      >
        {component.contentText || "Content area"}
      </div>
    );
  }

  return (
    <div
      className="canvas-widget-content__text"
      style={{
        color: style.color || "#000000",
        fontWeight: style.fontWeight || 700,
        textAlign: style.textAlign || "left",
      }}
    >
      {component.contentText || "Text"}
    </div>
  );
}

export default CanvasWidgetContent;
