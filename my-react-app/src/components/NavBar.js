import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useRoom } from "../context/RoomContext";
import ThemeToggle from "./ThemeToggle";
import JoinRoomModal from "./JoinRoomModal";

export default function NavBar() {
  const { auth, logout } = useAuth();
  const { room } = useRoom();
  const navigate = useNavigate();
  const [showRoomModal, setShowRoomModal] = useState(false);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <nav className="navbar">
      <div className="nav-left">
        <Link to="/" className="nav-brand">
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
        <button
          className="nav-button"
          onClick={() => room ? navigate("/room") : setShowRoomModal(true)}
          title={room ? "Return to room view" : "Join or host a room"}
        >
          {room ? "In Room" : "Room"}
        </button>
        <button className="nav-button" onClick={handleLogout}>
          Logout
        </button>
      </div>

      {showRoomModal && (
        <JoinRoomModal characterId={null} onClose={() => setShowRoomModal(false)} />
      )}
    </nav>
  );
}
