import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../../auth/AuthContext";
import { getArcana, getTechniques } from "../../../api/characterApi";
import PaginatedPickerList from "../PaginatedPickerList";

const CREATION_LIMIT = 2;

export default function Step5Powers({ data, update, next, back }) {
  const { auth } = useAuth();
  const [arcana, setArcana] = useState([]);
  const [techniques, setTechniques] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("arcana");
  const [shaking, setShaking] = useState(false);
  const shakeTimer = useRef(null);

  useEffect(() => {
    Promise.all([
      getArcana(auth.token).catch(() => []),
      getTechniques(auth.token).catch(() => []),
    ])
      .then(([a, t]) => {
        setArcana(Array.isArray(a) ? a : []);
        setTechniques(Array.isArray(t) ? t : []);
      })
      .finally(() => setLoading(false));
  }, [auth.token]);

  const total = data.arcanaIds.length + data.techniqueIds.length;
  const atLimit = total === CREATION_LIMIT;
  const hasData = arcana.length > 0 || techniques.length > 0;

  const toggleArcana = (id) => {
    if (data.arcanaIds.includes(id)) {
      update({ arcanaIds: data.arcanaIds.filter((a) => a !== id) });
    } else if (total < CREATION_LIMIT) {
      update({ arcanaIds: [...data.arcanaIds, id] });
    }
  };

  const toggleTechnique = (id) => {
    if (data.techniqueIds.includes(id)) {
      update({ techniqueIds: data.techniqueIds.filter((t) => t !== id) });
    } else if (total < CREATION_LIMIT) {
      update({ techniqueIds: [...data.techniqueIds, id] });
    }
  };

  const tryNext = () => {
    if (total !== CREATION_LIMIT) {
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

  // All selected powers shown at top regardless of active tab
  const selectedItems = [
    ...data.arcanaIds.map((id) => {
      const item = arcana.find((a) => a.arcanaId === id);
      return item
        ? { key: `a-${id}`, name: item.name, description: item.description, sub: item.upcast, subLabel: "Upcast", onRemove: () => toggleArcana(id) }
        : null;
    }),
    ...data.techniqueIds.map((id) => {
      const item = techniques.find((t) => t.techniqueId === id);
      return item
        ? { key: `t-${id}`, name: item.name, description: item.description, sub: item.combo, subLabel: "Combo", onRemove: () => toggleTechnique(id) }
        : null;
    }),
  ].filter(Boolean);

  const isArcanaTab = tab === "arcana";
  const activePool = isArcanaTab ? arcana : techniques;
  const selectedIds = isArcanaTab ? data.arcanaIds : data.techniqueIds;
  const getId = isArcanaTab ? (item) => item.arcanaId : (item) => item.techniqueId;
  const getToggle = isArcanaTab ? toggleArcana : toggleTechnique;
  const getSub = isArcanaTab ? (item) => item.upcast : (item) => item.combo;
  const subLabel = isArcanaTab ? "Upcast" : "Combo";

  const available = activePool.filter((item) => !selectedIds.includes(getId(item)));
  const tabEmpty = activePool.length === 0;

  return (
    <div className="wizard-step">
      <div className="wizard-step-header">
        <h2>Powers</h2>
        {hasData && (
          <div className={`selection-badge ${atLimit ? "done" : ""} ${shaking ? "shake" : ""}`}>
            {total} / {CREATION_LIMIT} selected
          </div>
        )}
      </div>
      <p className="wizard-hint">
        Choose <strong>2 Powers</strong> — any mix of Arcana and Techniques.
      </p>
      <p className="wizard-note">You can add more powers freely from the character sheet later.</p>

      {selectedItems.length > 0 && (
        <div className="talent-selected-panel">
          {selectedItems.map((item) => (
            <button
              key={item.key}
              className="picker-card selected talent-selected-card"
              onClick={item.onRemove}
              title="Click to remove"
            >
              <div className="talent-selected-header">
                <strong>{item.name}</strong>
                <span className="slot-remove">×</span>
              </div>
              {item.description && <p>{item.description}</p>}
              {item.sub && (
                <div className="card-sub-section">
                  <span className="card-sub-label">{item.subLabel}:</span>
                  <span className="card-sub-text">{item.sub}</span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {atLimit && (
        <button className="talent-confirm-btn" onClick={next}>Confirm Powers →</button>
      )}

      <div className="tab-bar">
        <button
          className={`tab-btn ${isArcanaTab ? "active" : ""}`}
          onClick={() => setTab("arcana")}
        >
          Arcana {data.arcanaIds.length > 0 && `(${data.arcanaIds.length})`}
        </button>
        <button
          className={`tab-btn ${!isArcanaTab ? "active" : ""}`}
          onClick={() => setTab("techniques")}
        >
          Techniques {data.techniqueIds.length > 0 && `(${data.techniqueIds.length})`}
        </button>
      </div>

      <PaginatedPickerList
        key={tab}
        items={available}
        loading={loading}
        emptyMessage={tabEmpty ? `No ${tab} in the database yet.` : `No ${tab} available.`}
        noResultsMessage={`No ${tab} match your search.`}
        disabled={atLimit}
        getId={getId}
        onSelect={getToggle}
        renderCardContent={(item) => (
          <>
            <strong>{item.name}</strong>
            {item.description && <p>{item.description}</p>}
            {getSub(item) && (
              <div className="card-sub-section">
                <span className="card-sub-label">{subLabel}:</span>
                <span className="card-sub-text">{getSub(item)}</span>
              </div>
            )}
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
