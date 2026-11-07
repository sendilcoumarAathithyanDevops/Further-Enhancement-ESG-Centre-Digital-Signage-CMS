import React, { useEffect, useState } from "react";
import "./DisplayManager.css";
import { FaTrash } from "react-icons/fa";
import {
    FiMonitor,
    FiGlobe,
    FiUsers,
    FiShield,
} from "react-icons/fi";

function SummaryCard({ icon, label, value, helper, tone }) {
    return (
        <article className="display-manager-summary-card">
            <span
                className={`display-manager-summary-card__icon display-manager-summary-card__icon--${tone}`}
            >
                {icon}
            </span>

            <div>
                <span>{label}</span>
                <strong>{Number(value || 0).toLocaleString()}</strong>
                <small>{helper}</small>
            </div>
        </article>
    );
}

function DisplayManager() {
    const [displays, setDisplays] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState("environmental");
    const [loading, setLoading] = useState(true);

    const [selectedMonitor, setSelectedMonitor] = useState(null);
    const [availableProjects, setAvailableProjects] = useState([]);
    const [playlistItems, setPlaylistItems] = useState([]);
    const [playlistLoading, setPlaylistLoading] = useState(false);

    const loadDisplays = async () => {
        try {
            setLoading(true);

            const res = await fetch("http://localhost:5000/monitors", {
                method: "GET",
                credentials: "include",
            });

            const data = await res.json();

            if (data.success) {
                setDisplays(data.monitors);
            }
        } catch (err) {
            console.error("Load displays error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDisplays();
    }, []);

    const handleCreateDisplay = async () => {
        try {
            const res = await fetch("http://localhost:5000/monitors", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include",
                body: JSON.stringify({
                    category: selectedCategory,
                }),
            });

            const data = await res.json();

            if (!data.success) {
                alert(data.message || "Failed to create display.");
                return;
            }

            loadDisplays();
        } catch (err) {
            console.error("Create display error:", err);
            alert("Server error while creating display.");
        }
    };

    const deleteDisplay = async (monitorId) => {
        const confirmDelete = window.confirm(
            "Are you sure you want to delete this display?"
        );

        if (!confirmDelete) return;

        try {
            const res = await fetch(
                `http://localhost:5000/monitors/${monitorId}`,
                {
                    method: "DELETE",
                    credentials: "include",
                }
            );

            const data = await res.json();

            if (!data.success) {
                alert(data.message || "Failed to delete display.");
                return;
            }

            alert("Display deleted successfully.");

            loadDisplays();
        } catch (err) {
            console.error("Delete display error:", err);
            alert("Server error while deleting display.");
        }
    };

    const openPlaylistManager = async (monitor) => {
        try {
            setSelectedMonitor(monitor);
            setPlaylistLoading(true);

            const projectsRes = await fetch(
                `http://localhost:5000/api/display-manager/projects?category=${monitor.monitor_category}`,
                {
                    method: "GET",
                    credentials: "include",
                }
            );

            const projectsData = await projectsRes.json();

            const playlistRes = await fetch(
                `http://localhost:5000/api/monitors/${monitor.monitor_id}/playlist`,
                {
                    method: "GET",
                    credentials: "include",
                }
            );

            const playlistData = await playlistRes.json();

            if (projectsData.success) {
                setAvailableProjects(projectsData.projects);
            }

            if (playlistData.success) {
                setPlaylistItems(
                    playlistData.playlist.map((item) => ({
                        projectId: item.project_id,
                        projectName: item.name,
                        displayOrder: item.display_order,

                        pages: item.pages.map((page) => ({
                            canvasId: page.canvas_id,
                            pageOrder: page.page_order,
                            durationSeconds: page.duration_seconds || 10,
                            name: page.name,
                        })),
                    }))
                );
            }
        } catch (err) {
            console.error("Open playlist error:", err);
            alert("Unable to load playlist.");
        } finally {
            setPlaylistLoading(false);
        }
    };

    const closePlaylistManager = () => {
        setSelectedMonitor(null);
        setAvailableProjects([]);
        setPlaylistItems([]);
    };

    const isProjectSelected = (projectId) => {
        return playlistItems.some((item) => item.projectId === projectId);
    };

    const getPlaylistItem = (projectId) => {
        return playlistItems.find((item) => item.projectId === projectId);
    };

    const isAssignedToAnotherMonitor = (project) => {
        if (!project.assigned_monitor_id || !selectedMonitor) {
            return false;
        }

        return Number(project.assigned_monitor_id) !== Number(selectedMonitor.monitor_id);
    };

    const toggleProject = (project) => {
        if (isAssignedToAnotherMonitor(project)) {
            return;
        }

        const alreadySelected = isProjectSelected(project.project_id);

        if (alreadySelected) {
            setPlaylistItems(
                playlistItems.filter((item) => item.projectId !== project.project_id)
            );
            return;
        }

        setPlaylistItems([
            ...playlistItems,
            {
                projectId: project.project_id,
                projectName: project.name,
                displayOrder: playlistItems.length + 1,
                pages: project.pages.map((page) => ({
                    canvasId: page.canvas_id,
                    pageOrder: page.canvas_order,
                    durationSeconds: 10,
                    name: page.name,
                }))
            },
        ]);
    };

    const updatePageDuration = (
        projectId,
        pageIndex,
        value
    ) => {

        const numberValue = Number.parseInt(value, 10);

        setPlaylistItems(prev =>
            prev.map(item => {

                if (item.projectId !== projectId)
                    return item;


                return {
                    ...item,
                    pages: item.pages.map((page, index) =>
                        index === pageIndex
                            ? {
                                ...page,
                                durationSeconds:
                                    Number.isInteger(numberValue) && numberValue > 0
                                        ? numberValue
                                        : 10
                            }
                            : page
                    )
                };

            })
        );

    };

    const movePlaylistItem = (projectId, direction) => {
        const currentIndex = playlistItems.findIndex(
            (item) => item.projectId === projectId
        );

        if (currentIndex === -1) return;

        const newIndex = currentIndex + direction;

        if (newIndex < 0 || newIndex >= playlistItems.length) return;

        const updated = [...playlistItems];
        const temp = updated[currentIndex];
        updated[currentIndex] = updated[newIndex];
        updated[newIndex] = temp;

        setPlaylistItems(updated);
    };

    const savePlaylist = async () => {
        if (!selectedMonitor) return;

        try {
            const res = await fetch(
                `http://localhost:5000/api/monitors/${selectedMonitor.monitor_id}/playlist`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    credentials: "include",
                    body: JSON.stringify({
                        items: playlistItems.map((item, index) => ({
                            projectId: item.projectId,
                            displayOrder: index + 1,
                            projectLoopCount: 1,
                            pages: item.pages.map(page => ({
                                canvasId: page.canvasId,
                                pageOrder: page.pageOrder,
                                durationSeconds: page.durationSeconds
                            }))
                        })),
                    }),
                }
            );

            const data = await res.json();

            if (!data.success) {
                alert(data.message || "Unable to save playlist.");
                return;
            }

            alert("Playlist saved successfully.");
            closePlaylistManager();
            loadDisplays();
        } catch (err) {
            console.error("Save playlist error:", err);
            alert("Server error while saving playlist.");
        }
    };

    const totalDisplays = displays.length;

    const environmentalCount = displays.filter(
        (display) => display.monitor_category === "environmental"
    ).length;

    const socialCount = displays.filter(
        (display) => display.monitor_category === "social"
    ).length;

    const governanceCount = displays.filter(
        (display) => display.monitor_category === "governance"
    ).length;

    return (
        <div className="display-manager-page">
            <header className="display-manager-header">
                <div>
                    <span className="display-manager-eyebrow">Administrator workspace</span>
                    <h1>Display Manager</h1>
                    <p>Manage display playlists, project loops and screen assignments.</p>
                    <span className="display-manager-count-pill">
                        {totalDisplays} display{totalDisplays === 1 ? "" : "s"}
                    </span>
                </div>

                <div className="display-manager-header__actions">
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="dm-category-select"
                    >
                        <option value="environmental">Environmental</option>
                        <option value="social">Social</option>
                        <option value="governance">Governance</option>
                    </select>

                    <button
                        className="display-manager-button display-manager-button--primary"
                        onClick={handleCreateDisplay}
                    >
                        + Create Display
                    </button>
                </div>
            </header>

            <section
                className="display-manager-summary-grid"
                aria-label="Display statistics"
            >
                <SummaryCard
                    icon={<FiMonitor />}
                    label="Total Displays"
                    value={totalDisplays}
                    helper="All registered displays"
                    tone="green"
                />

                <SummaryCard
                    icon={<FiGlobe />}
                    label="Environmental"
                    value={environmentalCount}
                    helper="🌱 Environmental displays"
                    tone="green"
                />

                <SummaryCard
                    icon={<FiUsers />}
                    label="Social"
                    value={socialCount}
                    helper="👥 Social displays"
                    tone="blue"
                />

                <SummaryCard
                    icon={<FiShield />}
                    label="Governance"
                    value={governanceCount}
                    helper="🏛️ Governance displays"
                    tone="purple"
                />
            </section>

            <div className="dm-info-card">
                <h3>Playlist logic</h3>
                <p>
                    Each display can contain multiple projects. A project plays all its
                    slides, then moves to the next project. After the last project, it
                    loops back to the first project.
                </p>
            </div>

            <div className="table-wrapper">
                <table className="users-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Display Name</th>
                            <th>Category</th>
                            <th>Token ID</th>
                            <th>Token Code</th>
                            <th>Status</th>
                            <th>Playlist</th>
                            <th>Action</th>
                            <th>Delete</th>
                        </tr>
                    </thead>

                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="8">Loading displays...</td>
                            </tr>
                        ) : displays.length === 0 ? (
                            <tr>
                                <td colSpan="8">No displays found.</td>
                            </tr>
                        ) : (
                            displays.map((display, index) => (
                                <tr key={display.monitor_id}>
                                    <td>{index + 1}</td>

                                    <td>{display.monitor_name}</td>

                                    <td>
                                        <span
                                            className={`category-badge ${display.monitor_category}`}
                                        >
                                            {display.monitor_category}
                                        </span>
                                    </td>

                                    <td>{display.monitor_key}</td>

                                    <td>
                                        <span className="dm-token-code">
                                            {display.pairing_code || "Not set"}
                                        </span>
                                    </td>

                                    <td>
                                        <span className={`dm-status ${display.status}`}>
                                            {display.status}
                                        </span>
                                    </td>

                                    <td>
                                        {Number(display.playlist_count) > 0
                                            ? `${display.playlist_count} project(s)`
                                            : "No projects"}
                                    </td>

                                    <td>
                                        <button onClick={() => openPlaylistManager(display)}>
                                            Manage
                                        </button>
                                    </td>

                                    <td>
                                        <button
                                            className="dm-delete-btn"
                                            onClick={() => deleteDisplay(display.monitor_id)}
                                        >
                                            <FaTrash />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {selectedMonitor && (
                <div className="dm-modal-overlay">
                    <div className="dm-modal wide">
                        <div className="dm-modal-header">
                            <div>
                                <h2>Manage Playlist</h2>
                                <p>{selectedMonitor.monitor_name}</p>
                            </div>

                            <button className="dm-close-btn" onClick={closePlaylistManager}>
                                ✕
                            </button>
                        </div>

                        {playlistLoading ? (
                            <p>Loading playlist...</p>
                        ) : (
                            <div className="dm-modal-content single">
                                <div className="dm-project-list full">
                                    <h3>Available Projects</h3>

                                    {availableProjects.length === 0 ? (
                                        <p>No published projects found for this category.</p>
                                    ) : (
                                        availableProjects.map((project) => {
                                            const selected = isProjectSelected(project.project_id);
                                            const locked = isAssignedToAnotherMonitor(project);
                                            const playlistItem = getPlaylistItem(project.project_id);

                                            return (
                                                <div
                                                    key={project.project_id}
                                                    className={`dm-project-card ${selected ? "selected" : ""} ${locked ? "locked" : ""
                                                        }`}
                                                    onClick={() => {
                                                        if (!locked) {
                                                            toggleProject(project);
                                                        }
                                                    }}
                                                >
                                                    <div className="dm-project-thumb">
                                                        {project.name.charAt(0).toUpperCase()}
                                                    </div>

                                                    <div className="dm-project-main">
                                                        <strong>{project.name}</strong>

                                                        <div className="dm-project-meta">
                                                            <span>{project.page_count} page(s)</span>

                                                            <span className={`dm-mini-category ${project.category}`}>
                                                                {project.category}
                                                            </span>
                                                        </div>

                                                        {locked && (
                                                            <small>
                                                                Already assigned to {project.assigned_monitor_name}
                                                            </small>
                                                        )}
                                                    </div>

                                                    {selected && !locked && (
                                                        <div
                                                            className="dm-duration-panel"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >

                                                            <h4>
                                                                Page Duration
                                                            </h4>

                                                            <div className="dm-duration-grid">

                                                                {playlistItem?.pages.map((page, index) => (
                                                                    <div
                                                                        className="dm-duration-box"
                                                                        key={index}
                                                                    >

                                                                        <span>
                                                                            Page {page.pageOrder}
                                                                        </span>


                                                                        <div className="dm-duration-input">

                                                                            <input
                                                                                type="number"
                                                                                min="1"
                                                                                value={page.durationSeconds}
                                                                                onChange={(e) =>
                                                                                    updatePageDuration(
                                                                                        project.project_id,
                                                                                        index,
                                                                                        e.target.value
                                                                                    )
                                                                                }
                                                                            />

                                                                            <small>
                                                                                sec
                                                                            </small>

                                                                        </div>


                                                                    </div>
                                                                ))}

                                                            </div>

                                                        </div>
                                                    )}
                                                    <div
                                                        className={`dm-check-box ${selected || locked ? "checked" : ""
                                                            }`}
                                                    >
                                                        {selected || locked ? "✓" : ""}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                {playlistItems.length > 0 && (
                                    <div className="dm-selected-summary">
                                        <h3>Playlist Order</h3>

                                        {playlistItems.map((item, index) => (
                                            <div className="dm-summary-row" key={item.projectId}>
                                                <span>
                                                    {index + 1}. {item.projectName}
                                                </span>

                                                <p>
                                                    {item.pages.length} pages
                                                </p>
                                                <div className="dm-order-buttons horizontal">
                                                    <button
                                                        type="button"
                                                        onClick={() => movePlaylistItem(item.projectId, -1)}
                                                    >
                                                        ↑
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => movePlaylistItem(item.projectId, 1)}
                                                    >
                                                        ↓
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="dm-loop-note">
                                    <strong>How it plays:</strong> Project 1 plays all slides
                                    using the selected time, then moves to Project 2. After the
                                    last project, it loops back to the first project.
                                </div>
                            </div>
                        )}

                        <div className="dm-modal-footer">
                            <button className="dm-cancel-btn" onClick={closePlaylistManager}>
                                Cancel
                            </button>

                            <button className="dm-save-btn" onClick={savePlaylist}>
                                Save Playlist
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DisplayManager;