export const DEFAULT_BACKGROUND_SETTINGS = {
  widgetKind: "backgroundSettings",
  backgroundColorOpacity: 1,
  backgroundImageOpacity: 1,
  backgroundFit: "fill",
  backgroundPositionX: 50,
  backgroundPositionY: 50,
  backgroundScale: 1,
  backgroundOriginalWidth: null,
  backgroundOriginalHeight: null,
  preserveAspectRatio: true,
};

export function clampNumber(value, min, max, fallback = min) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(Math.max(numeric, min), max);
}

export function normaliseBackgroundFit(value) {
  if (value === "fit" || value === "contain") return "fit";
  if (value === "original" || value === "auto") return "original";
  // Previous code used "cover" and "fill". In the new version both mean
  // fill the canvas while preserving the image aspect ratio, never stretch.
  if (value === "cover" || value === "fill") return "fill";
  return "fill";
}

export function normaliseBackgroundSettings(settings = {}) {
  const source = settings && typeof settings === "object" ? settings : {};
  const scaleFromOldPercent = source.imageScale !== undefined
    ? Number(source.imageScale) / 100
    : undefined;

  return {
    ...DEFAULT_BACKGROUND_SETTINGS,
    ...source,
    widgetKind: "backgroundSettings",
    backgroundFit: normaliseBackgroundFit(source.backgroundFit),
    backgroundColorOpacity: clampNumber(
      source.backgroundColorOpacity ?? source.colorOpacity,
      0,
      1,
      DEFAULT_BACKGROUND_SETTINGS.backgroundColorOpacity
    ),
    backgroundImageOpacity: clampNumber(
      source.backgroundImageOpacity ?? source.imageOpacity,
      0,
      1,
      DEFAULT_BACKGROUND_SETTINGS.backgroundImageOpacity
    ),
    backgroundPositionX: clampNumber(
      source.backgroundPositionX ?? source.imageX,
      0,
      100,
      DEFAULT_BACKGROUND_SETTINGS.backgroundPositionX
    ),
    backgroundPositionY: clampNumber(
      source.backgroundPositionY ?? source.imageY,
      0,
      100,
      DEFAULT_BACKGROUND_SETTINGS.backgroundPositionY
    ),
    backgroundScale: clampNumber(
      source.backgroundScale ?? scaleFromOldPercent,
      0.1,
      4,
      DEFAULT_BACKGROUND_SETTINGS.backgroundScale
    ),
    backgroundOriginalWidth: Number(source.backgroundOriginalWidth) > 0
      ? Number(source.backgroundOriginalWidth)
      : null,
    backgroundOriginalHeight: Number(source.backgroundOriginalHeight) > 0
      ? Number(source.backgroundOriginalHeight)
      : null,
    preserveAspectRatio: true,
  };
}

export function getBackgroundCssSize(settings, canvasWidth = 1920, canvasHeight = 1080) {
  const safeSettings = normaliseBackgroundSettings(settings);
  const imageWidth = Number(safeSettings.backgroundOriginalWidth);
  const imageHeight = Number(safeSettings.backgroundOriginalHeight);
  const safeCanvasWidth = Number(canvasWidth) > 0 ? Number(canvasWidth) : 1920;
  const safeCanvasHeight = Number(canvasHeight) > 0 ? Number(canvasHeight) : 1080;

  if (imageWidth > 0 && imageHeight > 0) {
    let baseScale = 1;

    if (safeSettings.backgroundFit === "fit") {
      baseScale = Math.min(safeCanvasWidth / imageWidth, safeCanvasHeight / imageHeight);
    } else if (safeSettings.backgroundFit === "fill") {
      baseScale = Math.max(safeCanvasWidth / imageWidth, safeCanvasHeight / imageHeight);
    }

    const finalScale = baseScale * safeSettings.backgroundScale;
    const logicalWidth = Math.max(1, imageWidth * finalScale);
    const logicalHeight = Math.max(1, imageHeight * finalScale);

    // Use percentages instead of fixed CSS pixels so the background renders
    // identically in the modal preview, editor canvas, and TV display even
    // when each view is scaled to a different on-screen size.
    const widthPercent = (logicalWidth / safeCanvasWidth) * 100;
    const heightPercent = (logicalHeight / safeCanvasHeight) * 100;
    return `${widthPercent.toFixed(4)}% ${heightPercent.toFixed(4)}%`;
  }

  if (safeSettings.backgroundFit === "fit") return "contain";
  if (safeSettings.backgroundFit === "original") return "auto";
  return "cover";
}

export function getBackgroundImageStyle(settings, canvasWidth = 1920, canvasHeight = 1080) {
  const safeSettings = normaliseBackgroundSettings(settings);

  return {
    backgroundSize: getBackgroundCssSize(safeSettings, canvasWidth, canvasHeight),
    backgroundPosition: `${safeSettings.backgroundPositionX}% ${safeSettings.backgroundPositionY}%`,
    backgroundRepeat: "no-repeat",
    opacity: safeSettings.backgroundImageOpacity,
  };
}
