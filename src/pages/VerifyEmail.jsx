import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "../utils/media";
import "./Login.css";

function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [status, setStatus] = useState("verifying"); // "verifying" | "success" | "error"
  const [message, setMessage] = useState("");
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    if (!token) {
      setStatus("error");
      setMessage("This verification link is missing a token.");
      return;
    }

    (async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/verify-email?token=${encodeURIComponent(token)}`,
          { credentials: "include" }
        );
        const data = await response.json();

        if (!response.ok || !data.success) {
          setStatus("error");
          setMessage(data.message || "Unable to verify this email address.");
          return;
        }

        setStatus("success");
        setMessage(data.message || "Your email has been verified.");
      } catch (err) {
        console.error("Verify email error:", err);
        setStatus("error");
        setMessage("Unable to connect to the server.");
      }
    })();
  }, [token]);

  return (
    <div className="login-page">
      <div className="login-card">
        <img src="/rp-logo.avif" alt="RP Logo" className="login-logo" />

        <h1>Email Verification</h1>

        {status === "verifying" && <p>Verifying your email address…</p>}

        {status === "success" && (
          <>
            <p className="success-message">{message}</p>
            <p className="auth-link">
              <Link to="/login">Continue to Login</Link>
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <p className="error-message">{message}</p>
            <p className="auth-link">
              <Link to="/profile">Go to Profile to resend a link</Link>
            </p>
            <p className="auth-link">
              <Link to="/login">Back to Login</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default VerifyEmail;
