import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import ThemeToggle from "./ThemeToggle";

export default function NavBar() {
  const { auth, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <nav className="navbar">
      <div className="nav-left">
        <Link to={auth?.roleName === "Admin" ? "/admin" : "/"} className="nav-brand">
          Visions of Gandia
        </Link>
      </div>

      <div className="nav-right">
        {auth?.roleName === "Admin" && (
          <Link to="/admin" className="nav-link">
            Admin Portal
          </Link>
        )}
        <ThemeToggle />
        <button className="nav-button" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </nav>
  );
}
