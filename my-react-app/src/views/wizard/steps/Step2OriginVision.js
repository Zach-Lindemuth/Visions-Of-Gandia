import { useState, useEffect, Fragment } from "react";
import { useAuth } from "../../../auth/AuthContext";
import { getOrigins } from "../../../api/characterApi";

// Timing curve: starts fast, slows to a stop (ms between each flash)
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
    const pool = Array.from({ length: rowCount }, (_, k) => k).filter(
      (k) => k !== lastIdx
    );
    const pick = pool[Math.floor(Math.random() * pool.length)];
    seq.push(pick);
    lastIdx = pick;
  }
  return seq;
}

export default function Step2OriginVision({ data, update, next, back }) {
  const { auth } = useAuth();
  const [origins, setOrigins] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── Descriptor ──────────────────────────────────────────────────────────
  const [selectedDesc, setSelectedDesc] = useState(null);   // origin object
  const [customDescText, setCustomDescText] = useState("");
  const [descConfirmed, setDescConfirmed] = useState(false);
  const [confirmedDesc, setConfirmedDesc] = useState(null); // locked origin object
  const [confirmedCustomDesc, setConfirmedCustomDesc] = useState("");
  const [descAnimId, setDescAnimId] = useState(null);
  const [isDescAnim, setIsDescAnim] = useState(false);

  // ── Profession ──────────────────────────────────────────────────────────
  const [selectedProf, setSelectedProf] = useState("");
  const [customProfText, setCustomProfText] = useState("");
  const [profConfirmed, setProfConfirmed] = useState(false);
  const [confirmedProfText, setConfirmedProfText] = useState("");
  const [profAnimIdx, setProfAnimIdx] = useState(null);     // row index flashing
  const [profHighlightIdx, setProfHighlightIdx] = useState(null); // row landed on
  const [isProfAnim, setIsProfAnim] = useState(false);
  const [showProfModal, setShowProfModal] = useState(false); // choice modal after random

  useEffect(() => {
    getOrigins(auth.token)
      .catch(() => [])
      .then((o) => {
        const originList = Array.isArray(o) ? o : [];
        setOrigins(originList);

        // Re-hydrate when navigating back
        if (data.descriptor || data.profession) {
          const matched = originList.find(
            (ori) => ori.descriptor === data.descriptor
          );
          if (matched) {
            setSelectedDesc(matched);
            setConfirmedDesc(matched);
          } else if (data.descriptor) {
            setCustomDescText(data.descriptor);
            setConfirmedCustomDesc(data.descriptor);
          }
          if (data.descriptor) setDescConfirmed(true);
          if (data.profession) {
            setSelectedProf(data.profession);
            setConfirmedProfText(data.profession);
            setProfConfirmed(true);
          }
        }
      })
      .finally(() => setLoading(false));
  }, [auth.token]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Descriptor animation ─────────────────────────────────────────────────
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

  // ── Profession animation ─────────────────────────────────────────────────
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

  // ── Descriptor actions ───────────────────────────────────────────────────
  const confirmDescriptor = () => {
    const origin = selectedDesc;
    const custom = customDescText.trim();
    setConfirmedDesc(origin);
    setConfirmedCustomDesc(custom);
    setDescConfirmed(true);
    // Reset profession on descriptor change
    setSelectedProf("");
    setCustomProfText("");
    setProfHighlightIdx(null);
    setProfConfirmed(false);
    setConfirmedProfText("");
    setShowProfModal(false);
    const desc = origin ? origin.descriptor : custom;
    update({ descriptor: desc, profession: "" });
  };

  const changeDescriptor = () => {
    setDescConfirmed(false);
    setConfirmedDesc(null);
    setConfirmedCustomDesc("");
    setProfConfirmed(false);
    setConfirmedProfText("");
    setSelectedProf("");
    setProfHighlightIdx(null);
    setCustomProfText("");
    update({ descriptor: "", profession: "" });
  };

  // ── Profession actions ───────────────────────────────────────────────────
  const confirmProfession = () => {
    const prof = selectedProf || customProfText.trim();
    setConfirmedProfText(prof);
    setProfConfirmed(true);
    const desc = confirmedDesc ? confirmedDesc.descriptor : confirmedCustomDesc;
    update({ descriptor: desc, profession: prof });
    next();
  };

  const changeProfession = () => {
    setProfConfirmed(false);
    setConfirmedProfText("");
    setSelectedProf("");
    setProfHighlightIdx(null);
    setCustomProfText("");
    setShowProfModal(false);
    const desc = confirmedDesc ? confirmedDesc.descriptor : confirmedCustomDesc;
    update({ descriptor: desc, profession: "" });
  };

  const descCanConfirm =
    !isDescAnim &&
    (selectedDesc !== null || customDescText.trim().length > 0);

  const profCanConfirm =
    !isProfAnim &&
    (selectedProf.length > 0 || customProfText.trim().length > 0);

  if (loading) {
    return (
      <div className="wizard-step">
        <p className="muted">Loading...</p>
      </div>
    );
  }

  return (
    <div className="wizard-step">
      <h2>Origin</h2>
      <p className="wizard-hint">
        Your <strong>Origin</strong> describes who you were before adventuring.
      </p>

      {/* ══ DESCRIPTOR ══════════════════════════════════════════════════════ */}
      <div className="picker-section">
        <h3>Descriptor</h3>

        {!descConfirmed ? (
          <>
            {/* 4-column × 5-row grid */}
            <div className="origin-desc-grid">
              {origins.map((o) => {
                const isFlashing = o.originId === descAnimId;
                const isSelected =
                  !isFlashing && selectedDesc?.originId === o.originId;
                return (
                  <button
                    key={o.originId}
                    className={
                      "picker-card" +
                      (isSelected ? " selected" : "") +
                      (isFlashing ? " origin-anim" : "")
                    }
                    onClick={() => {
                      if (isDescAnim) return;
                      setSelectedDesc(
                        selectedDesc?.originId === o.originId ? null : o
                      );
                      setCustomDescText("");
                    }}
                    disabled={isDescAnim}
                  >
                    {o.descriptor}
                  </button>
                );
              })}
            </div>

            {/* Roll Random + Custom input */}
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
                onChange={(e) => {
                  setCustomDescText(e.target.value);
                  setSelectedDesc(null);
                }}
              />
            </div>

            <button
              className="origin-confirm-btn"
              onClick={confirmDescriptor}
              disabled={!descCanConfirm}
            >
              Confirm Descriptor
            </button>
          </>
        ) : (
          <div className="origin-confirmed-row">
            <span className="origin-confirmed-value">
              {confirmedDesc ? confirmedDesc.descriptor : confirmedCustomDesc}
            </span>
            <button
              className="btn-secondary origin-change-btn"
              onClick={changeDescriptor}
            >
              Change
            </button>
          </div>
        )}
      </div>

      {/* ══ PROFESSION ══════════════════════════════════════════════════════ */}
      {descConfirmed && (
        <div className="picker-section">
          <h3>Profession</h3>

          {!profConfirmed ? (
            <>
              {/* Two side-by-side 2-column grids, each covering half the origins */}
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
                          {[o.professionA, o.professionB]
                            .filter(Boolean)
                            .map((prof) => {
                              const isSelected = selectedProf === prof;
                              return (
                                <button
                                  key={prof}
                                  className={
                                    "picker-card" +
                                    (isSelected ? " selected" : rowClass)
                                  }
                                  onClick={() => {
                                    if (isProfAnim) return;
                                    setSelectedProf(
                                      selectedProf === prof ? "" : prof
                                    );
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

              {/* Roll Random + Custom input */}
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

              <button
                className="origin-confirm-btn"
                onClick={confirmProfession}
                disabled={!profCanConfirm}
              >
                Confirm Profession
              </button>
            </>
          ) : (
            <div className="origin-confirmed-row">
              <span className="origin-confirmed-value">{confirmedProfText}</span>
              <button
                className="btn-secondary origin-change-btn"
                onClick={changeProfession}
              >
                Change
              </button>
            </div>
          )}
        </div>
      )}

      <div className="wizard-nav">
        <button className="btn-secondary" onClick={back}>
          ← Back
        </button>
        <button onClick={next} disabled={!descConfirmed || !profConfirmed}>Next →</button>
      </div>

      {/* ══ PROFESSION CHOICE MODAL ══════════════════════════════════════════ */}
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
                onClick={() => {
                  setShowProfModal(false);
                  runProfAnim();
                }}
              >
                🎲 Reroll
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
