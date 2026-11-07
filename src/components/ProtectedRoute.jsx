import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

function getRoleHome(role) {
  return role === "admin" ? "/admin-dashboard" : "/dashboard";
}

async function readJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return null;
  return response.json();
}

function ProtectedRoute({ children, allowedRoles }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let active = true;

    const checkAuth = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/check-auth`, {
          method: "GET",
          credentials: "include",
          headers: { Accept: "application/json" },
        });

        const data = await readJsonResponse(response);

        if (!active) return;

        if (!response.ok || !data?.user) {
          localStorage.removeItem("user");
          setUser(null);
          return;
        }

        localStorage.setItem("user", JSON.stringify(data.user));
        setUser(data.user);
      } catch (error) {
        console.error("Authentication check failed:", error);
        if (active) {
          localStorage.removeItem("user");
          setUser(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    checkAuth();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <div className="route-loading" aria-live="polite">Checking access...</div>;
  }

  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles?.length && !allowedRoles.includes(user.role)) {
    return <Navigate to={getRoleHome(user.role)} replace />;
  }

  return children;
}

export default ProtectedRoute;
