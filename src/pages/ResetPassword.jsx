import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import "./ResetPassword.css";


const API_BASE_URL =
    process.env.REACT_APP_API_BASE_URL ||
    "http://localhost:5000";


function ResetPassword() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const token = params.get("token");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");



    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch(
                `${API_BASE_URL}/api/reset-password`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        token,
                        password,
                        confirmPassword
                    })
                }
            );



            const data =
                await response.json();
            if (!response.ok) {

                throw new Error(data.message);

            }
            setMessage(data.message);
            setTimeout(() => {

                navigate("/login");

            }, 2000);
        } catch (err) {

            setError(err.message);

        }


    }



    return (
        <div className="reset-password-page">
            <form
                className="reset-password-card"
                onSubmit={handleSubmit}
            >
                <h1>
                    Reset Password
                </h1>
                <label>
                    New Password
                </label>

                <input
                    type="password"
                    value={password}
                    onChange={
                        e => setPassword(e.target.value)
                    }
                    required
                />

                <label>
                    Confirm Password
                </label>


                <input
                    type="password"
                    value={confirmPassword}
                    onChange={
                        e => setConfirmPassword(e.target.value)
                    }
                    required

                />

                {
                    error &&
                    <p className="reset-error-message">
                        {error}
                    </p>
                }


                {
                    message &&
                    <p className="reset-success-message">
                        {message}
                    </p>
                }



                <button className="reset-password-btn">
                    Update Password
                </button>
            </form>
        </div>
    )
}

export default ResetPassword;