import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useRoom } from "../context/RoomContext";
import { updateRoomCharacterStats } from "../api/roomApi";
import NavBar from "../components/NavBar";

export default function RoomView() {
  const { room, isOwner, leaveRoom } = useRoom();
  const navigate = useNavigate();

  if (!room) return <Navigate to="/" replace />;

  const handleLeave = async () => {
    await leaveRoom();
    navigate("/");
  };

  return (
    <>
      <NavBar />
      <div className="room-view">
        <div className="room-view-header">
          <div className="room-view-title-row">
            <h1 className="room-view-title">Room</h1>
            <div className="room-view-header-actions">
              <button
                className="room-id-copy room-view-copy-btn"
                onClick={() => navigator.clipboard.writeText(room.roomId)}
              >
                Copy Room ID
              </button>
              <button className="room-leave-btn" onClick={handleLeave}>
                {isOwner ? "Close Room" : "Leave Room"}
              </button>
            </div>
          </div>
          <p className="room-view-id muted">{room.roomId}</p>
        </div>

        <div className="room-view-grid">
          {room.members.map((card) => (
            <MemberVitalCard
              key={card.characterId ?? "gm"}
              card={card}
              canEdit={isOwner && card.characterId != null}
              roomId={room.roomId}
            />
          ))}
        </div>
      </div>
    </>
  );
}

function MemberVitalCard({ card, canEdit, roomId }) {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const isGM = card.characterId == null;
  const hpPct = card.healthMax > 0 ? Math.min(100, (card.healthCurrent / card.healthMax) * 100) : 0;
  const epPct = card.energyMax > 0 ? Math.min(100, (card.energyCurrent / card.energyMax) * 100) : 0;

  const applyUpdate = async (patch) => {
    if (!canEdit || busy) return;
    setBusy(true);
    setError(null);
    try {
      await updateRoomCharacterStats(auth.token, roomId, card.characterId, patch);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const changeCurrent = (field, maxField, delta) => {
    const current = card[field] ?? 0;
    const max = card[maxField] ?? 0;
    const next = Math.max(0, Math.min(max, current + delta));
    if (next !== current) applyUpdate({ [field]: next });
  };

  const changeGold = (delta) => {
    const next = Math.max(0, (card.gold ?? 0) + delta);
    applyUpdate({ gold: next });
  };

  return (
    <div className={`room-member-card${isGM ? " room-member-card-gm" : ""}`}>
      <div className="room-member-card-header">
        {card.imageUrl ? (
          <img src={card.imageUrl} alt={card.name} className="room-member-avatar" />
        ) : (
          <div className="room-member-avatar room-member-avatar-placeholder" />
        )}
        <div className="room-member-identity">
          <span className="room-member-name">{isGM ? "Game Master" : card.name}</span>
          {card.nickname && <span className="room-member-title">{card.nickname}</span>}
        </div>
      </div>

      {!isGM && (
        <>
          <div className="room-member-vitals">
            <div className="room-member-vital-row">
              <span className="room-member-vital-label">HP</span>
              <div className="room-vital-track">
                <div className="room-vital-fill room-vital-hp" style={{ width: `${hpPct}%` }} />
              </div>
              <span className="room-member-vital-val">{card.healthCurrent}/{card.healthMax}</span>
              {canEdit && (
                <div className="room-member-vital-btns">
                  <button className="vital-btn" onClick={() => changeCurrent("healthCurrent", "healthMax", -1)} disabled={busy}>−</button>
                  <button className="vital-btn" onClick={() => changeCurrent("healthCurrent", "healthMax", 1)} disabled={busy}>+</button>
                </div>
              )}
            </div>

            <div className="room-member-vital-row">
              <span className="room-member-vital-label">EP</span>
              <div className="room-vital-track">
                <div className="room-vital-fill room-vital-ep" style={{ width: `${epPct}%` }} />
              </div>
              <span className="room-member-vital-val">{card.energyCurrent}/{card.energyMax}</span>
              {canEdit && (
                <div className="room-member-vital-btns">
                  <button className="vital-btn" onClick={() => changeCurrent("energyCurrent", "energyMax", -1)} disabled={busy}>−</button>
                  <button className="vital-btn" onClick={() => changeCurrent("energyCurrent", "energyMax", 1)} disabled={busy}>+</button>
                </div>
              )}
            </div>

            <div className="room-member-vital-row">
              <span className="room-member-vital-label">Items</span>
              <div className="room-vital-track" style={{ visibility: "hidden" }} />
              <span className="room-member-vital-val">{card.itemPointsCurrent}/{card.itemPointsMax}</span>
              {canEdit && (
                <div className="room-member-vital-btns">
                  <button className="vital-btn" onClick={() => changeCurrent("itemPointsCurrent", "itemPointsMax", -1)} disabled={busy}>−</button>
                  <button className="vital-btn" onClick={() => changeCurrent("itemPointsCurrent", "itemPointsMax", 1)} disabled={busy}>+</button>
                </div>
              )}
            </div>

            <div className="room-member-vital-row">
              <span className="room-member-vital-label">Gold</span>
              <div className="room-vital-track" style={{ visibility: "hidden" }} />
              <span className="room-member-vital-val">{card.gold ?? 0}</span>
              {canEdit && (
                <div className="room-member-vital-btns">
                  <button className="vital-btn" onClick={() => changeGold(-1)} disabled={busy}>−</button>
                  <button className="vital-btn" onClick={() => changeGold(1)} disabled={busy}>+</button>
                </div>
              )}
            </div>
          </div>

          {error && <p className="room-member-error">{error}</p>}

          <button
            className="room-member-sheet-btn"
            onClick={() => navigate(`/characters/${card.characterId}`)}
          >
            View Sheet →
          </button>
        </>
      )}
    </div>
  );
}
