import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();
  const slots = Array.from({ length: 8 });

  return (
    <div className="dashboard-wide">
      <header className="dashboard-header">
        <h1>Your Characters</h1>
      </header>

      <div className="character-grid">
        {slots.map((_, index) => (
          <div
            key={index}
            className="character-slot empty"
            onClick={() => navigate("/characters/new")}
          >
            <div className="plus">+</div>
            <div className="slot-text">Create Character</div>
          </div>
        ))}
      </div>
    </div>
  );
}