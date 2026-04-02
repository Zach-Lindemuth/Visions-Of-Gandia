import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useRoom } from "../context/RoomContext";
import { getCharacters } from "../api/characterApi";

export default function JoinRoomModal({ characterId, onClose }) {
  const { auth } = useAuth();
  const { createRoom, joinRoom } = useRoom();
  const navigate = useNavigate();
  // characterId === null means opened from NavBar (no pre-selected character)
  const needsPicker = characterId === null;

  const [mode, setMode] = useState("choice"); // 'choice' | 'join' | 'pick'
  const [roomId, setRoomId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [charsLoading, setCharsLoading] = useState(false);

  const handleCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      await createRoom(characterId);
      onClose();
      navigate("/room");
    } catch (err) {
      setError(err.message || "Failed to create room.");
    } finally {
      setBusy(false);
    }
  };

  const handleJoinNext = async () => {
    if (!roomId.trim()) return;
    if (needsPicker) {
      // Load characters so the user can pick which one to join with
      setCharsLoading(true);
      try {
        const data = await getCharacters(auth.token);
        setCharacters(Array.isArray(data) ? data : []);
      } catch {
        setCharacters([]);
      } finally {
        setCharsLoading(false);
      }
      setMode("pick");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await joinRoom(roomId.trim(), characterId);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to join room.");
    } finally {
      setBusy(false);
    }
  };

  const handlePickAndJoin = async (charId) => {
    setBusy(true);
    setError(null);
    try {
      await joinRoom(roomId.trim(), charId);
      onClose();
      if (needsPicker) navigate("/room");
    } catch (err) {
      setError(err.message || "Failed to join room.");
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Room</h2>

        {mode === "choice" && (
          <div className="room-modal-choices">
            <button className="btn-primary" onClick={handleCreate} disabled={busy}>
              {busy ? "Creating…" : "Host a Room"}
            </button>
            <button className="btn-secondary" onClick={() => setMode("join")} disabled={busy}>
              Join a Room
            </button>
          </div>
        )}

        {mode === "join" && (
          <div className="room-modal-join">
            <label className="admin-label">Room ID</label>
            <input
              className="modal-input"
              placeholder="Paste room GUID here"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              disabled={busy}
              autoFocus
            />
            <div className="room-modal-join-actions">
              <button className="btn-secondary" onClick={() => setMode("choice")} disabled={busy}>
                Back
              </button>
              <button className="btn-primary" onClick={handleJoinNext} disabled={busy || !roomId.trim()}>
                {busy ? "Joining…" : needsPicker ? "Next" : "Join"}
              </button>
            </div>
          </div>
        )}

        {mode === "pick" && (
          <div className="room-modal-pick">
            <p className="room-modal-pick-hint">Join with which character?</p>
            {charsLoading ? (
              <p className="muted">Loading characters…</p>
            ) : (
              <div className="room-pick-list">
                {characters.map((c) => (
                  <button
                    key={c.id}
                    className="room-pick-card"
                    onClick={() => handlePickAndJoin(c.id)}
                    disabled={busy}
                  >
                    {c.imageUrl ? (
                      <img src={c.imageUrl} alt={c.name} className="room-pick-avatar" />
                    ) : (
                      <div className="room-pick-avatar room-pick-avatar-placeholder" />
                    )}
                    <div className="room-pick-info">
                      <span className="room-pick-name">{c.name}</span>
                      {c.nickname && <span className="room-pick-title">{c.nickname}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
            <button
              className="btn-secondary room-modal-pick-back"
              onClick={() => setMode("join")}
              disabled={busy}
            >
              ← Back
            </button>
          </div>
        )}

        {error && <p className="modal-error">{error}</p>}

        <button className="modal-close-btn" onClick={onClose} disabled={busy}>
          ✕
        </button>
      </div>
    </div>
  );
}
