const runtimeHostname = typeof window !== "undefined" ? window.location.hostname : "localhost";

export const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || `http://${runtimeHostname}:5000`;

export function resolveMediaUrl(value) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value) || value.startsWith("blob:") || value.startsWith("data:")) {
    return value;
  }
  return `${API_BASE_URL}${value.startsWith("/") ? value : `/${value}`}`;
}

export function hexToRgba(hex, opacity = 1) {
  const safeOpacity = Math.min(Math.max(Number(opacity) || 0, 0), 1);
  const cleaned = String(hex || "#ffffff").replace("#", "").trim();
  const expanded = cleaned.length === 3
    ? cleaned.split("").map((character) => character + character).join("")
    : cleaned;

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    return `rgba(255, 255, 255, ${safeOpacity})`;
  }

  const numeric = Number.parseInt(expanded, 16);
  const red = (numeric >> 16) & 255;
  const green = (numeric >> 8) & 255;
  const blue = numeric & 255;
  return `rgba(${red}, ${green}, ${blue}, ${safeOpacity})`;
}

export function createClientId(prefix = "widget") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
