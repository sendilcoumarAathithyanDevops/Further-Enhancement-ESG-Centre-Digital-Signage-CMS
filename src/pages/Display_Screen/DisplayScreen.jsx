import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { AnimatePresence, motion } from "framer-motion";
import CanvasPreview from "../../components/CanvasPreview";
import { getTransitionVariants, getTransitionMotionConfig } from "../../utils/pageTransitions";
import "./DisplayScreen.css";

const runtimeHostname = typeof window !== "undefined" ? window.location.hostname : "localhost";
const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || `http://${runtimeHostname}:5000`;

async function parseDisplayResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    await response.text();
    throw new Error(`Display server returned a non-JSON response (${response.status}).`);
  }
  const data = await response.json();
  if (!response.ok || data.success === false) {
    throw new Error(data.message || "Failed to load display.");
  }
  return data;
}

function DisplayScreen() {
  const { tokenCode } = useParams();

  const [monitor, setMonitor] = useState(null);
  const [playlist, setPlaylist] = useState([]);
  const [currentProjectIndex, setCurrentProjectIndex] = useState(0);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [message, setMessage] = useState("Loading display...");
  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const loadDisplay = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/monitor-display/${encodeURIComponent(tokenCode)}`
      );
      const data = await parseDisplayResponse(response);

      setMonitor(data.monitor);
      setPlaylist(data.playlist || []);
      setCurrentProjectIndex(0);
      setCurrentPageIndex(0);
      setMessage(
        data.playlist?.length ? "" : "No projects assigned to this monitor."
      );
    } catch (error) {
      console.error("Load display error:", error);
      setMessage(error.message || "Unable to connect to display server.");
    }
  }, [tokenCode]);

  useEffect(() => {
    const handleResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    loadDisplay();

    const socket = io(API_BASE_URL, {
      transports: ["websocket", "polling"],
    });
    let heartbeatTimer;

    const sendHeartbeat = () => {
      socket.emit("monitor-heartbeat", { tokenCode });
    };

    socket.on("connect", () => {
      socket.emit("register-monitor", { tokenCode });
      sendHeartbeat();
      window.clearInterval(heartbeatTimer);
      heartbeatTimer = window.setInterval(sendHeartbeat, 20_000);
    });

    socket.on("monitor-registered", () =>
      setMessage((current) =>
        current === "Unable to connect to display server." ? "" : current
      )
    );

    const reloadDisplay = () => loadDisplay();
    socket.on("playlist-updated", reloadDisplay);
    socket.on("project-updated", reloadDisplay);
    socket.on("schedule-updated", reloadDisplay);

    socket.on("connect_error", (error) => {
      console.error("Display socket error:", error.message);
    });

    return () => {
      window.clearInterval(heartbeatTimer);
      socket.disconnect();
    };
  }, [loadDisplay, tokenCode]);

  useEffect(() => {
    if (playlist.length === 0) return undefined;

    const currentProject = playlist[currentProjectIndex];
    if (!currentProject) return undefined;

    const pages = currentProject.pages || [];
    if (pages.length === 0) return undefined;

    const currentPage = pages[currentPageIndex];
    const durationSeconds = Number(
      currentPage?.durationSeconds || 10
    );
    const duration = Math.max(1, durationSeconds) * 1000;

    const timer = setTimeout(() => {
      const nextPageIndex = currentPageIndex + 1;

      if (nextPageIndex < pages.length) {
        setCurrentPageIndex(nextPageIndex);
      } else {
        const nextProjectIndex = (currentProjectIndex + 1) % playlist.length;
        setCurrentProjectIndex(nextProjectIndex);
        setCurrentPageIndex(0);
      }
    }, duration);

    return () => clearTimeout(timer);
  }, [playlist, currentProjectIndex, currentPageIndex]);

  const currentProject = playlist[currentProjectIndex];
  const currentPage = currentProject?.pages?.[currentPageIndex];
  const canvasWidth = Number(currentPage?.width) || 1920;
  const canvasHeight = Number(currentPage?.height) || 1080;

  const scale = useMemo(() => {
    return Math.min(viewport.width / canvasWidth, viewport.height / canvasHeight);
  }, [viewport.width, viewport.height, canvasWidth, canvasHeight]);

  const totalPages = currentProject?.pages?.length || 0;

  if (message) {
    return (
      <div className="display-empty">
        <h1>{monitor?.monitorName || "Display Screen"}</h1>
        <p>{message}</p>
        <small>Token: {tokenCode}</small>
      </div>
    );
  }

  if (!currentProject || !currentPage) {
    return (
      <div className="display-empty">
        <h1>{monitor?.monitorName || "Display Screen"}</h1>
        <p>No canvas is available for this display.</p>
        <small>Token: {tokenCode}</small>
      </div>
    );
  }

  return (
    <div className="display-screen">
      <div
        className="display-preview-frame"
        style={{
          width: `${canvasWidth}px`,
          height: `${canvasHeight}px`,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentPage?.canvasId ?? `${currentProjectIndex}-${currentPageIndex}`}
            className="display-preview-motion"
            variants={getTransitionVariants(currentPage?.transitionSettings?.type)}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={getTransitionMotionConfig(currentPage?.transitionSettings?.type)}
          >
            <CanvasPreview
              page={currentPage}
              pageNumber={currentPageIndex + 1}
              pageCount={totalPages}
              projectName={currentProject.projectName}
              description={currentProject.description}
              category={currentProject.category || monitor?.category}
              compact
            />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="display-debug">
        {currentProject?.projectName || "Untitled Project"} / Page {currentPageIndex + 1}
        {totalPages ? ` of ${totalPages}` : ""}
      </div>
    </div>
  );
}

export default DisplayScreen;
