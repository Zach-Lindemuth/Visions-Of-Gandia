import { useState, useEffect, Fragment } from "react";
import { useAuth } from "../auth/AuthContext";
import { getOrigins } from "../api/characterApi";

const ANIM_DELAYS = [70, 80, 95, 110, 130, 155, 185, 220, 265, 0];

function buildDescriptorSequence(origins, count) {
  const seq = [];
  let lastId = null;
  for (let i = 0; i < count; i++) {
    const pool = origins.filter((o) => o.originId !== lastId);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    seq.push(pick);
    lastId = pick.originId;
  }
  return seq;
}

function buildRowSequence(rowCount, count) {
  const seq = [];
  let lastIdx = -1;
  for (let i = 0; i < count; i++) {
    const pool = Array.from({ length: rowCount }, (_, k) => k).filter((k) => k !== lastIdx);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    seq.push(pick);
    lastIdx = pick;
  }
  return seq;
}

export default function OriginPickerModal({ initialDescriptor, initialProfession, onSelect, onClose }) {
  const { auth } = useAuth();
  const [origins, setOrigins] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedDesc, setSelectedDesc] = useState(null);
  const [customDescText, setCustomDescText] = useState("");
  const [descAnimId, setDescAnimId] = useState(null);
  const [isDescAnim, setIsDescAnim] = useState(false);

  const [selectedProf, setSelectedProf] = useState("");
  const [customProfText, setCustomProfText] = useState("");
  const [profAnimIdx, setProfAnimIdx] = useState(null);
  const [profHighlightIdx, setProfHighlightIdx] = useState(null);
  const [isProfAnim, setIsProfAnim] = useState(false);
  const [showProfModal, setShowProfModal] = useState(false);

  useEffect(() => {
    getOrigins(auth.token)
      .catch(() => [])
      .then((o) => {
        const list = Array.isArray(o) ? o : [];
        setOrigins(list);
        if (initialDescriptor) {
          const matched = list.find((ori) => ori.descriptor === initialDescriptor);
          if (matched) setSelectedDesc(matched);
          else setCustomDescText(initialDescriptor);
        }
        if (initialProfession) setSelectedProf(initialProfession);
      })
      .finally(() => setLoading(false));
  }, [auth.token]); // eslint-disable-line react-hooks/exhaustive-deps

  const runDescAnim = () => {
    if (!origins.length || isDescAnim) return;
    setIsDescAnim(true);
    setSelectedDesc(null);
    setCustomDescText("");
    const seq = buildDescriptorSequence(origins, 10);
    const step = (i) => {
      setDescAnimId(seq[i].originId);
      if (i === 9) {
        setTimeout(() => {
          setDescAnimId(null);
          setSelectedDesc(seq[9]);
          setIsDescAnim(false);
        }, 380);
      } else {
        setTimeout(() => step(i + 1), ANIM_DELAYS[i]);
      }
    };
    step(0);
  };

  const runProfAnim = () => {
    if (!origins.length || isProfAnim) return;
    setIsProfAnim(true);
    setSelectedProf("");
    setCustomProfText("");
    setProfHighlightIdx(null);
    const seq = buildRowSequence(origins.length, 10);
    const step = (i) => {
      setProfAnimIdx(seq[i]);
      if (i === 9) {
        setTimeout(() => {
          setProfAnimIdx(null);
          setProfHighlightIdx(seq[9]);
          setIsProfAnim(false);
          setShowProfModal(true);
        }, 380);
      } else {
        setTimeout(() => step(i + 1), ANIM_DELAYS[i]);
      }
    };
    step(0);
  };

  const descriptor = selectedDesc ? selectedDesc.descriptor : customDescText.trim();
  const profession = selectedProf || customProfText.trim();
  const canConfirm = descriptor.length > 0 && profession.length > 0 && !isDescAnim && !isProfAnim;

  const confirm = () => {
    if (!canConfirm) return;
    onSelect({ descriptor, profession });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box origin-picker-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Choose Origin</h2>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <>
            <div className="picker-section">
              <h3>Descriptor</h3>
              <div className="origin-desc-grid">
                {origins.map((o) => {
                  const isFlashing = o.originId === descAnimId;
                  const isSelected = !isFlashing && selectedDesc?.originId === o.originId;
                  return (
                    <button
                      key={o.originId}
                      className={"picker-card" + (isSelected ? " selected" : "") + (isFlashing ? " origin-anim" : "")}
                      onClick={() => {
                        if (isDescAnim) return;
                        setSelectedDesc(selectedDesc?.originId === o.originId ? null : o);
                        setCustomDescText("");
                      }}
                      disabled={isDescAnim}
                    >
                      {o.descriptor}
                    </button>
                  );
                })}
              </div>
              <div className="origin-footer">
                <button
                  className={"origin-random-btn" + (isDescAnim ? " origin-rolling" : "")}
                  onClick={runDescAnim}
                  disabled={isDescAnim}
                >
                  {isDescAnim ? "Rolling…" : "🎲 Roll Random"}
                </button>
                <input
                  type="text"
                  className="origin-custom-input"
                  placeholder="Custom descriptor…"
                  value={customDescText}
                  disabled={isDescAnim}
                  onChange={(e) => { setCustomDescText(e.target.value); setSelectedDesc(null); }}
                />
              </div>
            </div>

            <div className="picker-section">
              <h3>Profession</h3>
              <div className="origin-prof-outer">
                {[origins.slice(0, 10), origins.slice(10)].map((half, halfIdx) => (
                  <div key={halfIdx} className="origin-prof-grid">
                    {half.map((o, localIdx) => {
                      const idx = halfIdx * 10 + localIdx;
                      const isFlashing = idx === profAnimIdx;
                      const isLanded = idx === profHighlightIdx && !isProfAnim;
                      const rowClass =
                        (isFlashing ? " origin-anim" : "") +
                        (isLanded && !isFlashing ? " origin-row-highlight" : "");
                      return (
                        <Fragment key={o.originId}>
                          {[o.professionA, o.professionB].filter(Boolean).map((prof) => {
                            const isSelected = selectedProf === prof;
                            return (
                              <button
                                key={prof}
                                className={"picker-card" + (isSelected ? " selected" : rowClass)}
                                onClick={() => {
                                  if (isProfAnim) return;
                                  setSelectedProf(selectedProf === prof ? "" : prof);
                                  setCustomProfText("");
                                  setProfHighlightIdx(null);
                                }}
                                disabled={isProfAnim}
                              >
                                {prof}
                              </button>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="origin-footer">
                <button
                  className={"origin-random-btn" + (isProfAnim ? " origin-rolling" : "")}
                  onClick={runProfAnim}
                  disabled={isProfAnim}
                >
                  {isProfAnim ? "Rolling…" : "🎲 Roll Random"}
                </button>
                <input
                  type="text"
                  className="origin-custom-input"
                  placeholder="Custom profession…"
                  value={customProfText}
                  disabled={isProfAnim}
                  onChange={(e) => {
                    setCustomProfText(e.target.value);
                    setSelectedProf("");
                    setProfHighlightIdx(null);
                  }}
                />
              </div>
            </div>

            <div className="edit-profile-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button type="button" className="btn-primary" onClick={confirm} disabled={!canConfirm}>
                Use This Origin
              </button>
            </div>
          </>
        )}

        <button className="modal-close-btn" onClick={onClose}>✕</button>

        {showProfModal && profHighlightIdx !== null && (() => {
          const landed = origins[profHighlightIdx];
          if (!landed) return null;
          const professions = [landed.professionA, landed.professionB].filter(Boolean);
          return (
            <div className="prof-modal-overlay" onClick={() => setShowProfModal(false)}>
              <div className="prof-modal" onClick={(e) => e.stopPropagation()}>
                <p className="prof-modal-hint">The dice have spoken — choose your profession:</p>
                <div className="prof-modal-choices">
                  {professions.map((prof) => (
                    <button
                      key={prof}
                      className={"picker-card prof-modal-choice" + (selectedProf === prof ? " selected" : "")}
                      onClick={() => {
                        setSelectedProf(prof);
                        setProfHighlightIdx(null);
                        setShowProfModal(false);
                      }}
                    >
                      {prof}
                    </button>
                  ))}
                </div>
                <button
                  className="btn-secondary prof-modal-reroll"
                  onClick={() => { setShowProfModal(false); runProfAnim(); }}
                >
                  🎲 Reroll
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
