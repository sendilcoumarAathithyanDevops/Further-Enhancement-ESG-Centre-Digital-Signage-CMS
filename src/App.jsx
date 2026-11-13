import { useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  Navigate,
} from "react-router-dom";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgetPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";

import Dashboard from "./pages/Dashboard";
import MyCanvas from "./pages/MyCanvas";
import CanvasEditor from "./pages/CanvasEditor";
import KnowledgeBase from "./pages/KnowledgeBase";
import Profile from "./pages/Profile";

import AdminDashboard from "./pages/AdminDashboard";
import ManageUsers from "./pages/ManageUsers";
import ManageProjects from "./pages/ManageProjects";
import Scheduler from "./pages/Scheduler";
import ContentScheduler from "./pages/ContentScheduler";
import DisplayManager from "./pages/DisplayManager";
import DisplayScreen from "./pages/Display_Screen/DisplayScreen";
import SharedWithMe from "./pages/SharedWithMe";
import CanvasViewer from "./pages/CanvasViewer";

import TemplateEditor from "./pages/TemplateEditor";
import ManageTemplates from "./pages/ManageTemplates";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import CategoryPreview from "./components/CategoryPreview";
import CategoryDisplayScreen from "./components/CategoryDisplayScreen";
import AISupportBubble from "./components/AISupportBubble";

function AppWrapper() {
  const location = useLocation();

  const [isOpen, setIsOpen] = useState(true);

  const isAuthPage =
    location.pathname === "/" ||
    location.pathname === "/login" ||
    location.pathname === "/signup" ||
    location.pathname === "/forgot-password" ||
    location.pathname === "/reset-password" ||
    location.pathname === "/verify-email";

  // FULL-SCREEN DISPLAY PAGES (monitor display + category preview)
  // These pages should not show navbar, sidebar, login layout, or dashboard padding.
  const isDisplayPage =
    location.pathname.startsWith("/display/") ||
    location.pathname.startsWith("/category-display");

  let storedUser = null;
  try {
    storedUser = JSON.parse(localStorage.getItem("user"));
  } catch {
    localStorage.removeItem("user");
  }
  const canUseAISupport =
    !isAuthPage &&
    ["producer", "admin"].includes(storedUser?.role);

  if (isDisplayPage) {
    return (
      <Routes>
        <Route path="/display/:tokenCode" element={<DisplayScreen />} />
        <Route
          path="/category-display"
          element={
            <ProtectedRoute allowedRoles={["producer", "admin"]}>
              <CategoryDisplayScreen />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="app">
      {!isAuthPage && (
        <Navbar isOpen={isOpen} setIsOpen={setIsOpen} />
      )}

      <div
        className={
          isAuthPage
            ? "auth-layout"
            : `main-content ${!isOpen ? "collapsed" : ""}`
        }
      >
        <Routes>
          {/* PUBLIC */}
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password"  element={<ResetPassword />}  />
          <Route path="/verify-email" element={<VerifyEmail />} />

          {/* USER + ADMIN */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={["producer"]}>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/canvas"
            element={
              <ProtectedRoute allowedRoles={["producer"]}>
                <MyCanvas />
              </ProtectedRoute>
            }
          />

          <Route
            path="/canvas/new"
            element={
              <ProtectedRoute allowedRoles={["producer"]}>
                <CanvasEditor />
              </ProtectedRoute>
            }
          />

          <Route
            path="/canvas/edit/:canvasId"
            element={
              <ProtectedRoute allowedRoles={["producer"]}>
                <CanvasEditor />
              </ProtectedRoute>
            }
          />

          <Route
            path="/shared"
            element={
              <ProtectedRoute allowedRoles={["producer"]}>
                <SharedWithMe />
              </ProtectedRoute>
            }
          />

          <Route
            path="/canvas/view/:canvasId"
            element={
              <ProtectedRoute allowedRoles={["producer"]}>
                <CanvasViewer />
              </ProtectedRoute>
            }
          />

          <Route
            path="/knowledge-base"
            element={
              <ProtectedRoute allowedRoles={["producer"]}>
                <KnowledgeBase />
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute allowedRoles={["producer", "admin"]}>
                <Profile />
              </ProtectedRoute>
            }
          />

          {/* ADMIN */}
          <Route
            path="/admin-dashboard"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/manage-users"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <ManageUsers />
              </ProtectedRoute>
            }
          />

          <Route
            path="/manage-projects"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <ManageProjects />
              </ProtectedRoute>
            }
          />

          <Route
            path="/category-preview"
            element={
              <ProtectedRoute allowedRoles={["producer", "admin"]}>
                <CategoryPreview />
              </ProtectedRoute>
            }
          />

          <Route
            path="/scheduler"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <Scheduler />
              </ProtectedRoute>
            }
          />

          <Route
            path="/content-scheduler"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <ContentScheduler />
              </ProtectedRoute>
            }
          />

          <Route
            path="/display-manager"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <DisplayManager />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manage-templates"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <ManageTemplates />
              </ProtectedRoute>
            }
          />


          <Route
            path="/manage-templates/edit/:templateId"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <TemplateEditor />
              </ProtectedRoute>
            }
          />


          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
      {canUseAISupport && <AISupportBubble />}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppWrapper />
    </BrowserRouter>
  );
}