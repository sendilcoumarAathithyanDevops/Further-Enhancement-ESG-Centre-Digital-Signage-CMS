import "./WidgetSidebar.css";

const WIDGETS = [
  { type: "text", label: "Text", icon: "T", hint: "Title or subtitle" },
  { type: "textArea", label: "Text Area", icon: "¶", hint: "Multiline content" },
  { type: "image", label: "Image", icon: "▧", hint: "Single or slideshow" },
  { type: "video", label: "Video", icon: "▶", hint: "Autoplay and loop" },
  { type: "background", label: "Background", icon: "◫", hint: "Image or colour" },
];

function WidgetSidebar({ onAddAtCenter }) {
  const startDrag = (event, type) => {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("application/x-canvas-widget", type);
    event.dataTransfer.setData("text/plain", type);
  };

  return (
    <aside className="widget-toolbar" aria-label="Canvas widgets">
      <div className="widget-toolbar__title">
        <strong>Widgets</strong>
      </div>

      <div className="widget-toolbar__list">
        {WIDGETS.map((widget) => (
          <button
            key={widget.type}
            type="button"
            draggable
            className="widget-toolbar__item"
            onDragStart={(event) => startDrag(event, widget.type)}
            onClick={() => onAddAtCenter(widget.type)}
            title={`Drag ${widget.label} onto the canvas or click to add it in the centre`}
          >
            <span className="widget-toolbar__icon">{widget.icon}</span>
            <span>{widget.label}</span>
          </button>
        ))}
      </div>

      <div className="widget-toolbar__tip">
        Tip: Double-click a widget to edit it.
      </div>
    </aside>
  );
}

export default WidgetSidebar;
