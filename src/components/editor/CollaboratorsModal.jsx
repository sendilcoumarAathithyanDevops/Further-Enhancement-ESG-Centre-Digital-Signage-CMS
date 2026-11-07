import { useEffect, useState } from "react";
import { API_BASE_URL } from "../../utils/media";
import "./CollaboratorsModal.css";

function CollaboratorsModal({ canvasId, onClose }) {
  const [collaborators, setCollaborators] = useState([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadCollaborators = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/canvases/${canvasId}/collaborators`,
        { credentials: "include" }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load collaborators.");
      setCollaborators(data);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCollaborators();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasId]);

  const handleAdd = async () => {
    if (!email.trim()) return;
    try {
      setSubmitting(true);
      setError("");
      const response = await fetch(
        `${API_BASE_URL}/api/canvases/${canvasId}/collaborators`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email: email.trim(), role }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to add collaborator.");
      setEmail("");
      await loadCollaborators();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (userId) => {
    if (!window.confirm("Remove this collaborator?")) return;
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/canvases/${canvasId}/collaborators/${userId}`,
        { method: "DELETE", credentials: "include" }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to remove collaborator.");
      await loadCollaborators();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="collab-overlay" onClick={onClose}>
      <div className="collab-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="collab-close" onClick={onClose}>
          ✕
        </button>

        <h2>Collaborators</h2>
        <p className="collab-subtitle">
          Editors can modify this project. Viewers can only open it.
        </p>

        {error && <div className="collab-error" role="alert">{error}</div>}

        <div className="collab-form">
          <input
            type="email"
            value={email}
            placeholder="Collaborator's email"
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
          <button
            type="button"
            className="collab-add-btn"
            onClick={handleAdd}
            disabled={submitting}
          >
            {submitting ? "Adding…" : "Add"}
          </button>
        </div>

        {loading ? (
          <p className="collab-empty">Loading…</p>
        ) : collaborators.length === 0 ? (
          <p className="collab-empty">
            No collaborators yet. Only you can access this project.
          </p>
        ) : (
          <ul className="collab-list">
            {collaborators.map((person) => (
              <li key={person.id} className="collab-item">
                <div className="collab-item-info">
                  <span className="collab-item-name">
                    {person.name || person.email}
                  </span>
                  <span className="collab-item-role">{person.role}</span>
                </div>
                <button
                  type="button"
                  className="collab-remove-btn"
                  onClick={() => handleRemove(person.id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default CollaboratorsModal;