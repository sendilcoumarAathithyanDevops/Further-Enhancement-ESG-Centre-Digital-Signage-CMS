import { useState } from "react";
import { Link } from "react-router-dom";
import "./ForgetPassword.css";

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";


function ForgotPassword(){

  const [email,setEmail] = useState("");
  const [message,setMessage] = useState("");
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(false);


  const handleSubmit = async(e)=>{

    e.preventDefault();

    try{

      setLoading(true);
      setError("");
      setMessage("");

      const response = await fetch(
        `${API_BASE_URL}/api/forgot-password`,
        {
          method:"POST",
          headers:{
            "Content-Type":"application/json"
          },
          body:JSON.stringify({
            email
          })
        }
      );


      const data = await response.json();


      if(!response.ok){
        throw new Error(data.message);
      }


      setMessage(data.message);


    }catch(err){

      setError(
        err.message || "Something went wrong."
      );

    }finally{

      setLoading(false);

    }

  };


  return(
    <div className="login-page">

      <form 
        className="login-card"
        onSubmit={handleSubmit}
      >

        <h1>
          Forgot Password
        </h1>


        <p>
          Enter your email to receive a reset link.
        </p>


        <label>
          Email
        </label>


        <input
          type="email"
          placeholder="Enter email"
          value={email}
          onChange={(e)=>setEmail(e.target.value)}
          required
        />


        {
          error &&
          <p className="error-message">
            {error}
          </p>
        }


        {
          message &&
          <p>
            {message}
          </p>
        }


        <button 
          className="login-btn"
          disabled={loading}
        >
          {
            loading
            ?
            "Sending..."
            :
            "Send Reset Link"
          }

        </button>


        <p className="auth-link">
          <Link to="/login">
            Back to Login
          </Link>
        </p>


      </form>

    </div>
  )

}


export default ForgotPassword;