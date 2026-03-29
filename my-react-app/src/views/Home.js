import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { getCharacters, deleteCharacter } from "../api/characterApi";
import wizard from "../assets/wizard.png";
import knight from "../assets/knight.png";
import archer from "../assets/archer.png";

const TOTAL_SLOTS = 8;
const PLACEHOLDERS = [wizard, knight, archer];

function placeholderFor(seed) {
  return PLACEHOLDERS[Math.abs(seed) % PLACEHOLDERS.length];
}

export default function Home() {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (auth?.roleName === "Admin") {
      navigate("/admin", { replace: true });
    }
  }, [auth?.roleName, navigate]);

  useEffect(() => {
    getCharacters(auth.token)
      .then((data) => setCharacters(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [auth.token]);

  function handleDeleteClick(e, character) {
    e.stopPropagation();
    setConfirmDelete({ id: character.id, name: character.name });
  }

  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteCharacter(auth.token, confirmDelete.id);
      setCharacters((prev) => prev.filter((c) => c.id !== confirmDelete.id));
    } catch {
      // deletion failed silently; user can retry
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  }

  const emptySlots = Math.max(0, TOTAL_SLOTS - characters.length);

  return (
    <div className="dashboard-wide">
      <header className="dashboard-header">
        <h1>Your Characters</h1>
      </header>

      {loading ? (
        <p className="muted">Loading characters...</p>
      ) : (
        <div className="character-grid">
          {characters.map((c) => (
            <div
              key={c.id}
              className="character-slot filled"
              onClick={() => navigate(`/characters/${c.id}`)}
            >
              <div className="slot-image-wrap">
                <img
                  src={c.imageUrl || placeholderFor(c.id)}
                  alt={c.name}
                  className="slot-image"
                />
              </div>
              <div className="slot-info">
                <div className="slot-name">{c.name}</div>
                {c.nickname && <div className="slot-text">{c.nickname}</div>}
                <div className="slot-level muted">Level {c.level ?? 1}</div>
                <button
                  className="slot-delete-btn"
                  onClick={(e) => handleDeleteClick(e, c)}
                  title="Delete character"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}

          {Array.from({ length: emptySlots }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="character-slot empty"
              onClick={() => navigate("/characters/new")}
            >
              <div className="slot-image-wrap slot-image-empty">
                <img
                  src={placeholderFor(characters.length + i)}
                  alt=""
                  className="slot-image"
                />
                <div className="slot-empty-overlay">
                  <div className="plus">+</div>
                </div>
              </div>
              <div className="slot-info">
                <div className="slot-text">Create Character</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmDelete && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Delete Character</h2>
            <p>
              Are you sure you want to delete <strong>{confirmDelete.name}</strong>?
            </p>
            <p className="modal-warning">
              This is permanent and cannot be undone. All equipment, inventory,
              and progress for this character will be lost.
            </p>
            <div className="modal-actions">
              <button
                className="btn btn-danger"
                onClick={handleConfirmDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete Forever"}
              </button>
              <button
                className="btn"
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
