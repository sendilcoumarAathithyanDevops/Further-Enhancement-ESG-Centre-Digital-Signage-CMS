import { useRef, useEffect } from "react";
import DraggableWidget from "./DraggableWidget";
import { hexToRgba, resolveMediaUrl } from "../../utils/media";
import { getBackgroundImageStyle, normaliseBackgroundSettings } from "../../utils/backgroundSettings";
import "./InteractiveCanvas.css";

function InteractiveCanvas({
  page,
  projectName,
  category,
  selectedWidgetId,
  onSelectWidget,
  onDropWidget,
  onChangeWidget,
  onEditWidget,
  onDuplicateWidget,
  onForwardWidget,
  onBackwardWidget,
  onDeleteWidget,
  onEditBackground,
}) {
  const canvasRef = useRef(null);
  const width = Number(page?.width) || 1920;
  const height = Number(page?.height) || 1080;
  const settings = normaliseBackgroundSettings(page?.backgroundSettings || {});
  const components = [...(page?.components || [])].sort(
    (first, second) => (Number(first.layerOrder) || 0) - (Number(second.layerOrder) || 0)
  );

  useEffect(() => {
    const handleKeyDown = (event) => {
      const tag = document.activeElement?.tagName;
      const isTyping =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        document.activeElement?.isContentEditable;

      if (isTyping) return;

      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        selectedWidgetId
      ) {
        event.preventDefault();
        onDeleteWidget(selectedWidgetId);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedWidgetId, onDeleteWidget]);

  const handleDrop = (event) => {
    event.preventDefault();
    const type =
      event.dataTransfer.getData("application/x-canvas-widget") ||
      event.dataTransfer.getData("text/plain");
    if (!type || !canvasRef.current) return;

    const rectangle = canvasRef.current.getBoundingClientRect();
    const positionX = ((event.clientX - rectangle.left) / rectangle.width) * width;
    const positionY = ((event.clientY - rectangle.top) / rectangle.height) * height;
    onDropWidget(type, { positionX, positionY });
  };

  return (
    <div
      ref={canvasRef}
      className="interactive-canvas"
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDrop={handleDrop}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget || event.target.dataset.backgroundLayer) {
          onSelectWidget(null);
        }
      }}
      onDoubleClick={(event) => {
        if (event.target.dataset.backgroundLayer) onEditBackground();
      }}
      aria-label={`Editable ${page?.name || "canvas page"}`}
    >

      {/* ADD HEADER HERE */}
      <div className="canvas-template-header">
        <img
          src="/rp-logo.avif"
          alt="Republic Polytechnic"
          className="canvas-template-logo"
        />

        <h3 className="canvas-template-project">
          {projectName}
        </h3>

        <span className="canvas-template-category">
          {category}
        </span>
      </div>

      <div
        data-background-layer="true"
        className="interactive-canvas__background-colour"
        style={{
          backgroundColor: hexToRgba(
            page?.backgroundColor || "#ffffff",
            settings.backgroundColorOpacity
          ),
        }}
      />
      {page?.backgroundImagePath && (
        <div
          data-background-layer="true"
          className="interactive-canvas__background-image"
          style={{
            backgroundImage: `url(${resolveMediaUrl(page.backgroundImagePath)})`,
            ...getBackgroundImageStyle(settings, width, height),
          }}
        />
      )}

      <div className="canvas-content">
        {components.map((component) => {
          const widgetKey = component.componentId || component.clientId;

          return (
            <DraggableWidget
              key={widgetKey}
              component={component}
              canvasRef={canvasRef}
              canvasWidth={width}
              canvasHeight={height - 110}
              selected={widgetKey === selectedWidgetId}
              onSelect={onSelectWidget}
              onChange={onChangeWidget}
              onEdit={onEditWidget}
              onDuplicate={onDuplicateWidget}
              onForward={onForwardWidget}
              onBackward={onBackwardWidget}
              onDelete={onDeleteWidget}
            />
          );
        })}
      </div>

      {components.length === 0 && (
        <div className="interactive-canvas__empty" data-background-layer="true">
          <strong>Drag a widget here</strong>
          <span>Use the widget panel to add text, images, video, or a background.</span>
        </div>
      )}

      {/* ADD FOOTER HERE */}
      <div className="canvas-template-footer">
        <span>Republic Polytechnic</span>
      </div>

    </div>
  );
}

export default InteractiveCanvas;
