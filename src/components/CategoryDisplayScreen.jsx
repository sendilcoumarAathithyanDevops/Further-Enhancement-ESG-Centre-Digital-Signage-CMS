import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import CanvasPreview from "./CanvasPreview";
import { getTransitionVariants, getTransitionMotionConfig } from "../utils/pageTransitions";
import "./CategoryDisplayScreen.css";

const runtimeHostname = typeof window !== "undefined" ? window.location.hostname : "localhost";
const API_BASE =
  process.env.REACT_APP_API_BASE_URL || `http://${runtimeHostname}:5000`;
const PROJECTS_ENDPOINT = `${API_BASE}/api/preview/projects`;
const DEFAULT_SLIDE_SECONDS = 8;
const CHROME_HIDE_MS = 3000; // counters fade out after this much idle time

// Logo lives in /public — referenced by URL, not imported (webpack only imports from /src).
const RP_LOGO_SRC = `${process.env.PUBLIC_URL}/rp-logo.avif`;
const RP_LOGO_FALLBACK = `${process.env.PUBLIC_URL}/rp-logo.png`;

// Reserved chrome heights (px) — canvas scales into the space between them,
// so slide content is never covered (header / content / footer wireframe).
const FOOTER_HEIGHT = 56;

const CATEGORIES = [
  { key: "environmental", label: "Environmental", emoji: "🌱", accent: "#22c55e", accentSoft: "rgba(34, 197, 94, 0.35)" },
  { key: "social",        label: "Social",        emoji: "👥", accent: "#3b82f6", accentSoft: "rgba(59, 130, 246, 0.35)" },
  { key: "governance",    label: "Governance",    emoji: "🏛️", accent: "#a855f7", accentSoft: "rgba(168, 85, 247, 0.35)" },
];

function normaliseCategory(value) {
  if (!value) return null;
  const v = String(value).toLowerCase();
  if (v.includes("env")) return "environmental";
  if (v.includes("soc")) return "social";
  if (v.includes("gov")) return "governance";
  return v;
}

// function normaliseProjects(raw) {
//   const list = Array.isArray(raw) ? raw : raw?.projects || [];
//   return list.map((p) => ({
//     projectId: p.projectId ?? p.id ?? p._id,
//     name: p.name ?? p.projectName ?? "Untitled",
//     category: normaliseCategory(p.category ?? p.esgCategory ?? p.tag),
//     pages: Array.isArray(p.pages) ? p.pages : [],
//   }));
// }
function normaliseProjects(raw) {
  const list = Array.isArray(raw) ? raw : raw?.projects || [];

  return list.map((p) => ({
    projectId: p.projectId ?? p.project_id ?? p.id ?? p._id,

    name: p.name ?? p.projectName ?? "Untitled",

    category: normaliseCategory(
      p.category ?? p.esgCategory ?? p.tag
    ),

    pages: Array.isArray(p.pages)
      ? p.pages.map((page) => ({
          ...page,

          canvasId:
            page.canvasId ??
            page.canvas_id,

          pageOrder:
            page.pageOrder ??
            page.canvas_order ??
            page.page_order,

          durationSeconds:
            page.durationSeconds ??
            page.duration_seconds ??
            DEFAULT_SLIDE_SECONDS,
        }))
      : [],
  }));
}

// Flatten every page of every project in the category into one slideshow.
function buildSlides(projects) {
  const slides = [];
  projects.forEach((project) => {
    (project.pages || []).forEach((page, pageIndex) => {
      slides.push({
        projectId: project.projectId,
        projectName: project.name,
        category: project.category,
        page,

        pageNumber: pageIndex + 1,
        pageCount: project.pages.length,

        durationSeconds:
          page.durationSeconds || DEFAULT_SLIDE_SECONDS,
      });
    });
  });
  return slides;
}

// AVIF with PNG fallback for older smart-TV browsers.
function RpLogo({ className }) {
  return (
    <img
      className={className}
      src={RP_LOGO_SRC}
      alt="Republic Polytechnic"
      onError={(e) => {
        if (e.currentTarget.src !== RP_LOGO_FALLBACK) {
          e.currentTarget.src = RP_LOGO_FALLBACK;
        }
      }}
    />
  );
}

function CategoryDisplayScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const category = normaliseCategory(searchParams.get("category"));
  // const slideSeconds =
  //   Number(searchParams.get("seconds")) || DEFAULT_SLIDE_SECONDS;

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [slideIndex, setSlideIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const togglePause = () => {
    setIsPaused((prev) => !prev);
  };

  // Counter visibility — shown on mouse/touch activity, faded when idle.
  // The loop bar itself is always visible.
  const [, setChromeVisible] = useState(true);
  const hideTimerRef = useRef(null);

  // ── Load projects ────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(PROJECTS_ENDPOINT, { credentials: "include" });
        if (!res.ok) throw new Error(`Could not load projects (${res.status}).`);
        const data = await res.json();
        if (active) setProjects(normaliseProjects(data));
      } catch (err) {
        if (active) setError(err.message || "Could not load projects.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // ── Track viewport so the canvas rescales like DisplayScreen ────────────
  useEffect(() => {
    const handleResize = () =>
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ── Reveal counters on activity, fade after idle ─────────────────────────
  useEffect(() => {
    const wake = () => {
      setChromeVisible(true);
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = window.setTimeout(
        () => setChromeVisible(false),
        CHROME_HIDE_MS
      );
    };

    wake(); // start the countdown on mount
    window.addEventListener("mousemove", wake);
    window.addEventListener("touchstart", wake);
    window.addEventListener("keydown", wake);

    return () => {
      window.clearTimeout(hideTimerRef.current);
      window.removeEventListener("mousemove", wake);
      window.removeEventListener("touchstart", wake);
      window.removeEventListener("keydown", wake);
    };
  }, []);

  // const slides = useMemo(() => {
  //   if (!category) return [];
  //   return buildSlides(projects.filter((p) => p.category === category));
  // }, [projects, category]);
  const slides = useMemo(() => {
    if (!category) return [];
    return buildSlides(projects.filter((p) => p.category === category));
  }, [projects, category]);


  const goNext = () => {
  setSlideIndex((prev) =>
    prev >= slides.length - 1 ? 0 : prev + 1
  );
};

const goPrev = () => {
  setSlideIndex((prev) =>
    prev <= 0 ? slides.length - 1 : prev - 1
  );
};

  // Reset the loop when the category changes.
  useEffect(() => setSlideIndex(0), [category]);

  // ── Auto-advance loop ────────────────────────────────────────────────────
  useEffect(() => {

    if (slides.length <= 1 || isPaused) return;


    const currentDuration =
      slides[slideIndex]?.durationSeconds ||
      DEFAULT_SLIDE_SECONDS;


    const timer = setInterval(() => {

      setSlideIndex((i) =>
        i >= slides.length - 1
          ? 0
          : i + 1
      );

    }, currentDuration * 1000);


    return () => clearInterval(timer);


  }, [
    slideIndex,
    slides,
    isPaused
  ]);
//   useEffect(() => {
//   if (slides.length <= 1 || isPaused) return;

//   const timer = setInterval(() => {
//     setSlideIndex((i) => (i + 1) % slides.length);
//   }, Math.max(1, slideSeconds) * 1000);

//   return () => clearInterval(timer);
// }, [slides.length, slideSeconds, isPaused]);


  const pickCategory = useCallback(
    (key) => {
      const next = new URLSearchParams(searchParams);
      next.set("category", key);
      setSearchParams(next, { replace: true });
      // The click on the picker is a user gesture — fullscreen is allowed here.
      document.documentElement.requestFullscreen?.().catch(() => {});
    },
    [searchParams, setSearchParams]
  );

  // ── Render states ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="cat-display cat-display--message">Loading display…</div>
    );
  }
  if (error) {
    return (
      <div className="cat-display cat-display--message cat-display--error">
        {error}
      </div>
    );
  }

  // No category in the URL yet → full-screen picker.
  if (!category) {
    return (
      <div className="cat-display cat-display--picker">
        <span className="cat-display__logo-chip cat-display__logo-chip--large">
          <RpLogo className="cat-display__picker-logo" />
        </span>
        <h1>Category Preview</h1>
        <p>Pick a category to start the full-screen loop.</p>
        <div className="cat-display__picker-row">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              type="button"
              className={`cat-display__picker-btn cat-display__picker-btn--${cat.key}`}
              onClick={() => pickCategory(cat.key)}
            >
              <span className="cat-display__picker-emoji">{cat.emoji}</span>
              {cat.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (slides.length === 0) {
    return (
      <div className="cat-display cat-display--message">
        No projects in this category yet.
      </div>
    );
  }

  const safeIndex = Math.min(slideIndex, slides.length - 1);
  const slide = slides[safeIndex];

  const slideSeconds =
  slide.durationSeconds || DEFAULT_SLIDE_SECONDS;

  // Scale the canvas into the space between header and footer bands.
  const canvasWidth = Number(slide.page?.width) || 1920;
  const canvasHeight = Number(slide.page?.height) || 1080;

  const availableHeight = Math.max(
    1,
    viewport.height - FOOTER_HEIGHT
  );

  const scale = Math.min(
    viewport.width / canvasWidth,
    availableHeight / canvasHeight
  );

  const fadeClass = "";

  return (
    <div className="cat-display">

      {/* ── Content: letterboxed between the header and footer bands ── */}
      <div
        className="cat-display__stage"
        style={{ top: 0, bottom: FOOTER_HEIGHT }}
      >
        <div
          className="cat-display__canvas"
          style={{
            width: `${canvasWidth}px`,
            height: `${canvasHeight}px`,
            transform: `translate(-50%, -50%) scale(${scale})`,
          }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={slide.page?.canvasId ?? `${slide.projectId}-${slide.pageNumber}`}
              style={{ position: "absolute", inset: 0 }}
              variants={getTransitionVariants(slide.page?.transitionSettings?.type)}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={getTransitionMotionConfig(slide.page?.transitionSettings?.type)}
            >
              <CanvasPreview page={slide.page} pageNumber={slide.pageNumber} projectName={slide.projectName} category={slide.category}/>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      

      {/* ── Footer band: loop bar always visible; counters fade on hover ── */}
      <footer className="cat-display__footer" style={{ height: FOOTER_HEIGHT }}>
        <span className={`cat-display__page-counter ${fadeClass}`}>
            Page {slide.pageNumber} / {slide.pageCount}
        </span>

        <div className={`cat-display__progress ${fadeClass}`}>
            <div
            key={`progress-${safeIndex}`}
            className="cat-display__progress-fill"
            style={{
            animationDuration: `${Math.max(1, slideSeconds)}s`,
            animationPlayState: isPaused ? "paused" : "running",
            }}
            >
            <span className="cat-display__progress-thumb" />
            </div>
        </div>

        <span className={`cat-display__slide-counter ${fadeClass}`}>
            Slide {safeIndex + 1} / {slides.length}
        </span>

        <div className="cat-display__controls">
        <button onClick={goPrev}>⏮</button>

        <button onClick={togglePause}>
            {isPaused ? "▶" : "⏸"}
        </button>

        <button onClick={goNext}>⏭</button>
        </div>
        </footer>
    </div>
  );
}

export default CategoryDisplayScreen;