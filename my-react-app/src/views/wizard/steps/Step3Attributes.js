import { useRef, useState } from "react";

const ATTR_PAIRS = [
  ["might", "endurance"],
  ["precision", "agility"],
  ["mind", "willpower"],
];

const LABELS = {
  might: "Might",
  precision: "Precision",
  mind: "Mind",
  endurance: "Endurance",
  agility: "Agility",
  willpower: "Willpower",
};

const DESCRIPTIONS = {
  might: "Primary scaling for attacks",
  precision: "Increases critical strike chance",
  mind: "Determines your proficiency in the arcane",
  endurance: "Determines your starting health, and how well you can take a hit and keep going",
  agility: "Determines how well you can avoid physical damage",
  willpower: "Determines your starting energy, and how well you can resist arcane effects",
};

const BASE = 1;
const MAX_ATTR = 5;
// 6 attributes × 1 base = 6, plus 8 distributable points = 14 total cap
const MAX_SUM = 14;

export default function Step3Attributes({ data, update, next, back }) {
  // Clamp incoming values to [BASE, MAX_ATTR] defensively so stale state can't break the UI
  const raw = data.attributes;
  const attrs = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Math.max(BASE, Math.min(MAX_ATTR, v))])
  );

  const [shaking, setShaking] = useState(false);
  const shakeTimer = useRef(null);

  const sum = Object.values(attrs).reduce((s, v) => s + v, 0);
  const remaining = MAX_SUM - sum; // 8 when all at base, 0 when fully spent

  const tryNext = () => {
    if (remaining !== 0) {
      clearTimeout(shakeTimer.current);
      setShaking(false);
      requestAnimationFrame(() => {
        setShaking(true);
        shakeTimer.current = setTimeout(() => setShaking(false), 450);
      });
      return;
    }
    next();
  };

  const life = 10 + attrs.endurance;
  const energy = 5 + attrs.willpower;

  const setAttr = (key, val) => {
    const clamped = Math.max(BASE, Math.min(MAX_ATTR, val));
    const proposed = { ...attrs, [key]: clamped };
    const newSum = Object.values(proposed).reduce((s, v) => s + v, 0);
    if (newSum <= MAX_SUM) {
      update({ attributes: proposed });
    }
  };

  const renderAttr = (key) => (
    <div key={key} className="attr-alloc-row">
      <div className="attr-alloc-label-group">
        <span className="attr-alloc-label">{LABELS[key]}</span>
        <span className="attr-alloc-desc">{DESCRIPTIONS[key]}</span>
      </div>
      <div className="attr-alloc-controls">
        <button
          className="attr-btn"
          onClick={() => setAttr(key, attrs[key] - 1)}
          disabled={attrs[key] <= BASE}
        >−</button>
        <span className="attr-alloc-value">{attrs[key]}</span>
        <button
          className="attr-btn"
          onClick={() => setAttr(key, attrs[key] + 1)}
          disabled={attrs[key] >= MAX_ATTR || remaining === 0}
        >+</button>
      </div>
    </div>
  );

  return (
    <div className="wizard-step">
      <div className="wizard-step-header">
        <h2>Attributes</h2>
        <div className={`points-badge ${remaining === 0 ? "done" : ""} ${shaking ? "shake" : ""}`}>
          {remaining} point{remaining !== 1 ? "s" : ""} remaining
        </div>
      </div>
      <p className="wizard-hint">
        Attributes determine your dice pools used in making skill checks, and resisting effects, as well as determining your characters core stats.
      </p>
      <p className="wizard-hint">
        Distribute <strong>8 points</strong> across your six attributes. Maximum 5 per attribute.
      </p>

      <div className="attr-allocator-columns">
        {ATTR_PAIRS.map(([left, right]) => (
          <>
            {renderAttr(left)}
            {renderAttr(right)}
          </>
        ))}
      </div>

      <div className="derived-preview">
        <div className="derived-item">
          <span>Starting Life</span>
          <strong>{life}</strong>
        </div>
        <div className="derived-item">
          <span>Starting Energy</span>
          <strong>{energy}</strong>
        </div>
      </div>

      <div className="wizard-nav">
        <button className="btn-secondary" onClick={back}>← Back</button>
        {remaining === 0 && (
          <button className="wizard-confirm-btn" onClick={next}>Confirm Attributes →</button>
        )}
        <button onClick={tryNext}>Next →</button>
      </div>
    </div>
  );
}
