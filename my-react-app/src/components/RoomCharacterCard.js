import { useNavigate } from "react-router-dom";

export default function RoomCharacterCard({ card, isOwn }) {
  const navigate = useNavigate();

  const isGM = card.characterId == null;
  const hpPct = card.healthMax > 0 ? Math.min(100, (card.healthCurrent / card.healthMax) * 100) : 0;
  const enPct = card.energyMax > 0 ? Math.min(100, (card.energyCurrent / card.energyMax) * 100) : 0;

  return (
    <div
      className={`room-card${isOwn ? " room-card-own" : ""}${isGM ? " room-card-gm" : ""}`}
      onClick={() => !isGM && navigate(`/characters/${card.characterId}`)}
      title={isGM ? "" : "View character sheet"}
      style={isGM ? { cursor: "default" } : undefined}
    >
      <div className="room-card-header">
        {card.imageUrl ? (
          <img src={card.imageUrl} alt={card.name} className="room-card-avatar" />
        ) : (
          <div className="room-card-avatar room-card-avatar-placeholder" />
        )}
        <div className="room-card-identity">
          <span className="room-card-name">{isGM ? "Game Master" : card.name}</span>
          {card.nickname && <span className="room-card-title">{card.nickname}</span>}
        </div>
      </div>

      {!isGM && (
        <div className="room-card-vitals">
          <div className="room-vital-row">
            <span className="room-vital-label">HP</span>
            <div className="room-vital-track">
              <div className="room-vital-fill room-vital-hp" style={{ width: `${hpPct}%` }} />
            </div>
            <span className="room-vital-value">{card.healthCurrent}/{card.healthMax}</span>
          </div>
          <div className="room-vital-row">
            <span className="room-vital-label">EP</span>
            <div className="room-vital-track">
              <div className="room-vital-fill room-vital-ep" style={{ width: `${enPct}%` }} />
            </div>
            <span className="room-vital-value">{card.energyCurrent}/{card.energyMax}</span>
          </div>
          <div className="room-vital-row">
            <span className="room-vital-label">Items</span>
            <span className="room-vital-value">{card.itemPointsCurrent}/{card.itemPointsMax}</span>
          </div>
          <div className="room-vital-row">
            <span className="room-vital-label">Gold</span>
            <span className="room-vital-value">{card.gold}</span>
          </div>
        </div>
      )}
    </div>
  );
}
