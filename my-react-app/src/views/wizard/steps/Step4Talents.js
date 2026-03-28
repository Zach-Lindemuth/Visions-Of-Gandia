import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../../auth/AuthContext";
import { getTalents } from "../../../api/characterApi";

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

export default function Step4Talents({ data, update, next, back }) {
  const { auth } = useAuth();
  const [talents, setTalents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
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

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchQuery(searchInput);
    setPage(1);
  };

  const hasData = talents.length > 0;
  const atLimit = data.talentIds.length === CREATION_LIMIT;

  const selectedTalents = data.talentIds
    .map((id) => talents.find((t) => t.talentId === id))
    .filter(Boolean);

  const filtered = (
    searchQuery
      ? talents.filter(
          (t) =>
            t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.description?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : talents
  ).filter((t) => !data.talentIds.includes(t.talentId));

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const paginationItems = getPaginationItems(safePage, totalPages);

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
        <p className="muted">Loading talents...</p>
      ) : !hasData ? (
        <p className="muted">No talents in the database yet. You can add them later from the character sheet.</p>
      ) : filtered.length === 0 && !atLimit ? (
        <p className="muted">No talents match your search.</p>
      ) : filtered.length === 0 ? null : (
        <>
          <div className="picker-list">
            {paginated.map((t) => (
              <button
                key={t.talentId}
                className="picker-card"
                onClick={() => toggle(t.talentId)}
                disabled={atLimit}
              >
                <strong>{t.name}</strong>
                {t.description && <p>{t.description}</p>}
              </button>
            ))}
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
