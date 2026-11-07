import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Login.css";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

async function readJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    await response.text();
    throw new Error(`Server returned a non-JSON response (${response.status}).`);
  }

  return response.json();
}

function getRoleHome(role) {
  return role === "admin" ? "/admin-dashboard" : "/dashboard";
}

function Login() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    const checkExistingSession = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/check-auth`, {
          method: "GET",
          credentials: "include",
          headers: { Accept: "application/json" },
        });

        if (response.status === 401) return;

        const data = await readJsonResponse(response);

        if (active && response.ok && data.loggedIn && data.user) {
          localStorage.setItem("user", JSON.stringify(data.user));
          navigate(getRoleHome(data.user.role), { replace: true });
        }
      } catch (sessionError) {
        console.error("Session check failed:", sessionError);
      } finally {
        if (active) setCheckingSession(false);
      }
    };

    checkExistingSession();

    return () => {
      active = false;
    };
  }, [navigate]);

  const handleLogin = async (event) => {
    event.preventDefault();

    if (!username.trim() || !password) {
      setError("Please enter your username and password.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const response = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await readJsonResponse(response);

      if (!response.ok || !data.success || !data.user) {
        setError(data.message || "Unable to sign in.");
        return;
      }

      localStorage.setItem("user", JSON.stringify(data.user));
      navigate(getRoleHome(data.user.role), { replace: true });
    } catch (loginError) {
      console.error("Login error:", loginError);
      setError(loginError.message || "Unable to connect to the server.");
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="login-page">
        <div className="login-card" aria-live="polite">
          <img src="/rp-logo.avif" alt="RP Logo" className="login-logo" />
          <h1>Checking session</h1>
          <p>Please wait while we confirm your account.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleLogin}>
        <img src="/rp-logo.avif" alt="RP Logo" className="login-logo" />

        <h1>Login</h1>
        <p>Sign in to manage the digital signage dashboard.</p>

        <label htmlFor="login-username">Username</label>
        <input
          id="login-username"
          type="text"
          placeholder="Enter username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          disabled={submitting}
        />

        <label htmlFor="login-password">Password</label>

        <div className="password-wrapper">
          <input
            id="login-password"
            type={showPassword ? "text" : "password"}
            placeholder="Enter password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            disabled={submitting}
          />

          <button
            type="button"
            className="toggle-password-btn"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            👁
          </button>
        </div>

        {error && <p className="error-message" role="alert">{error}</p>}

        <button className="login-btn" type="submit" disabled={submitting}>
          {submitting ? "Signing in..." : "Login"}
        </button>

        <p className="auth-link">
          <Link to="/forgot-password">
            Forgot Password?
          </Link>
        </p>

        <p className="auth-link">
          Do not have an account? <Link to="/signup">Sign Up</Link>
        </p>
      </form>
    </div>
  );
}

export default Login;
