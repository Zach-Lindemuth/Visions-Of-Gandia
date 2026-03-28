import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../../auth/AuthContext";
import { getArcana, getTechniques } from "../../../api/characterApi";

const CREATION_LIMIT = 2;
const PAGE_SIZE = 8;

function getPaginationItems(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, "...", total];
  }
  if (current >= total - 3) {
    return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, "...", current - 2, current - 1, current, current + 1, current + 2, "...", total];
}

export default function Step5Powers({ data, update, next, back }) {
  const { auth } = useAuth();
  const [arcana, setArcana] = useState([]);
  const [techniques, setTechniques] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("arcana");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
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

  const handleTabChange = (newTab) => {
    setTab(newTab);
    setSearchInput("");
    setSearchQuery("");
    setPage(1);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchQuery(searchInput);
    setPage(1);
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

  // Active tab pool, excluding already-selected items
  const activePool = tab === "arcana" ? arcana : techniques;
  const selectedIds = tab === "arcana" ? data.arcanaIds : data.techniqueIds;
  const getId = tab === "arcana" ? (item) => item.arcanaId : (item) => item.techniqueId;
  const getToggle = tab === "arcana" ? toggleArcana : toggleTechnique;
  const getSub = tab === "arcana" ? (item) => item.upcast : (item) => item.combo;
  const subLabel = tab === "arcana" ? "Upcast" : "Combo";

  const filtered = activePool
    .filter((item) => !selectedIds.includes(getId(item)))
    .filter(
      (item) =>
        !searchQuery ||
        item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const paginationItems = getPaginationItems(safePage, totalPages);

  const tabEmpty = tab === "arcana" ? arcana.length === 0 : techniques.length === 0;

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
          className={`tab-btn ${tab === "arcana" ? "active" : ""}`}
          onClick={() => handleTabChange("arcana")}
        >
          Arcana {data.arcanaIds.length > 0 && `(${data.arcanaIds.length})`}
        </button>
        <button
          className={`tab-btn ${tab === "techniques" ? "active" : ""}`}
          onClick={() => handleTabChange("techniques")}
        >
          Techniques {data.techniqueIds.length > 0 && `(${data.techniqueIds.length})`}
        </button>
      </div>

      <form className="talent-search" onSubmit={handleSearch}>
        <input
          type="text"
          placeholder="Search by name or description..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <button type="submit">Search</button>
      </form>

      {loading ? (
        <p className="muted">Loading powers...</p>
      ) : tabEmpty ? (
        <p className="muted">No {tab} in the database yet.</p>
      ) : filtered.length === 0 && !atLimit ? (
        <p className="muted">No {tab} match your search.</p>
      ) : filtered.length === 0 ? null : (
        <>
          <div className="picker-list">
            {paginated.map((item) => {
              const id = getId(item);
              return (
                <button
                  key={id}
                  className="picker-card"
                  onClick={() => getToggle(id)}
                  disabled={atLimit}
                >
                  <strong>{item.name}</strong>
                  {item.description && <p>{item.description}</p>}
                  {getSub(item) && (
                    <div className="card-sub-section">
                      <span className="card-sub-label">{subLabel}:</span>
                      <span className="card-sub-text">{getSub(item)}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="talent-pagination">
              <button
                className="pg-btn pg-nav"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
              >
                PREV
              </button>
              {paginationItems.map((item, i) =>
                item === "..." ? (
                  <span key={`ellipsis-${i}`} className="pg-ellipsis">...</span>
                ) : (
                  <button
                    key={item}
                    className={`pg-btn pg-num${item === safePage ? " pg-active" : ""}`}
                    onClick={() => setPage(item)}
                  >
                    {item}
                  </button>
                )
              )}
              <button
                className="pg-btn pg-nav"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
              >
                NEXT
              </button>
            </div>
          )}
        </>
      )}

      <div className="wizard-nav">
        <button className="btn-secondary" onClick={back}>← Back</button>
        <button onClick={tryNext}>Next →</button>
      </div>
    </div>
  );
}
