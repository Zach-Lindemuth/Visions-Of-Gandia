const ATTR_LABELS = {
  might: "Might",
  precision: "Precision",
  mind: "Mind",
  endurance: "Endurance",
  agility: "Agility",
  willpower: "Willpower",
};

export default function Step7Review({ data, back, onSubmit, submitting }) {
  const { attributes } = data;
  const life = 10 + attributes.endurance;
  const energy = 5 + attributes.willpower;

  return (
    <div className="wizard-step review">
      <h2>Review Your Character</h2>
      <p className="wizard-hint">Take a final look before creating your character.</p>

      <div className="review-block">
        <h3>Basics</h3>
        <p className="review-name">{data.name}</p>
        <p className="muted">{data.nickname}</p>
      </div>

      <div className="review-block">
        <h3>Attributes</h3>
        <div className="review-attrs">
          {Object.entries(attributes).map(([k, v]) => (
            <div key={k} className="review-attr">
              <span className="muted">{ATTR_LABELS[k]}</span>
              <strong>{v}</strong>
            </div>
          ))}
        </div>
        <p className="review-derived muted">
          Life: <strong>{life}</strong> &nbsp;·&nbsp; Energy: <strong>{energy}</strong>
        </p>
      </div>

      <div className="review-block">
        <h3>Powers & Talents</h3>
        <p>
          {data.talentIds.length} talent{data.talentIds.length !== 1 ? "s" : ""},&nbsp;
          {data.arcanaIds.length} arcana,&nbsp;
          {data.techniqueIds.length} technique{data.techniqueIds.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="review-block">
        <h3>Equipment</h3>
        {data.weapons.length > 0 ? (
          <ul className="review-list">
            {data.weapons.map((w, i) => <li key={i}>{w.name}</li>)}
          </ul>
        ) : (
          <p className="muted">No weapons</p>
        )}
        {data.armorTypeId ? (
          <p>{data.armorName}</p>
        ) : (
          <p className="muted">No armor</p>
        )}
      </div>

      <div className="wizard-nav">
        <button className="btn-secondary" onClick={back} disabled={submitting}>← Back</button>
        <button onClick={onSubmit} disabled={submitting}>
          {submitting ? "Creating..." : "Create Character"}
        </button>
      </div>
    </div>
  );
}
