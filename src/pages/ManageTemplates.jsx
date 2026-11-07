import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./ManageTemplates.css";
import CanvasPreview from "../components/CanvasPreview";
import { FiRefreshCw } from "react-icons/fi";

const API_BASE_URL =
    process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

function ManageTemplates() {
    const navigate = useNavigate();

    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");
    const [refreshing, setRefreshing] = useState(false);

    const loadTemplates = useCallback(
        async ({ refresh = false } = {}) => {
            if (refresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            setErrorMessage("");

            try {
                const response = await fetch(
                    `${API_BASE_URL}/api/templates/admin`,
                    {
                        credentials: "include",
                        headers: {
                            Accept: "application/json",
                        },
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || "Unable to load templates.");
                }

                setTemplates(Array.isArray(data.templates) ? data.templates : []);
            } catch (error) {
                setErrorMessage(error.message || "Unable to load templates.");
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        []
    );

    useEffect(() => {
        loadTemplates();
    }, [loadTemplates]);

    const getCategoryLabel = (category) => {
        switch (category) {
            case "environmental":
                return "Environmental";

            case "social":
                return "Social";

            case "governance":
                return "Governance";

            case "general":
            default:
                return "General";
        }
    };

    if (loading) {
        return (
            <div className="manage-templates-page">
                <div className="manage-templates-loading">
                    Loading templates…
                </div>
            </div>
        );
    }

    return (
        <div className="page manage-templates-page">
            <header className="manage-templates-header">
                <div>
                    <span className="manage-templates-eyebrow">
                        Administrator workspace
                    </span>

                    <h1>Manage Templates</h1>

                    <p>
                        Edit the existing canvas templates available to producers.
                    </p>

                    <span className="manage-templates-count-pill">
                        {templates.length} template{templates.length === 1 ? "" : "s"}
                    </span>
                </div>

                <div className="manage-templates-header__actions">
                    <button
                        type="button"
                        className="manage-templates-button manage-users-button--secondary"
                        onClick={() => loadTemplates({ refresh: true })}
                        disabled={refreshing}
                    >
                        <FiRefreshCw
                            className={refreshing ? "manage-templates-spin" : ""}
                        />
                        {refreshing ? "Refreshing..." : "Refresh"}
                    </button>
                </div>
            </header>

            {errorMessage && (
                <div
                    className="manage-templates-message manage-templates-message--error"
                    role="alert"
                >
                    {errorMessage}
                </div>
            )}

            {!errorMessage && templates.length === 0 && (
                <div className="manage-templates-empty">
                    <h2>No templates found</h2>
                    <p>
                        There are currently no canvas templates in the
                        database.
                    </p>
                </div>
            )}

            <div className="manage-templates-grid">
                {templates.map((template) => (
                    <article
                        className="template-management-card"
                        key={template.templateId}
                    >
                        <div
                            className={`template-management-preview template-management-preview--${template.category}`}
                        >
                            {Array.isArray(template.pages) && template.pages.length > 0 ? (
                                <CanvasPreview
                                    page={template.pages[0]}
                                    projectName={template.name}
                                    category={template.category}
                                    compact
                                />
                            ) : (
                                <div className="template-management-preview-empty">
                                    No preview available
                                </div>
                            )}
                        </div>

                        <div className="template-management-content">
                            <div className="template-management-title-row">
                                <h2>{template.name}</h2>

                                <span
                                    className={`template-status ${template.isActive
                                        ? "template-status--active"
                                        : "template-status--inactive"
                                        }`}
                                >
                                    {template.isActive ? "Active" : "Inactive"}
                                </span>
                            </div>

                            <p className="template-management-description">
                                {template.description || "No template description provided."}
                            </p>

                            <div className="template-management-footer">
                                <div className="template-management-details">
                                    <span>
                                        Category:{" "}
                                        <strong>{getCategoryLabel(template.category)}</strong>
                                    </span>

                                    <span>
                                        Pages:{" "}
                                        <strong>
                                            {Array.isArray(template.pages)
                                                ? template.pages.length
                                                : 0}
                                        </strong>
                                    </span>
                                </div>

                                <button
                                    type="button"
                                    className="template-edit-button"
                                    onClick={() =>
                                        navigate(`/manage-templates/edit/${template.templateId}`)
                                    }
                                >
                                    Edit Template
                                </button>
                            </div>
                        </div>
                    </article>
                ))}
            </div>
        </div>
    );
}

export default ManageTemplates;