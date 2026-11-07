import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Profile.css";

const API_BASE = "http://localhost:5000";

function Profile() {

  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");

  const [avatarPath, setAvatarPath] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);

  const [saving, setSaving] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);


  useEffect(() => {
    loadUser();
  }, []);



  // ==========================
  // Load User
  // ==========================

  const loadUser = async () => {

    try {

      const response = await fetch(
        `${API_BASE}/api/user`,
        {
          credentials: "include",
        }
      );


      const data = await response.json();


      if(data.success){

        setUsername(data.user.username || "");
        setEmail(data.user.email || "");
        setRole(data.user.role || "");
        setAvatarPath(data.user.avatar_path || null);

      }


    } catch(err){

      console.error(
        "Load user error:",
        err
      );

    }

  };



  // ==========================
  // Avatar
  // ==========================

  const handleChoosePhoto = (event) => {
    const file = event.target.files?.[0];
    if(!file) return;
    if(avatarPreview){

      URL.revokeObjectURL(
        avatarPreview
      );

    }

    setAvatarFile(file);
    setAvatarPreview(
      URL.createObjectURL(file)
    );

  };




  const uploadAvatar = async () => {
    const formData = new FormData();
    formData.append(
      "file",
      avatarFile
    );



    const response = await fetch(
      `${API_BASE}/api/profile/avatar`,
      {
        method:"POST",
        credentials:"include",
        body:formData,
      }
    );


    const data = await response.json();

    if(!response.ok || !data.success){

      throw new Error(
        data.message ||
        "Failed to upload image."
      );

    }
    return data.avatarPath;

  };


  const handleRemovePhoto = async () => {
    if(avatarFile){
      setAvatarFile(null);
      if(avatarPreview){

        URL.revokeObjectURL(
          avatarPreview
        );

        setAvatarPreview(null);

      }
      return;

    }



    if(!avatarPath)
      return;

    if(!window.confirm(
      "Remove profile photo?"
    )){

      return;

    }

    try{
      const response = await fetch(
        `${API_BASE}/api/profile/avatar`,
        {
          method:"DELETE",
          credentials:"include",
        }
      );

      const data = await response.json();

      if(data.success){

        setAvatarPath(null);

      }


    }catch(err){
      console.error(err);
      alert(
        "Unable to remove photo."
      );
    }
  };


  // ==========================
  // Save
  // ==========================

  const handleSave = async () => {


    if(!avatarFile){

      alert(
        "Nothing to save."
      );
      return;
    }

    try{
      setSaving(true);
      const newPath = await uploadAvatar();
      setAvatarPath(newPath);
      setAvatarFile(null);

      if(avatarPreview){

        URL.revokeObjectURL(
          avatarPreview
        );
        setAvatarPreview(null);
      }

      alert(
        "Profile updated successfully!"
      );



    }catch(err){
      console.error(err);
      alert(
        err.message
      );

    }finally{

      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setAvatarFile(null);

    if(avatarPreview){
      URL.revokeObjectURL(
        avatarPreview
      );
      setAvatarPreview(null);
    }
  };

  // ==========================
  // Logout
  // ==========================

  const handleLogout = async () => {
    try{
      await fetch(
        `${API_BASE}/logout`,
        {
          method:"POST",
          credentials:"include",
        }
      );
    }catch(err){
      console.error(err);
    }
    finally{
      localStorage.removeItem(
        "user"
      );

      navigate(
        "/login",
        {
          replace:true
        }
      );
    }
  };

  const initial =
    (username.charAt(0) || "?")
    .toUpperCase();

  const roleLabel =
    role === "admin"
    ? "Administrator"
    : "Producer";

  const showRemove =
    avatarFile || avatarPath;

  return (
    <div className="page profile-page">
      <header className="profile-header">
        <div>
          <h1>
            Profile
          </h1>
          <p>
            Manage your account information.
          </p>
        </div>
      </header>

      <div className="profile-layout">
        {/* Sidebar */}
        <aside className="profile-sidebar">
          <div className="profile-avatar-wrap">
            {
              avatarPreview ?
              <img
                className="profile-avatar"
                src={avatarPreview}
                alt=""
              />
              :
              avatarPath ?

              <img
                className="profile-avatar"
                src={`${API_BASE}${avatarPath}`}
                alt=""
              />
              :
              <div className="profile-avatar profile-avatar--initial">
                {initial}
              </div>

            }

            {
              showRemove &&
              <button
                className="profile-avatar-revert"
                onClick={handleRemovePhoto}
              >
                ↺
              </button>
            }
          </div>

          <button
            className="profile-change-btn"
            onClick={() =>
              fileInputRef.current?.click()
            }
          >
            Choose Photo
          </button>

          {
            avatarFile &&
            <small>
              Click Save to upload.
            </small>
          }

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleChoosePhoto}
            style={{
              display:"none"
            }}
          />

          <div className="profile-identity">
            <strong>
              {username}
            </strong>

            <span>
              {roleLabel}
            </span>
          </div>

          <nav className="profile-subnav">
            <button
              className="profile-subnav-item is-active"
            >

              👤 Personal Information

            </button>

            <button
              className="profile-subnav-item profile-subnav-item--danger"
              onClick={() =>
                setShowLogoutConfirm(true)
              }
            >
              🚪 Log Out
            </button>
          </nav>
        </aside>
        {/* Main Content */}

        <section className="profile-main">
          <h2 className="profile-main-title">
            Personal Information
          </h2>
          <div className="profile-field">
            <label>
              Username
            </label>

            <input
              type="text"
              value={username}
              readOnly
            />

          </div>

          <div className="profile-field">

            <label>
              Email
            </label>


            <input
              type="email"
              value={email}
              readOnly
            />

            <small>
              Your registered email address.
            </small>
          </div>

          <div className="profile-field">


            <label>
              Role
            </label>


            <input
              type="text"
              value={roleLabel}
              readOnly
            />
            <small>
              Your role is managed by an administrator.
            </small>
          </div>

          <div className="profile-actions">
            <button
              className="profile-secondary-btn"
              onClick={handleDiscard}
            >
              Discard Changes
            </button>

            <button
              className="profile-primary-btn"
              onClick={handleSave}
              disabled={saving}
            >
              {
                saving
                ?
                "Saving..."
                :
                "Save Changes"
              }
            </button>
          </div>
        </section>
      </div>

      {
        showLogoutConfirm &&
        <div
          className="logout-overlay"
          onClick={() =>
            setShowLogoutConfirm(false)
          }

        >

          <div
            className="logout-modal"
            onClick={(e)=>
              e.stopPropagation()
            }
          >

            <h3>
              Log out?
            </h3>
            <p>
              Are you sure you want to log out?
            </p>

            <div className="logout-modal-actions">
              <button
                className="logout-cancel"
                onClick={() =>
                  setShowLogoutConfirm(false)
                }
              >
                Cancel
              </button>

              <button
                className="logout-confirm"
                onClick={handleLogout}
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  );
}

export default Profile;