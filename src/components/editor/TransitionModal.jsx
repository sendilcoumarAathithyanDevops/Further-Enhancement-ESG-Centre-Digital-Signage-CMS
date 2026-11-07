import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import EditorModal from "./EditorModal";
import CanvasPreview from "../CanvasPreview";
import {
  TRANSITION_OPTIONS,
  getTransitionVariants,
  getTransitionMotionConfig,
} from "../../utils/pageTransitions";
import "./MediaModals.css";

function TransitionModal({ pages, selectedPageId, projectName, category, onClose, onDone }) {
  const pageIndex = pages.findIndex((p) => p.clientId === selectedPageId);
  const currentPage = pages[pageIndex];

  const [type, setType] = useState(currentPage?.transitionSettings?.type || "none");
  const [previewIndex, setPreviewIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPreviewIndex((current) => (current + 1) % pages.length);
    }, 2200);
    return () => window.clearInterval(timer);
  }, [pages.length]);

  const previewPage = pages[previewIndex];
  const isPreviewingCurrentPage = previewPage?.clientId === selectedPageId;
  const previewType = isPreviewingCurrentPage
    ? type
    : previewPage?.transitionSettings?.type || "none";

  const variants = getTransitionVariants(previewType);
  const motionConfig = getTransitionMotionConfig(previewType);

  const save = () => {
    onDone({ transitionSettings: { type } });
  };

  return (
    <EditorModal
      title="Page Transition"
      description={`Choose the animation used when the display switches into "${currentPage?.name}". The preview cycles through every page in order, page 1 to ${pages.length}.`}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="editor-modal-button editor-modal-button--secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="editor-modal-button editor-modal-button--primary" onClick={save}>Done</button>
        </>
      }
    >
      <div className="background-settings-grid">
        <div className="transition-option-grid" role="radiogroup" aria-label="Page transition animation">
          {TRANSITION_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`transition-option ${type === option.value ? "is-selected" : ""}`}
            >
              <input
                type="radio"
                name="transition-type"
                value={option.value}
                checked={type === option.value}
                onChange={() => setType(option.value)}
              />
              <span className="transition-option__icon" aria-hidden="true">{option.icon}</span>
              <span className="transition-option__label">{option.label}</span>
            </label>
          ))}
        </div>

        <div className="transition-preview-stage">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={previewPage?.canvasId ?? previewPage?.clientId ?? previewIndex}
              className={`transition-preview-slide ${isPreviewingCurrentPage ? "is-editing" : ""}`}
              variants={variants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={motionConfig}
            >
              <CanvasPreview
                page={previewPage}
                pageNumber={previewIndex + 1}
                projectName={projectName}
                category={category}
                compact
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </EditorModal>
  );
}

export default TransitionModal;
