import EditorModal from "./EditorModal";
import "./LayoutValidationModal.css";

function LayoutValidationModal({
  projectName,
  report,
  onClose,
  onEdit,
  onPreview,
  onPublish,
  publishing = false,
}) {
  const issues = [...report.issues].sort((first, second) => {
    if (first.severity === second.severity) return 0;
    return first.severity === "error" ? -1 : 1;
  });
  const hasBlockingIssues = !report.canPublish;

  return (
    <EditorModal
      title="Review layout before publishing"
      description={`Check ${projectName || "this project"} for common display issues.`}
      onClose={onClose}
      wide
      className="layout-validation-modal"
      footer={
        <>
          <button
            type="button"
            className="editor-modal-button editor-modal-button--secondary"
            onClick={onClose}
            disabled={publishing}
          >
            Close
          </button>
          {onPreview && (
            <button
              type="button"
              className="editor-modal-button editor-modal-button--secondary"
              onClick={onPreview}
              disabled={publishing}
            >
              Preview content
            </button>
          )}
          {hasBlockingIssues ? (
            <button
              type="button"
              className="editor-modal-button editor-modal-button--primary"
              onClick={onEdit}
              disabled={publishing}
            >
              Edit project
            </button>
          ) : (
            <button
              type="button"
              className="editor-modal-button editor-modal-button--primary"
              onClick={onPublish}
              disabled={publishing}
            >
              {publishing
                ? "Publishing…"
                : report.warningCount > 0
                  ? "Publish anyway"
                  : "Publish project"}
            </button>
          )}
        </>
      }
    >
      <div
        className={`layout-validation-summary ${
          hasBlockingIssues
            ? "layout-validation-summary--blocked"
            : report.warningCount > 0
              ? "layout-validation-summary--warning"
              : "layout-validation-summary--clear"
        }`}
        role={hasBlockingIssues ? "alert" : "status"}
      >
        {hasBlockingIssues
          ? `${report.blockingCount} issue${report.blockingCount === 1 ? "" : "s"} must be fixed before publishing.`
          : report.warningCount > 0
            ? `${report.warningCount} warning${report.warningCount === 1 ? "" : "s"} to review. Publishing is allowed if these are intentional.`
            : "No common layout issues found."}
      </div>

      {issues.length > 0 ? (
        <ul className="layout-validation-issues">
          {issues.map((issue, index) => (
            <li
              key={`${issue.code}-${issue.pageNumber || "project"}-${index}`}
              className={`layout-validation-issue layout-validation-issue--${issue.severity}`}
            >
              <div className="layout-validation-issue__heading">
                <strong>
                  {issue.severity === "error" ? "Fix before publishing" : "Review"}
                </strong>
                <span>
                  {issue.pageName
                    ? `${issue.pageName}${issue.pageNumber ? ` · Page ${issue.pageNumber}` : ""}`
                    : "Project"}
                </span>
              </div>
              <p>{issue.message}</p>
              <small>{issue.recommendation}</small>
            </li>
          ))}
        </ul>
      ) : (
        <p className="layout-validation-empty">
          The project has pages and its widgets appear to be within the display area.
        </p>
      )}
    </EditorModal>
  );
}

export default LayoutValidationModal;
