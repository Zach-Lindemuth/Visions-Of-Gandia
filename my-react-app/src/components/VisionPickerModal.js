import { useState, useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import { getVisions } from "../api/characterApi";

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

export default function VisionPickerModal({ initialVisionId, onSelect, onClear, onClose }) {
  const { auth } = useAuth();
  const [visions, setVisions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedVision, setSelectedVision] = useState(null);
  const [visionAnimId, setVisionAnimId] = useState(null);
  const [isVisionAnim, setIsVisionAnim] = useState(false);

  useEffect(() => {
    getVisions(auth.token)
      .catch(() => [])
      .then((v) => {
        const list = Array.isArray(v) ? v : [];
        setVisions(list);
        if (initialVisionId != null) {
          const matched = list.find((vis) => vis.visionId === initialVisionId);
          if (matched) setSelectedVision(matched);
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

  const confirm = () => {
    if (!selectedVision || isVisionAnim) return;
    onSelect(selectedVision);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box origin-picker-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Choose Vision</h2>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <>
            <div className="picker-section">
              <div className="origin-desc-grid">
                {visions.map((v) => {
                  const isFlashing = v.visionId === visionAnimId;
                  const isSelected = !isFlashing && selectedVision?.visionId === v.visionId;
                  return (
                    <button
                      key={v.visionId}
                      className={"picker-card" + (isSelected ? " selected" : "") + (isFlashing ? " origin-anim" : "")}
                      onClick={() => {
                        if (isVisionAnim) return;
                        setSelectedVision(selectedVision?.visionId === v.visionId ? null : v);
                      }}
                      disabled={isVisionAnim}
                    >
                      {v.name}
                    </button>
                  );
                })}
              </div>

              {selectedVision && (
                <div className="vision-preview-panel">
                  <span className="vision-preview-name">{selectedVision.name}</span>
                  <p className="vision-preview-desc">{selectedVision.description}</p>
                </div>
              )}

              <div className="origin-footer">
                <button
                  className={"origin-random-btn" + (isVisionAnim ? " origin-rolling" : "")}
                  onClick={runVisionAnim}
                  disabled={isVisionAnim}
                >
                  {isVisionAnim ? "Rolling…" : "🎲 Roll Random"}
                </button>
              </div>
            </div>

            <div className="edit-profile-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              {onClear && initialVisionId != null && (
                <button type="button" className="btn-secondary" onClick={onClear}>Remove Vision</button>
              )}
              <button type="button" className="btn-primary" onClick={confirm} disabled={!selectedVision || isVisionAnim}>
                Use This Vision
              </button>
            </div>
          </>
        )}

        <button className="modal-close-btn" onClick={onClose}>✕</button>
      </div>
    </div>
  );
}
