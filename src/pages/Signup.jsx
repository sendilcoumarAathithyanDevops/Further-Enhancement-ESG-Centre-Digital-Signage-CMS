import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Login.css";

function Signup() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // =========================
  // PASSWORD RULES
  // =========================

  const hasLength = password.length >= 12;
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const score = [
    hasLength,
    hasLowercase,
    hasUppercase,
    hasNumber,
    hasSymbol,
  ].filter(Boolean).length;

  let strengthText = "Weak";
  let strengthClass = "strength-weak";
  let barClass = "bar-weak";

  if (score >= 4) {
    strengthText = "Medium";
    strengthClass = "strength-medium";
    barClass = "bar-medium";
  }

  if (score === 5) {
    strengthText = "Strong";
    strengthClass = "strength-strong";
    barClass = "bar-strong";
  }

  // =========================
  // SIGNUP HANDLER
  // =========================

  const handleSignup = async () => {
    setError("");
    setSuccess("");

    if (!username.trim()) {
      setError("Username is required.");
      return;
    }

    if (!email.trim()) {
      setError("Email is required.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (score < 5) {
      setError("Please create a stronger password.");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(
        "http://localhost:5000/signup",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            username,
            email,
            password,
            confirmPassword,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.message);
        setLoading(false);
        return;
      }

      setSuccess("Redirecting to login...");
      setTimeout(() => {
        navigate("/");
      }, 1500);


    } catch (err) {
      console.error(err);
      setError(
        "Server error. Please try again."
      );

      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <img
          src="/rp-logo.avif"
          alt="RP Logo"
          className="login-logo"
        />

        <h1>Create Account</h1>

        <p>Create an account for the digital signage dashboard.</p>

        <label>Username</label>
        <input
          type="text"
          placeholder="Enter username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <label>Email</label>
        <input
          type="email"
          placeholder="Enter email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label>Password</label>

        <div className="password-wrapper">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            type="button"
            className="toggle-password-btn"
            onClick={() => setShowPassword(!showPassword)}
          >
            👁
          </button>
        </div>

        {/* Password Strength */}
        <div className="password-strength-box">
          <p>
            Password strength:{" "}
            <span className={strengthClass}>{strengthText}</span>
          </p>

          <div className="strength-bar">
            <div id="strengthBarFill" className={barClass}></div>
          </div>

          <div className="password-rules">
            <p className={hasLength ? "rule-passed" : "rule-failed"}>
              {hasLength ? "✓" : "—"} At least 12 characters
            </p>

            <p className={hasLowercase ? "rule-passed" : "rule-failed"}>
              {hasLowercase ? "✓" : "—"} Lowercase
            </p>

            <p className={hasUppercase ? "rule-passed" : "rule-failed"}>
              {hasUppercase ? "✓" : "—"} Uppercase
            </p>

            <p className={hasSymbol ? "rule-passed" : "rule-failed"}>
              {hasSymbol ? "✓" : "—"} Symbol
            </p>

            <p className={hasNumber ? "rule-passed" : "rule-failed"}>
              {hasNumber ? "✓" : "—"} Number
            </p>
          </div>
        </div>

        <label>Confirm Password</label>

        <div className="password-wrapper">
          <input
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          <button
            type="button"
            className="toggle-password-btn"
            onClick={() =>
              setShowConfirmPassword(!showConfirmPassword)
            }
          >
            👁
          </button>
        </div>

        {error && <p className="error-message">{error}</p>}
        {success && <p className="success-message">{success}</p>}

        <button
          className="login-btn"
          onClick={handleSignup}
          disabled={loading}
        >
          {loading ? "Redirecting..." : "Sign Up"}
        </button>

        <p className="auth-link">
          Already have an account? <Link to="/">Login</Link>
        </p>
      </div>
    </div>
  );
}

export default Signup;