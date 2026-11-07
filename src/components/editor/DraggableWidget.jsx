import { useEffect, useMemo, useRef, useState } from "react";
import WidgetToolbar from "./WidgetToolbar";
import CanvasWidgetContent from "./CanvasWidgetContent";
import "./DraggableWidget.css";

const MINIMUMS = {
  text: { width: 180, height: 90 },
  textArea: { width: 260, height: 150 },
  image: { width: 160, height: 100 },
  video: { width: 220, height: 124 },
  shape: { width: 160, height: 100 },
};

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function getMinimums(component) {
  const kind = component.style?.widgetKind || component.type;
  return MINIMUMS[kind] || { width: 120, height: 80 };
}

function DraggableWidget({
  component,
  canvasRef,
  canvasWidth,
  canvasHeight,
  selected,
  onSelect,
  onChange,
  onEdit,
  onDuplicate,
  onForward,
  onBackward,
  onDelete,
}) {
  const interactionRef = useRef(null);
  const [interacting, setInteracting] = useState(false);
  const widgetKey = component.componentId || component.clientId;
  const fontSize = Number(component.style?.fontSize) || 36;
  const canEdit = ["text", "textArea", "image", "video"].includes(
    component.style?.widgetKind || component.type
  );

  const positionStyle = useMemo(
    () => ({
      left: `${(Number(component.positionX || 0) / canvasWidth) * 100}%`,
      top: `${(Number(component.positionY || 0) / canvasHeight) * 100}%`,
      width: `${(Number(component.width || 300) / canvasWidth) * 100}%`,
      height: `${(Number(component.height || 200) / canvasHeight) * 100}%`,
      transform: `rotate(${Number(component.rotation) || 0}deg)`,
      zIndex: Number(component.layerOrder) || 1,
      "--widget-font-size": `${(fontSize / canvasHeight) * 100}cqh`,
    }),
    [component, canvasHeight, canvasWidth, fontSize]
  );

  useEffect(() => {
    if (!interacting) return undefined;

    const handlePointerMove = (event) => {
      const interaction = interactionRef.current;
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (!interaction || !canvasRect) return;

      const scaleX = canvasWidth / canvasRect.width;
      const scaleY = canvasHeight / canvasRect.height;
      const deltaX = (event.clientX - interaction.pointerX) * scaleX;
      const deltaY = (event.clientY - interaction.pointerY) * scaleY;

      if (interaction.mode === "drag") {
        onChange(widgetKey, {
          positionX: Math.round(
            clamp(interaction.x + deltaX, 0, canvasWidth - interaction.width)
          ),
          positionY: Math.round(
            clamp(interaction.y + deltaY, 0,canvasHeight - interaction.height)
          ),
        });
        return;
      }

      const minimums = getMinimums(component);
      const { direction } = interaction;
      let nextX = interaction.x;
      let nextY = interaction.y;
      let nextWidth = interaction.width;
      let nextHeight = interaction.height;

      if (direction.includes("e")) nextWidth = interaction.width + deltaX;
      if (direction.includes("s")) nextHeight = interaction.height + deltaY;
      if (direction.includes("w")) {
        nextWidth = interaction.width - deltaX;
        nextX = interaction.x + deltaX;
      }
      if (direction.includes("n")) {
        nextHeight = interaction.height - deltaY;
        nextY = interaction.y + deltaY;
      }

      const lockedRatio = component.style?.lockAspectRatio
        ? Number(component.style.aspectRatio) || interaction.width / interaction.height
        : null;

      if (lockedRatio) {
        const horizontalResize = direction.includes("e") || direction.includes("w");
        if (horizontalResize) {
          nextWidth = Math.max(nextWidth, minimums.width);
          nextHeight = nextWidth / lockedRatio;
          if (direction.includes("n")) nextY = interaction.y + interaction.height - nextHeight;
        } else {
          nextHeight = Math.max(nextHeight, minimums.height);
          nextWidth = nextHeight * lockedRatio;
          if (direction.includes("w")) nextX = interaction.x + interaction.width - nextWidth;
        }
      }

      nextWidth = clamp(nextWidth, minimums.width, canvasWidth);
      nextHeight = clamp(nextHeight, minimums.height, canvasHeight);

      nextX = clamp(nextX, 0, canvasWidth - nextWidth);
      nextY = clamp(nextY, 0, canvasHeight - nextHeight);

      onChange(widgetKey, {
        positionX: Math.round(nextX),
        positionY: Math.round(nextY),
        width: Math.round(nextWidth),
        height: Math.round(nextHeight),
      });
    };

    const stopInteraction = () => {
      interactionRef.current = null;
      setInteracting(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopInteraction, { once: true });
    window.addEventListener("pointercancel", stopInteraction, { once: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopInteraction);
      window.removeEventListener("pointercancel", stopInteraction);
    };
  }, [canvasHeight, canvasRef, canvasWidth, component, interacting, onChange, widgetKey]);

  const beginInteraction = (event, mode, direction = "") => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect(widgetKey);
    interactionRef.current = {
      mode,
      direction,
      pointerX: event.clientX,
      pointerY: event.clientY,
      x: Number(component.positionX) || 0,
      y: Number(component.positionY) || 0,
      width: Number(component.width) || 300,
      height: Number(component.height) || 200,
    };
    setInteracting(true);
  };

  return (
    <div
      className={`draggable-widget ${selected ? "is-selected" : ""} ${interacting ? "is-interacting" : ""}`}
      style={positionStyle}
      onPointerDown={(event) => beginInteraction(event, "drag")}
      onDoubleClick={(event) => {
        event.stopPropagation();
        if (canEdit) onEdit(widgetKey);
      }}
      role="group"
      aria-label={`${component.style?.widgetKind || component.type} widget`}
    >
      <CanvasWidgetContent component={component} />

      {selected && (
        <>
          <WidgetToolbar
            canEdit={canEdit}
            onEdit={() => onEdit(widgetKey)}
            onDuplicate={() => onDuplicate(widgetKey)}
            onForward={() => onForward(widgetKey)}
            onBackward={() => onBackward(widgetKey)}
            onDelete={() => onDelete(widgetKey)}
          />
          {["nw", "ne", "sw", "se"].map((direction) => (
            <button
              key={direction}
              type="button"
              className={`widget-resize-handle widget-resize-handle--${direction}`}
              aria-label={`Resize widget from ${direction}`}
              onPointerDown={(event) => beginInteraction(event, "resize", direction)}
            />
          ))}
        </>
      )}
    </div>
  );
}

export default DraggableWidget;
