import { useNavigate } from "react-router-dom";

export default function Step1Basics({ data, update, next }) {
  const navigate = useNavigate();
  const valid = data.name.trim() && data.nickname.trim();

  return (
    <div className="wizard-step">
      <h2>Character Basics</h2>
      <p className="wizard-hint">Give your character a name and a title.</p>

      <div className="form-group">
        <label>Name</label>
        <input
          placeholder="e.g. Maxwell Longfoot"
          value={data.name}
          onChange={(e) => update({ name: e.target.value })}
        />
      </div>

      <div className="form-group">
        <label>Title</label>
        <input
          placeholder="e.g. Basic Fighting Guy"
          value={data.nickname}
          onChange={(e) => update({ nickname: e.target.value })}
        />
      </div>

      <div className="form-group">
        <label>Image URL <span className="optional">(optional)</span></label>
        <input
          placeholder="https://..."
          value={data.imageUrl}
          onChange={(e) => update({ imageUrl: e.target.value })}
        />
      </div>

      <div className="wizard-nav">
        <button className="btn-secondary" onClick={() => navigate("/")}>Cancel</button>
        <button onClick={next} disabled={!valid}>Next →</button>
      </div>
    </div>
  );
}
