import React, { useState } from "react";
import "./CanvasPageTabs.css";

function CanvasPageTabs({
  pages,
  selectedPageId,
  onSelect,
  onRename,
  onDelete,
  onMove,
  onReorder,
  onAdd,
  onDuplicate,
}) {
  const [draggedPageId, setDraggedPageId] = useState(null);
  const [dragOverPageId, setDragOverPageId] = useState(null);

  const handleDragStart = (event, pageId) => {
    setDraggedPageId(pageId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", pageId);
  };

  const handleDragOver = (event, pageId) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (pageId !== dragOverPageId) setDragOverPageId(pageId);
  };

  const handleDrop = (event, pageId) => {
    event.preventDefault();
    if (draggedPageId && draggedPageId !== pageId) {
      onReorder(draggedPageId, pageId);
    }
    setDraggedPageId(null);
    setDragOverPageId(null);
  };

  const handleDragEnd = () => {
    setDraggedPageId(null);
    setDragOverPageId(null);
  };

  return (
    <aside className="page-manager" aria-label="Canvas pages">
      <div className="page-manager__header">
        <div>
          <h2>Pages</h2>
          <p>{pages.length} total</p>
        </div>
        <button type="button" className="page-manager__add" onClick={onAdd}>
          + Add page
        </button>
      </div>

      <div className="page-manager__list">
        {pages.map((page, index) => {
          const isSelected = page.clientId === selectedPageId;
          const isDragging = draggedPageId === page.clientId;
          const isDragOver = dragOverPageId === page.clientId && draggedPageId !== page.clientId;

          return (
            <div
              key={page.clientId}
              className={`page-manager__item ${isSelected ? "is-selected" : ""} ${
                isDragging ? "is-dragging" : ""
              } ${isDragOver ? "is-drag-over" : ""}`}
              draggable
              onDragStart={(event) => handleDragStart(event, page.clientId)}
              onDragOver={(event) => handleDragOver(event, page.clientId)}
              onDrop={(event) => handleDrop(event, page.clientId)}
              onDragEnd={handleDragEnd}
              onDragLeave={() =>
                setDragOverPageId((current) => (current === page.clientId ? null : current))
              }
            >
              <button
                type="button"
                className="page-manager__select"
                onClick={() => onSelect(page.clientId)}
                aria-pressed={isSelected}
              >
                <span className="page-manager__number">{index + 1}</span>
                <span className="page-manager__name">{page.name}</span>
              </button>

              {isSelected && (
                <div className="page-manager__controls">
                  <label>
                    <span className="sr-only">Rename page {index + 1}</span>
                    <input
                      type="text"
                      value={page.name}
                      maxLength={150}
                      onChange={(event) => onRename(page.clientId, event.target.value)}
                    />
                  </label>

                  <div className="page-manager__buttons">
                    <button
                      type="button"
                      onClick={() => onMove(page.clientId, -1)}
                      title="Move Up"
                    >
                      ←
                    </button>
                    <button
                    type="button"
                    onClick={() => onMove(page.clientId, 1)}
                    title="Move Down"
                  >
                    →
                  </button>
                    <button
                      type="button"
                      onClick={() => onDuplicate(page.clientId)}
                      aria-label={`Duplicate ${page.name}`}
                      title="Duplicate"
                    >
                      📋
                    </button>
                    <button
                      type="button"
                      className="page-manager__delete"
                      onClick={() => onDelete(page.clientId)}
                      disabled={pages.length === 1}
                      aria-label={`Delete ${page.name}`}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export default CanvasPageTabs;
