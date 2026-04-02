import { useState, useRef, useEffect, useCallback } from "react";

const MIN_W = 300;
const MIN_H = 260;
const HANDLES = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

export default function VitalManagementPanel({ type, current, max, onApply, onChangeMax, onClose }) {
  const isGold = type === "gold";
  const label = type === "life" ? "Health" : type === "energy" ? "Energy" : type === "gold" ? "Gold" : "Items";
  const color =
    type === "life" ? "var(--vital-life)" : type === "energy" ? "var(--vital-energy)" : "var(--primary-color)";
  const addLabel = type === "life" ? "Healing" : type === "energy" ? "Recover" : "Add";
  const subLabel = type === "life" ? "Damage" : type === "energy" ? "Spend" : "Remove";

  const [healAmount, setHealAmount] = useState("");
  const [damageAmount, setDamageAmount] = useState("");

  const healVal = parseInt(healAmount, 10) || 0;
  const dmgVal = parseInt(damageAmount, 10) || 0;

  const previewCurrent = isGold
    ? Math.max(0, current + healVal - dmgVal)
    : Math.max(0, Math.min(max, current + healVal - dmgVal));
  const changed = previewCurrent !== current;

  const handleApply = () => {
    if (!changed) return;
    onApply(previewCurrent - current);
    setHealAmount("");
    setDamageAmount("");
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleApply();
  };

  // ── Drag / Resize (same pattern as PickerModal) ────────
  const [pos, setPos] = useState(null);
  const [size, setSize] = useState(null);
  const cleanupRef = useRef(null);

  useEffect(() => {
    const w = Math.min(480, window.innerWidth * 0.92);
    const h = Math.min(560, window.innerHeight * 0.85);
    setSize({ width: w, height: h });
    setPos({ x: (window.innerWidth - w) / 2, y: (window.innerHeight - h) / 2 });
  }, []);

  useEffect(() => {
    return () => { if (cleanupRef.current) cleanupRef.current(); };
  }, []);

  const onDragStart = useCallback(
    (e) => {
      if (!pos) return;
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const origX = pos.x;
      const origY = pos.y;
      const onMove = (e) =>
        setPos({ x: origX + e.clientX - startX, y: origY + e.clientY - startY });
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        cleanupRef.current = null;
      };
      cleanupRef.current = onUp;
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [pos]
  );

  const onResizeStart = useCallback(
    (e, dir) => {
      if (!pos || !size) return;
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const origW = size.width;
      const origH = size.height;
      const origX = pos.x;
      const origY = pos.y;

      const onMove = (e) => {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        let w = origW, h = origH, x = origX, y = origY;
        if (dir.includes("e")) w = Math.max(MIN_W, origW + dx);
        if (dir.includes("w")) { w = Math.max(MIN_W, origW - dx); x = origX + origW - w; }
        if (dir.includes("s")) h = Math.max(MIN_H, origH + dy);
        if (dir.includes("n")) { h = Math.max(MIN_H, origH - dy); y = origY + origH - h; }
        setSize({ width: w, height: h });
        setPos({ x, y });
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        cleanupRef.current = null;
      };
      cleanupRef.current = onUp;
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [pos, size]
  );

  if (!pos || !size) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="vmp-panel"
        style={{
          position: "fixed",
          left: pos.x,
          top: pos.y,
          width: size.width,
          height: size.height,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {HANDLES.map((dir) => (
          <div
            key={dir}
            className={`resize-handle resize-${dir}`}
            onMouseDown={(e) => onResizeStart(e, dir)}
          />
        ))}
        <div className="vmp-drag-zone" onMouseDown={onDragStart}>
          <div className="vmp-header">
            <h3>{label} Management</h3>
            <button
              className="picker-modal-close"
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              &times;
            </button>
          </div>
        </div>

        <div className="vmp-body">
          <div className="vmp-current-display">
            <span className="vmp-current-value" style={{ color }}>
              {current}
            </span>
            {!isGold && (
              <>
                <span className="vmp-slash">/</span>
                <span className="vmp-max-value">{max}</span>
              </>
            )}
          </div>

          {!isGold && (
            <div className="vmp-bar">
              <div
                className="vmp-bar-fill"
                style={{
                  width: `${max > 0 ? Math.min(100, (current / max) * 100) : 0}%`,
                  background: color,
                }}
              />
              {changed && (
                <div
                  className="vmp-bar-preview"
                  style={{
                    width: `${max > 0 ? Math.min(100, (previewCurrent / max) * 100) : 0}%`,
                    borderColor: previewCurrent > current ? "#22c55e" : "var(--error-color)",
                  }}
                />
              )}
            </div>
          )}

          <div className="vmp-inputs">
            <div className="vmp-input-group vmp-heal">
              <label>{addLabel}</label>
              <input
                type="number"
                min="0"
                value={healAmount}
                onChange={(e) => setHealAmount(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="0"
              />
            </div>
            <div className="vmp-input-group vmp-damage">
              <label>{subLabel}</label>
              <input
                type="number"
                min="0"
                value={damageAmount}
                onChange={(e) => setDamageAmount(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="0"
              />
            </div>
          </div>

          {changed && (
            <div className="vmp-preview">
              New {label}:{" "}
              <strong style={{ color: previewCurrent > current ? "#22c55e" : "var(--error-color)" }}>
                {previewCurrent}
              </strong>
              {!isGold && <> / {max}</>}
            </div>
          )}

          <button
            className="btn-primary vmp-apply-btn"
            onClick={handleApply}
            disabled={!changed}
          >
            Apply
          </button>

          {!isGold && (
            <div className="vmp-max-section">
              <span className="vmp-max-label">Max {label}</span>
              <div className="vmp-max-controls">
                <button className="vital-btn" onClick={() => onChangeMax(-1)}>−</button>
                <span className="vmp-max-val">{max}</span>
                <button className="vital-btn" onClick={() => onChangeMax(1)}>+</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
