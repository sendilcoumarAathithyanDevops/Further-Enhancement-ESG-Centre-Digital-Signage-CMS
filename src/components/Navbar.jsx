import { useEffect, useState } from "react";
import "./Navbar.css";
import { NavLink, useNavigate } from "react-router-dom";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi2";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user")) || null;
  } catch {
    localStorage.removeItem("user");
    return null;
  }
}

function Navbar({ isOpen, setIsOpen }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(readStoredUser);

  useEffect(() => {
    let active = true;

    const refreshUser = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/check-auth`, {
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        const contentType = response.headers.get("content-type") || "";
        const data = contentType.includes("application/json") ? await response.json() : null;

        if (!active) return;

        if (response.ok && data?.user) {
          localStorage.setItem("user", JSON.stringify(data.user));
          setUser(data.user);
        } else {
          localStorage.removeItem("user");
          setUser(null);
        }
      } catch (error) {
        console.error("Unable to refresh navigation user:", error);
      }
    };

    refreshUser();
    return () => {
      active = false;
    };
  }, []);

  const role = user?.role;

  const adminMenu = [
    { name: "Admin Dashboard", icon: "🏠", path: "/admin-dashboard" },
    { name: "Manage Users", icon: "👥", path: "/manage-users" },
    { name: "Manage Projects", icon: "📁", path: "/manage-projects" },
    { name: "Manage Templates", icon: "🧩", path: "/manage-templates" },
    { name: "Display Manager", icon: "🖥️", path: "/display-manager" },
    { name: "Scheduler", icon: "🗓️", path: "/scheduler" },
  ];

  const producerMenu = [
    { name: "Dashboard", icon: "🏠", path: "/dashboard" },
    { name: "My Canvas", icon: "🎨", path: "/canvas" },
    { name: "Shared with Me", icon: "🤝", path: "/shared" },
    { name: "Knowledge Base", icon: "🖼️", path: "/knowledge-base" },
  ];

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const menuItems = role === "admin" ? adminMenu : producerMenu;

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem("user");
      setUser(null);
      navigate("/login", { replace: true });
    }
  };

  return (
    <aside className={`navbar ${isOpen ? "open" : "closed"}`}>
      <div>
        <div className="navbar-header">
          {isOpen ? (
            <>
              <div className="navbar-logo">
                <img src="/rp-logo.avif" alt="RP Logo" />
              </div>

              <button
                type="button"
                className="toggle-btn"
                onClick={() => setIsOpen(false)}
                aria-label="Collapse navigation"
              >
                <HiChevronLeft size={22} />
              </button>
            </>
          ) : (
            <button
              type="button"
              className="toggle-btn"
              onClick={() => setIsOpen(true)}
              aria-label="Expand navigation"
            >
              <HiChevronRight size={22} />
            </button>
          )}
        </div>

        <div className="navbar-line" />

        {user && (
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            isActive ? "navbar-user-summary active" : "navbar-user-summary"
          }
        >
          {user.avatar_path ? (
            <img className="navbar-avatar" src={`${API_BASE_URL}${user.avatar_path}`} alt="" />
          ) : (
            <div className="navbar-avatar navbar-avatar--initial">
              {(user.username?.charAt(0) || "?").toUpperCase()}
            </div>
          )}
          <div className="navbar-user-text">
            <strong>{user.username}</strong>
            <span>{role === "admin" ? "Administrator" : "Producer"}</span>
          </div>
        </NavLink>
      )}

        <nav className="navbar-menu" aria-label="Main navigation">
          {menuItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              title={!isOpen ? item.name : undefined}
              className={({ isActive }) =>
                isActive ? "navbar-item active" : "navbar-item"
              }
            >
              <span className="navbar-icon" aria-hidden="true">{item.icon}</span>
              {isOpen && <span className="navbar-text">{item.name}</span>}
            </NavLink>
          ))}
        </nav>
      </div>

      <button
        className="signout-button"
        type="button"
        onClick={() => setShowLogoutConfirm(true)}
      >
        <span aria-hidden="true">🚪</span>
        {isOpen && <span>Sign Out</span>}
      </button>

      {showLogoutConfirm && (
      <div className="logout-overlay" onClick={() => setShowLogoutConfirm(false)}>
        <div className="logout-modal" onClick={(e) => e.stopPropagation()}>
          <h3>Log out?</h3>
          <p>Are you sure you want to log out?</p>
          <div className="logout-modal-actions">
            <button className="logout-cancel" onClick={() => setShowLogoutConfirm(false)}>
              Cancel
            </button>
            <button className="logout-confirm" onClick={handleLogout}>
              Log Out
            </button>
          </div>
        </div>
      </div>
    )}
    </aside>
  );
}

export default Navbar;
