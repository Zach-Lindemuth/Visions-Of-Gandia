import { useState, useEffect } from "react";
import { useAuth } from "../../../auth/AuthContext";
import { getVisions } from "../../../api/characterApi";

const ANIM_DELAYS = [70, 80, 95, 110, 130, 155, 185, 220, 265, 0];

function buildVisionSequence(visions, count) {
  const seq = [];
  let lastId = null;
  for (let i = 0; i < count; i++) {
    const pool = visions.filter((v) => v.visionId !== lastId);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    seq.push(pick);
    lastId = pick.visionId;
  }
  return seq;
}

export default function Step3Vision({ data, update, next, back }) {
  const { auth } = useAuth();
  const [visions, setVisions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedVision, setSelectedVision] = useState(null);   // vision object
  const [visionConfirmed, setVisionConfirmed] = useState(false);
  const [confirmedVision, setConfirmedVision] = useState(null); // locked vision object
  const [visionAnimId, setVisionAnimId] = useState(null);
  const [isVisionAnim, setIsVisionAnim] = useState(false);

  useEffect(() => {
    getVisions(auth.token)
      .catch(() => [])
      .then((v) => {
        const list = Array.isArray(v) ? v : [];
        setVisions(list);

        // Re-hydrate when navigating back
        if (data.visionId) {
          const matched = list.find((vis) => vis.visionId === data.visionId);
          if (matched) {
            setSelectedVision(matched);
            setConfirmedVision(matched);
            setVisionConfirmed(true);
          }
        }
      })
      .finally(() => setLoading(false));
  }, [auth.token]); // eslint-disable-line react-hooks/exhaustive-deps

  const runVisionAnim = () => {
    if (!visions.length || isVisionAnim) return;
    setIsVisionAnim(true);
    setSelectedVision(null);

    const seq = buildVisionSequence(visions, 10);
    const step = (i) => {
      setVisionAnimId(seq[i].visionId);
      if (i === 9) {
        setTimeout(() => {
          setVisionAnimId(null);
          setSelectedVision(seq[9]);
          setIsVisionAnim(false);
        }, 380);
      } else {
        setTimeout(() => step(i + 1), ANIM_DELAYS[i]);
      }
    };
    step(0);
  };

  const confirmVision = () => {
    setConfirmedVision(selectedVision);
    setVisionConfirmed(true);
    update({ visionId: selectedVision ? selectedVision.visionId : null });
  };

  const changeVision = () => {
    setVisionConfirmed(false);
    setConfirmedVision(null);
    update({ visionId: null });
  };

  const visionCanConfirm = !isVisionAnim && selectedVision !== null;

  if (loading) {
    return (
      <div className="wizard-step">
        <p className="muted">Loading...</p>
      </div>
    );
  }

  return (
    <div className="wizard-step">
      <h2>Vision</h2>
      <p className="wizard-hint">
        Your <strong>Vision</strong> is what drives you.{" "}
        <span className="muted">(Optional)</span>
      </p>

      <div className="picker-section">
        {!visionConfirmed ? (
          <>
            {/* 4-column × 5-row grid */}
            <div className="origin-desc-grid">
              {visions.map((v) => {
                const isFlashing = v.visionId === visionAnimId;
                const isSelected =
                  !isFlashing && selectedVision?.visionId === v.visionId;
                return (
                  <button
                    key={v.visionId}
                    className={
                      "picker-card" +
                      (isSelected ? " selected" : "") +
                      (isFlashing ? " origin-anim" : "")
                    }
                    onClick={() => {
                      if (isVisionAnim) return;
                      setSelectedVision(
                        selectedVision?.visionId === v.visionId ? null : v
                      );
                    }}
                    disabled={isVisionAnim}
                  >
                    {v.name}
                  </button>
                );
              })}
            </div>

            {/* Selected vision description preview */}
            {selectedVision && (
              <div className="vision-preview-panel">
                <span className="vision-preview-name">{selectedVision.name}</span>
                <p className="vision-preview-desc">{selectedVision.description}</p>
              </div>
            )}

            {/* Roll Random button */}
            <div className="origin-footer">
              <button
                className={"origin-random-btn" + (isVisionAnim ? " origin-rolling" : "")}
                onClick={runVisionAnim}
                disabled={isVisionAnim}
              >
                {isVisionAnim ? "Rolling…" : "🎲 Roll Random"}
              </button>
            </div>

            <button
              className="origin-confirm-btn"
              onClick={confirmVision}
              disabled={!visionCanConfirm}
            >
              Confirm Vision
            </button>
          </>
        ) : (
          <div className="origin-confirmed-row">
            <span className="origin-confirmed-value">{confirmedVision.name}</span>
            <button
              className="btn-secondary origin-change-btn"
              onClick={changeVision}
            >
              Change
            </button>
          </div>
        )}
      </div>

      <div className="wizard-nav">
        <button className="btn-secondary" onClick={back}>
          ← Back
        </button>
        <button onClick={next}>Next →</button>
      </div>
    </div>
  );
}
