import "./WidgetToolbar.css";

function WidgetToolbar({ canEdit, onEdit, onDuplicate, onForward, onBackward, onDelete }) {
  return (
    <div className="widget-toolbar" role="toolbar" aria-label="Selected widget actions" onPointerDown={(event) => event.stopPropagation()}>
      {canEdit && <button type="button" onClick={onEdit}>Edit</button>}
      <button type="button" onClick={onDuplicate}>Duplicate</button>
      <button type="button" onClick={onForward} title="Bring forward" aria-label="Bring widget forward">↑</button>
      <button type="button" onClick={onBackward} title="Send backward" aria-label="Send widget backward">↓</button>
      <button type="button" className="widget-toolbar__delete" onClick={onDelete}>Delete</button>
    </div>
  );
}

export default WidgetToolbar;
