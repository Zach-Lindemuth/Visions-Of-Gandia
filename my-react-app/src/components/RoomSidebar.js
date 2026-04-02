import { useAuth } from "../auth/AuthContext";
import { useRoom } from "../context/RoomContext";
import RoomCharacterCard from "./RoomCharacterCard";

export default function RoomSidebar() {
  const { auth } = useAuth();
  const { room, isOwner, leaveRoom } = useRoom();

  if (!room) return null;

  return (
    <aside className="room-sidebar">
      <div className="room-sidebar-header">
        <span className="room-sidebar-title">Room</span>
      </div>

      <div className="room-sidebar-id">
        <span className="room-sidebar-id-label">Room ID</span>
        <button
          className="room-id-copy"
          onClick={() => navigator.clipboard.writeText(room.roomId)}
          title="Click to copy"
        >
          Copy to Clipboard
        </button>
        <button className="room-leave-btn" onClick={leaveRoom} title={isOwner ? "Close room" : "Leave room"}>
          {isOwner ? "Close" : "Leave"}
        </button>
      </div>

      {isOwner && (
        <span className="room-owner-badge">Room Owner</span>
      )}

      <div className="room-card-list">
        {room.members.map((card) => (
          <RoomCharacterCard
            key={card.characterId}
            card={card}
            isOwn={card.ownerUserId === auth?.userId}
          />
        ))}
      </div>
    </aside>
  );
}
