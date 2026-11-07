import { useEffect, useMemo, useState } from "react";
import { resolveMediaUrl } from "../../utils/media";

function ImageSlideshow({ component, className = "", alt = "Canvas image" }) {
  const style = component?.style || {};
  const paths = useMemo(() => {
    const configured = Array.isArray(style.imagePaths) ? style.imagePaths.filter(Boolean) : [];
    if (configured.length > 0) return configured;
    return component?.filePath ? [component.filePath] : [];
  }, [component?.filePath, style.imagePaths]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
    if (paths.length <= 1 || style.displayMode !== "slideshow") return undefined;

    const intervalSeconds = Math.min(Math.max(Number(style.slideshowInterval) || 5, 1), 120);
    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % paths.length);
    }, intervalSeconds * 1000);

    return () => window.clearInterval(interval);
  }, [paths, style.displayMode, style.slideshowInterval]);

  if (paths.length === 0) {
    return <div className={`canvas-widget-placeholder ${className}`}>Image</div>;
  }

  const settings = Array.isArray(style.imageSettings) ? style.imageSettings[activeIndex] || {} : {};
  const fit = settings.objectFit || style.objectFit || "cover";
  const focusX = Number(settings.focusX ?? style.focusX ?? 50);
  const focusY = Number(settings.focusY ?? style.focusY ?? 50);

  return (
    <img
      className={className}
      src={resolveMediaUrl(paths[activeIndex])}
      alt={alt}
      draggable="false"
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        objectFit: fit || "contain",
        objectPosition: `${focusX}% ${focusY}%`,
      }}
    />
  );
}

export default ImageSlideshow;
