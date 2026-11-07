import React from "react";
import CanvasWidgetContent from "./editor/CanvasWidgetContent";
import { hexToRgba, resolveMediaUrl } from "../utils/media";
import { getBackgroundImageStyle, normaliseBackgroundSettings } from "../utils/backgroundSettings";
import "./CanvasPreview.css";

function normaliseStyle(style) {
  if (!style) return {};

  if (typeof style === "string") {
    try {
      return JSON.parse(style);
    } catch {
      return {};
    }
  }

  return style;
}

const CATEGORY_META = {
  environmental: { label: "Environmental", emoji: "🌱" },
  social: { label: "Social", emoji: "👥" },
  governance: { label: "Governance", emoji: "🏛️" },
};

function CategoryBadge({ category }) {
  const meta = CATEGORY_META[category];

  if (!meta) return <span>—</span>;

  return (
    <span className={`category-preview-badge ${category}`}>
      {meta.emoji} {meta.label}
    </span>
  );
}

function CanvasPreview({ page, pageNumber, projectName, description, category, compact = false }) {
  const width = Number(page?.width) || 1920;
  const height = Number(page?.height) || 1080;
  const components = Array.isArray(page?.components) ? page.components : [];
  const backgroundSettings = normaliseBackgroundSettings(page?.backgroundSettings || {});

  return (
    <div
      className={`canvas-preview ${compact ? "canvas-preview--compact" : ""}`}
      aria-label={`Preview of ${page?.name || projectName || "canvas"}`}
    >
      <div
        className="canvas-preview__background-colour"
        style={{
          backgroundColor: hexToRgba(
            page?.backgroundColor || "#ffffff",
            backgroundSettings.backgroundColorOpacity
          ),
        }}
      />
      {page?.backgroundImagePath && (
        <div
          className="canvas-preview__background-image"
          style={{
            backgroundImage: `url(${resolveMediaUrl(page.backgroundImagePath)})`,
            ...getBackgroundImageStyle(backgroundSettings, width, height),
          }}
        />
      )}

      <div className="canvas-preview-header">
        <img
          src="/rp-logo.avif"
          alt="Republic Polytechnic"
          className="canvas-preview-logo"
        />

        <div className="canvas-preview-title">
          <h3 className="canvas-preview-project">
            {projectName || "Untitled Project"}
          </h3>

          <span className="canvas-preview-page">
            Page {pageNumber}
          </span>
        </div>

        <CategoryBadge category={category} />
      </div>

      {components.map((component, index) => {
        const componentStyle = normaliseStyle(component.style);
        const positionStyle = {
          left: `${((Number(component.positionX) || 0) / width) * 100}%`,
          top: `${((Number(component.positionY) || 0) / height) * 100}%`,
          width: `${((Number(component.width) || 300) / width) * 100}%`,
          height: `${((Number(component.height) || 200) / height) * 100}%`,
          transform: `rotate(${Number(component.rotation) || 0}deg)`,
          zIndex: Number(component.layerOrder) || index + 1,
          "--widget-font-size": `${((Number(componentStyle.fontSize) || 36) / height) * 100}cqh`,
        };

        return (
          <div
            key={component.componentId || component.clientId || index}
            className="canvas-preview__component"
            style={positionStyle}
          >
            <CanvasWidgetContent component={{ ...component, style: componentStyle }} readOnly />
          </div>
        );
      })}

      <div className="canvas-preview-footer">
        <span>Republic Polytechnic</span>
      </div>

    </div>
  );
}

export default CanvasPreview;
