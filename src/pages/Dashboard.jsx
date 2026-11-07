import { useEffect, useState } from "react";
import "./Dashboard.css";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { FiFileText, FiCheckCircle, FiClock, FiSearch, FiFilter } from "react-icons/fi";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend
);

function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [username, setUsername] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("all");

  useEffect(() => {
    loadUser();
    loadProjects();
  }, []);

  // ==========================
  // LOAD USER
  // ==========================
  const loadUser = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/user", {
        credentials: "include",
      });

      console.log("User response status:", response.status);

      const data = await response.json();
      console.log("User data:", data);

      if (data.success) {
        setUsername(data.user.username);
      } else {
        console.log("Not logged in");
      }
    } catch (err) {
      console.error("loadUser error:", err);
    }
  };

  // ==========================
  // LOAD PROJECTS
  // ==========================
  const loadProjects = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/canvases", {
        credentials: "include",
      });

      const data = await response.json();

      const projectList = Array.isArray(data)
        ? data
        : data.projects || [];

      setProjects(projectList);
    } catch (err) {
      console.error(err);
    }
  };

  // ==========================
  // STATS
  // ==========================
  const totalProjects = projects.length;

  const publishedCount = projects.filter(
    (p) => p.status?.toLowerCase() === "published"
  ).length;

  const draftCount = projects.filter(
    (p) => p.status?.toLowerCase() === "draft"
  ).length;

  // ==========================
  // CHART DATA
  // ==========================
  const chartData = {
    labels: ["Published", "Draft"],

    datasets: [
      {
        data: [publishedCount, draftCount],

        backgroundColor: [
          "#6C63FF",
          "#FFD166",
        ],

        borderWidth: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,

    plugins: {
      legend: {
        position: "bottom",
      },
    },

    cutout: "65%",
  };

  function formatUpdatedDate(date) {
    if (!date) return "Unknown";

    const d = new Date(date);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  const filteredProjects = [...projects]
  .filter((project) =>
    project.name?.toLowerCase().includes(searchTerm.toLowerCase())
  )
  .sort((a, b) => {
    switch (sortBy) {
      case "az":
        return a.name.localeCompare(b.name);

      case "za":
        return b.name.localeCompare(a.name);

      case "oldest":
        return (
          new Date(a.updated_at || a.updatedAt) -
          new Date(b.updated_at || b.updatedAt)
        );

      case "latest":
        return (
          new Date(b.updated_at || b.updatedAt) -
          new Date(a.updated_at || a.updatedAt)
        );

      case "all":
      default:
        return 0; // Keep original order
    }
  });

  const recentProjects = filteredProjects.slice(0, 5);

  return (
    <div className="page dashboard-page">
      <header className="dashboard-header">
        <div>
          <span className="dashboard-eyebrow">
            Producer Workspace
          </span>

          <h1>Welcome back, {username}</h1>

          <p>
            Here's an overview of your ESG projects and publishing activity.
          </p>

          <span className="dashboard-date">
            {new Intl.DateTimeFormat("en-SG", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            }).format(new Date())}
          </span>
        </div>
      </header>

      {/* ====================== */}
      {/* STATS */}
      {/* ====================== */}

      <div className="dashboard-stats-grid">

        <div className="dashboard-stat-card">

          <span className="dashboard-stat-icon dashboard-stat-icon--green">
            <FiFileText />
          </span>

          <div>
            <p className="dashboard-stat-label">
              Total Projects
            </p>

            <strong>{totalProjects}</strong>

            <span className="dashboard-stat-helper">
              All ESG projects
            </span>
          </div>

        </div>

        <div className="dashboard-stat-card">

          <span className="dashboard-stat-icon dashboard-stat-icon--blue">
            <FiCheckCircle />
          </span>

          <div>
            <p className="dashboard-stat-label">
              Published
            </p>

            <strong>{publishedCount}</strong>

            <span className="dashboard-stat-helper">
              Available on displays
            </span>
          </div>

        </div>

        <div className="dashboard-stat-card">

          <span className="dashboard-stat-icon dashboard-stat-icon--orange">
            <FiClock />
          </span>

          <div>
            <p className="dashboard-stat-label">
              Draft Projects
            </p>

            <strong>{draftCount}</strong>

            <span className="dashboard-stat-helper">
              Still in progress
            </span>
          </div>

        </div>

      </div>

      {/* ====================== */}
      {/* CHART */}
      {/* ====================== */}

      <div className="chartCard">

        <div className="dashboard-panel-header">
          <div>
            <h2>Project Overview</h2>
          </div>
        </div>

        <div className="chartWrapper">
          <Doughnut
            data={chartData}
            options={chartOptions}
          />
        </div>

        <div className="chartLegend">

          <div>
            <span className="legendColor green"></span>
            Published:
            <strong>{publishedCount}</strong>
          </div>

          <div>
            <span className="legendColor orange"></span>
            Draft:
            <strong>{draftCount}</strong>
          </div>

        </div>

      </div>

      {/* ====================== */}
      {/* RECENT PROJECTS */}
      {/* ====================== */}

      <section className="dashboard-panel">
        <div className="dashboard-panel-header">
          <div>
            <span>Latest content</span>
            <h2>Recent Projects</h2>
          </div>
        </div>

        {/* FILTERS */}
        <form className="dashboard-filters">
          <label className="dashboard-search">
            <span className="dashboard-sr-only">Search projects</span>
            <FiSearch aria-hidden="true" />

            <input
              type="search"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </label>

          <button
            type="submit"
            className="dashboard-button dashboard-button--primary dashboard-button--compact"
          >
            Search
          </button>

          <label>
            <span className="dashboard-sr-only">Sort projects</span>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="dashboard-sort"
            >
              <option value="all">All Projects</option>
              <option value="latest">Updated Date (Newest First)</option>
              <option value="oldest">Updated Date (Oldest First)</option>
              <option value="az">Project Name (A–Z)</option>
              <option value="za">Project Name (Z–A)</option>
            </select>
          </label>

          {(searchTerm || sortBy !== "all") && (
            <button
              type="button"
              className="dashboard-clear-button"
              onClick={() => {
                setSearchTerm("");
                setSortBy("all");
              }}
            >
              <FiFilter />
              Clear filters
            </button>
          )}
        </form>

        {recentProjects.length === 0 ? (

          <div className="emptyState">
            No projects have been created yet.
          </div>

        ) : (

          <div className="dashboard-record-list">
            {recentProjects.map((project) => (

              <article
                className="dashboard-record"
                key={project.project_id || project.projectId}
              >

                <div className="dashboard-record-main">

                  <div className="dashboard-record-title">

                    <strong>{project.name}</strong>

                    <span
                      className={`dashboard-status dashboard-status--${project.status?.toLowerCase()}`}
                    >
                      {project.status}
                    </span>

                  </div>

                  <p>
                    By {project.producerUsername || username}
                  </p>

                  <div className="dashboard-record-meta">

                    <span className={`category-pill category-pill--${project.category}`}>
                      {project.category}
                    </span>

                    <span>
                      {project.pageCount || 0}{" "}
                      {project.pageCount === 1 ? "page" : "pages"}
                    </span>

                    <span>
                      Updated{" "}
                      {formatUpdatedDate(
                        project.updated_at || project.updatedAt
                      )}
                    </span>

                  </div>

                </div>

              </article>

            ))}

          </div>

        )}

      </section>

    </div>
  );
}

export default Dashboard;