import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../../auth/AuthContext";
import { getTalents } from "../../../api/characterApi";
import PaginatedPickerList from "../PaginatedPickerList";

const CREATION_LIMIT = 2;

export default function Step4Talents({ data, update, next, back }) {
  const { auth } = useAuth();
  const [talents, setTalents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shaking, setShaking] = useState(false);
  const shakeTimer = useRef(null);

  useEffect(() => {
    getTalents(auth.token)
      .then((t) => setTalents(Array.isArray(t) ? t : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [auth.token]);

  const toggle = (id) => {
    if (data.talentIds.includes(id)) {
      update({ talentIds: data.talentIds.filter((t) => t !== id) });
    } else if (data.talentIds.length < CREATION_LIMIT) {
      update({ talentIds: [...data.talentIds, id] });
    }
  };

  const tryNext = () => {
    if (data.talentIds.length !== CREATION_LIMIT) {
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

  const hasData = talents.length > 0;
  const atLimit = data.talentIds.length === CREATION_LIMIT;

  const selectedTalents = data.talentIds
    .map((id) => talents.find((t) => t.talentId === id))
    .filter(Boolean);

  const available = talents.filter((t) => !data.talentIds.includes(t.talentId));

  return (
    <div className="wizard-step">
      <div className="wizard-step-header">
        <h2>Talents</h2>
        {hasData && (
          <div className={`selection-badge ${atLimit ? "done" : ""} ${shaking ? "shake" : ""}`}>
            {data.talentIds.length} / {CREATION_LIMIT} selected
          </div>
        )}
      </div>
      <p className="wizard-hint">Choose <strong>2 Talents</strong> to start with.</p>
      <p className="wizard-note">You can freely add more talents from the character sheet later.</p>

      {selectedTalents.length > 0 && (
        <div className="talent-selected-panel">
          {selectedTalents.map((talent) => (
            <button
              key={talent.talentId}
              className="picker-card selected talent-selected-card"
              onClick={() => toggle(talent.talentId)}
              title="Click to remove"
            >
              <div className="talent-selected-header">
                <strong>{talent.name}</strong>
                <span className="slot-remove">×</span>
              </div>
              {talent.description && <p>{talent.description}</p>}
            </button>
          ))}
        </div>
      )}

      {atLimit && (
        <button className="talent-confirm-btn" onClick={next}>Confirm Talents →</button>
      )}

      <PaginatedPickerList
        items={available}
        loading={loading}
        emptyMessage="No talents in the database yet. You can add them later from the character sheet."
        noResultsMessage="No talents match your search."
        disabled={atLimit}
        getId={(t) => t.talentId}
        onSelect={toggle}
        renderCardContent={(t) => (
          <>
            <strong>{t.name}</strong>
            {t.description && <p>{t.description}</p>}
          </>
        )}
      />

      <div className="wizard-nav">
        <button className="btn-secondary" onClick={back}>← Back</button>
        <button onClick={tryNext}>Next →</button>
      </div>
    </div>
  );
}
