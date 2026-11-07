export const TRANSITION_OPTIONS = [
  { value: "none", label: "None (Cut)", icon: "✂️" },
  { value: "fade", label: "Fade", icon: "🌫️" },
  { value: "slide-left", label: "Slide Left", icon: "⬅️" },
  { value: "slide-right", label: "Slide Right", icon: "➡️" },
  { value: "slide-up", label: "Slide Up", icon: "⬆️" },
  { value: "slide-down", label: "Slide Down", icon: "⬇️" },
  { value: "zoom", label: "Zoom", icon: "🔍" },
];

export const TRANSITION_CONFIG = { duration: 0.6, ease: "easeInOut" };

const INSTANT_CONFIG = { duration: 0 };

export function getTransitionVariants(type) {
  switch (type) {
    case "fade":
      return { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
    case "slide-left":
      return {
        initial: { x: "100%", opacity: 1 },
        animate: { x: "0%", opacity: 1 },
        exit: { x: "-100%", opacity: 1 },
      };
    case "slide-right":
      return {
        initial: { x: "-100%", opacity: 1 },
        animate: { x: "0%", opacity: 1 },
        exit: { x: "100%", opacity: 1 },
      };
    case "slide-up":
      return {
        initial: { y: "100%", opacity: 1 },
        animate: { y: "0%", opacity: 1 },
        exit: { y: "-100%", opacity: 1 },
      };
    case "slide-down":
      return {
        initial: { y: "-100%", opacity: 1 },
        animate: { y: "0%", opacity: 1 },
        exit: { y: "100%", opacity: 1 },
      };
    case "zoom":
      return {
        initial: { scale: 0.85, opacity: 0 },
        animate: { scale: 1, opacity: 1 },
        exit: { scale: 1.15, opacity: 0 },
      };
    case "none":
    default:
      return {
        initial: { opacity: 1 },
        animate: { opacity: 1 },
        exit: { opacity: 1 },
      };
  }
}

export function getTransitionMotionConfig(type) {
  return type === "none" ? INSTANT_CONFIG : TRANSITION_CONFIG;
}
