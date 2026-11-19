const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1080;
const HEADER_SAFE_AREA = 70;
const FOOTER_SAFE_AREA = 40;
const MIN_READABLE_FONT_SIZE = 20;
const MAX_OVERLAP_WARNINGS_PER_PAGE = 20;

function hasUsablePath(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function getWidgetLabel(component, index) {
  const content = typeof component.contentText === "string"
    ? component.contentText.trim()
    : "";
  const typeLabel = component.type === "text" ? "Text widget" : `${component.type} widget`;
  return content ? `${typeLabel} "${content.slice(0, 40)}"` : `${typeLabel} ${index + 1}`;
}

function getGeometry(component) {
  const x = Number(component.positionX);
  const y = Number(component.positionY);
  const width = Number(component.width);
  const height = Number(component.height);

  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    return null;
  }

  return { x, y, width, height };
}

function validateProjectLayout(pages) {
  const issues = [];
  const addIssue = (severity, issue) => {
    issues.push({ severity, ...issue });
  };

  if (!Array.isArray(pages) || pages.length === 0) {
    addIssue("error", {
      code: "no-pages",
      pageNumber: null,
      pageName: null,
      message: "This project has no display pages.",
      recommendation: "Add at least one page before publishing.",
    });
    return { canPublish: false, blockingCount: 1, warningCount: 0, issues };
  }

  pages.forEach((page, pageIndex) => {
    const pageNumber = pageIndex + 1;
    const pageName = page.name || `Page ${pageNumber}`;
    const rawWidth = Number(page.width);
    const rawHeight = Number(page.height);
    const canvasWidth = Number.isFinite(rawWidth) && rawWidth > 0
      ? rawWidth
      : DEFAULT_WIDTH;
    const canvasHeight = Number.isFinite(rawHeight) && rawHeight > 0
      ? rawHeight
      : DEFAULT_HEIGHT;
    const components = Array.isArray(page.components) ? page.components : [];
    const geometries = [];

    if (components.length === 0) {
      addIssue("warning", {
        code: "empty-page",
        pageNumber,
        pageName,
        message: `${pageName} has no widgets.`,
        recommendation: "Add content, or confirm that a blank page is intentional.",
      });
    }

    components.forEach((component, componentIndex) => {
      const widgetLabel = getWidgetLabel(component, componentIndex);
      const geometry = getGeometry(component);

      if (!geometry) {
        addIssue("error", {
          code: "invalid-widget-size",
          pageNumber,
          pageName,
          widgetLabel,
          message: `${widgetLabel} has invalid position or dimensions.`,
          recommendation: "Resize or reposition the widget in the editor.",
        });
      } else {
        if (
          geometry.x < 0 ||
          geometry.y < 0 ||
          geometry.x + geometry.width > canvasWidth ||
          geometry.y + geometry.height > canvasHeight
        ) {
          addIssue("error", {
            code: "widget-out-of-bounds",
            pageNumber,
            pageName,
            widgetLabel,
            message: `${widgetLabel} extends beyond the display canvas.`,
            recommendation: `Keep the whole widget within the ${canvasWidth} × ${canvasHeight} canvas.`,
          });
        } else {
          geometries.push({ ...geometry, widgetLabel });
        }

        if (geometry.y < HEADER_SAFE_AREA) {
          addIssue("warning", {
            code: "header-safe-area",
            pageNumber,
            pageName,
            widgetLabel,
            message: `${widgetLabel} may be obscured by the display header.`,
            recommendation: `Move it below the ${HEADER_SAFE_AREA}px header area.`,
          });
        }
        if (geometry.y + geometry.height > canvasHeight - FOOTER_SAFE_AREA) {
          addIssue("warning", {
            code: "footer-safe-area",
            pageNumber,
            pageName,
            widgetLabel,
            message: `${widgetLabel} may be obscured by the display footer.`,
            recommendation: `Keep it above the bottom ${FOOTER_SAFE_AREA}px footer area.`,
          });
        }
      }

      if (component.type === "text" && !String(component.contentText || "").trim()) {
        addIssue("error", {
          code: "empty-text",
          pageNumber,
          pageName,
          widgetLabel,
          message: `${widgetLabel} has no text to display.`,
          recommendation: "Add text or remove the empty widget.",
        });
      }

      if (component.type === "image") {
        const imagePaths = Array.isArray(component.style?.imagePaths)
          ? component.style.imagePaths
          : [];
        const hasImage = hasUsablePath(component.filePath) ||
          hasUsablePath(component.externalUrl) ||
          imagePaths.some(hasUsablePath);
        if (!hasImage) {
          addIssue("error", {
            code: "missing-image",
            pageNumber,
            pageName,
            widgetLabel,
            message: `${widgetLabel} has no image selected.`,
            recommendation: "Upload an image or remove the empty image widget.",
          });
        }
      }

      if (
        component.type === "video" &&
        !hasUsablePath(component.filePath) &&
        !hasUsablePath(component.externalUrl)
      ) {
        addIssue("error", {
          code: "missing-video",
          pageNumber,
          pageName,
          widgetLabel,
          message: `${widgetLabel} has no video selected.`,
          recommendation: "Upload a video or remove the empty video widget.",
        });
      }

      const fontSize = Number(component.style?.fontSize);
      if (
        component.type === "text" &&
        Number.isFinite(fontSize) &&
        fontSize > 0 &&
        fontSize < MIN_READABLE_FONT_SIZE
      ) {
        addIssue("warning", {
          code: "small-text",
          pageNumber,
          pageName,
          widgetLabel,
          message: `${widgetLabel} uses a small ${fontSize}px font.`,
          recommendation: `Use at least ${MIN_READABLE_FONT_SIZE}px for comfortable viewing at a distance.`,
        });
      }
    });

    let overlapWarnings = 0;
    for (let firstIndex = 0; firstIndex < geometries.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < geometries.length; secondIndex += 1) {
        const first = geometries[firstIndex];
        const second = geometries[secondIndex];
        const overlapWidth = Math.max(
          0,
          Math.min(first.x + first.width, second.x + second.width) -
            Math.max(first.x, second.x)
        );
        const overlapHeight = Math.max(
          0,
          Math.min(first.y + first.height, second.y + second.height) -
            Math.max(first.y, second.y)
        );
        const overlapArea = overlapWidth * overlapHeight;
        const smallerArea = Math.min(
          first.width * first.height,
          second.width * second.height
        );

        if (
          smallerArea === 0 ||
          overlapArea / smallerArea < 0.25 ||
          overlapWarnings >= MAX_OVERLAP_WARNINGS_PER_PAGE
        ) {
          continue;
        }

        overlapWarnings += 1;
        addIssue("warning", {
          code: "widget-overlap",
          pageNumber,
          pageName,
          widgetLabel: `${first.widgetLabel} and ${second.widgetLabel}`,
          message: `${first.widgetLabel} overlaps ${second.widgetLabel}.`,
          recommendation: "Review the overlap; layered designs are allowed when intentional.",
        });
      }
    }
  });

  const blockingCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.length - blockingCount;

  return {
    canPublish: blockingCount === 0,
    blockingCount,
    warningCount,
    issues,
  };
}

module.exports = { validateProjectLayout };
