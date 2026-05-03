import { useState, useRef, useEffect, useCallback } from "react";

const MIN_W = 300;
const MIN_H = 260;
const HANDLES = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

export default function VitalManagementPanel({
  type,
  current,
  max,
  onApply,
  onClose,
  variant = "striped",
}) {
  const isGold = type === "gold";
  const label = type === "life" ? "Health" : type === "energy" ? "Energy" : type === "gold" ? "Gold" : "Items";
  const color =
    type === "life" ? "var(--vital-life)" : type === "energy" ? "var(--vital-energy)" : "var(--primary-color)";
  const addLabel = type === "life" ? "Healing" : type === "energy" ? "Recover" : "Add";
  const subLabel = type === "life" ? "Damage" : type === "energy" ? "Spend" : "Remove";

  // ── Variant 1 (Striped) state: dual heal/damage inputs ──
  const [healAmount, setHealAmount] = useState("");
  const [damageAmount, setDamageAmount] = useState("");

  // ── Variants 2/3/4 state: single target value ──
  const [target, setTarget] = useState(current);
  useEffect(() => { setTarget(current); }, [current, variant]);

  // ── Pending max delta (batched until Apply) ──
  const [maxDelta, setMaxDelta] = useState(0);
  useEffect(() => { setMaxDelta(0); }, [type]);
  const previewMax = Math.max(0, max + maxDelta);

  const clamp = (v) => (isGold ? Math.max(0, v) : Math.max(0, Math.min(max, v)));

  // Preview-aware clamp uses the pending max so reductions are reflected live
  const previewClamp = (v) => (isGold ? Math.max(0, v) : Math.max(0, Math.min(previewMax, v)));

  // User's intended change to current via the input UI
  let inputDelta;
  if (variant === "striped" || variant === "vial" || variant === "pips") {
    const healVal = parseInt(healAmount, 10) || 0;
    const dmgVal = parseInt(damageAmount, 10) || 0;
    inputDelta = healVal - dmgVal;
  } else {
    inputDelta = target - current;
  }
  // Max changes mirror onto current (leveling fills the gained HP, lowering removes it)
  const previewCurrent = previewClamp(current + inputDelta + maxDelta);
  const currentDelta = previewCurrent - current;
  const changed = currentDelta !== 0 || maxDelta !== 0;

  const handleApply = () => {
    if (!changed) return;
    onApply({ currentDelta, maxDelta });
    setHealAmount("");
    setDamageAmount("");
    setMaxDelta(0);
    setTarget(previewCurrent);
    onClose();
  };

  const bumpMax = (d) => setMaxDelta((prev) => Math.max(-(max), prev + d));

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleApply();
  };

  // ── Drag / Resize ────────
  const [pos, setPos] = useState(null);
  const [size, setSize] = useState(null);
  const cleanupRef = useRef(null);

  useEffect(() => {
    const w = Math.min(480, window.innerWidth * 0.92);
    const h = Math.min(640, window.innerHeight * 0.85);
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

  const sharedProps = {
    type, color, current, max, previewMax, isGold, previewCurrent, delta: currentDelta, changed,
    target, setTarget, healAmount, setHealAmount, damageAmount, setDamageAmount,
    addLabel, subLabel, handleKeyDown,
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`vmp-panel vmp-variant-${variant}`}
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
            <h3>{label} Management <span className="vmp-variant-tag">[{variant}]</span></h3>
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

          {variant === "striped" && <StripedVariant {...sharedProps} />}
          {variant === "pips" && <PipsVariant {...sharedProps} />}
          {variant === "slider" && <SliderVariant {...sharedProps} />}
          {variant === "vial" && <VialVariant {...sharedProps} label={label} />}

          {!isGold && (
            <div className="vmp-max-section">
              <span className="vmp-max-label">Max {label}</span>
              <div className="vmp-max-controls">
                {maxDelta !== 0 && (
                  <span className="vmp-delta-pill" style={{
                    color: maxDelta > 0 ? "#22c55e" : "var(--error-color)",
                    borderColor: maxDelta > 0 ? "#22c55e" : "var(--error-color)",
                  }}>
                    {maxDelta > 0 ? `+${maxDelta}` : maxDelta}
                  </span>
                )}
                <button className="vital-btn" onClick={() => bumpMax(-1)} disabled={previewMax <= 0}>−</button>
                <span
                  className="vmp-max-val"
                  style={maxDelta !== 0 ? { color: maxDelta > 0 ? "#22c55e" : "var(--error-color)" } : undefined}
                >
                  {previewMax}
                </span>
                <button className="vital-btn" onClick={() => bumpMax(1)}>+</button>
              </div>
            </div>
          )}

          <div className="vmp-preview" style={!changed ? { visibility: "hidden" } : undefined}>
            New {label}:{" "}
            <strong style={{ color: currentDelta > 0 ? "#22c55e" : currentDelta < 0 ? "var(--error-color)" : "var(--text-color)" }}>
              {previewCurrent}
            </strong>
            {!isGold && (
              <>
                {" / "}
                <strong style={maxDelta !== 0 ? { color: maxDelta > 0 ? "#22c55e" : "var(--error-color)" } : undefined}>
                  {previewMax}
                </strong>
              </>
            )}
            {currentDelta !== 0 && (
              <span className="vmp-delta-pill" style={{
                color: currentDelta > 0 ? "#22c55e" : "var(--error-color)",
                borderColor: currentDelta > 0 ? "#22c55e" : "var(--error-color)",
              }}>
                {currentDelta > 0 ? `+${currentDelta}` : currentDelta}
              </span>
            )}
          </div>

          <button
            className="btn-primary vmp-apply-btn"
            onClick={handleApply}
            disabled={!changed}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   VARIANT 1 — "Striped"
   Solid horizontal fill + diagonal-stripe delta overlay + bright marker.
   Two number inputs (Heal | Damage).
   ═══════════════════════════════════════════════════════════════════════════ */
function StripedVariant({
  isGold, color, current, previewMax, previewCurrent, changed,
  healAmount, setHealAmount, damageAmount, setDamageAmount,
  addLabel, subLabel, handleKeyDown,
}) {
  const pct = (v) => (previewMax > 0 ? Math.min(100, Math.max(0, (v / previewMax) * 100)) : 0);
  const currentPct = pct(current);
  const previewPct = pct(previewCurrent);
  const isHeal = previewCurrent > current;
  const isDmg = previewCurrent < current;

  return (
    <>
      {!isGold && (
        <div className="vmp-bar">
          <div className="vmp-bar-fill" style={{ width: `${currentPct}%`, background: color }} />
          {isHeal && (
            <div
              className="vmp-bar-delta vmp-bar-delta-add"
              style={{ left: `${currentPct}%`, width: `${previewPct - currentPct}%` }}
            />
          )}
          {isDmg && (
            <div
              className="vmp-bar-delta vmp-bar-delta-sub"
              style={{ left: `${previewPct}%`, width: `${currentPct - previewPct}%` }}
            />
          )}
          {changed && (
            <div className="vmp-bar-marker" style={{ left: `${previewPct}%` }} />
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
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   VARIANT 2 — "Pips"
   Discrete cells, one per HP point. Click a cell to set target directly.
   Lost cells overlay an X, gained cells overlay a +.
   ═══════════════════════════════════════════════════════════════════════════ */
function PipsVariant({
  isGold, color, current, previewMax, previewCurrent,
  healAmount, setHealAmount, damageAmount, setDamageAmount,
  addLabel, subLabel, handleKeyDown,
}) {
  const inputs = (
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
  );

  if (isGold) return inputs;

  const cells = Array.from({ length: previewMax }, (_, i) => i + 1);

  return (
    <>
      <div className="vmp-pips" data-count={previewMax}>
        {cells.map((n) => {
          const inCurrent = n <= current;
          const inPreview = n <= previewCurrent;
          let stateClass = "empty";
          if (inCurrent && inPreview) stateClass = "filled";
          else if (inCurrent && !inPreview) stateClass = "losing";
          else if (!inCurrent && inPreview) stateClass = "gaining";

          return (
            <div
              key={n}
              className={`vmp-pip vmp-pip-${stateClass}`}
              style={inCurrent || inPreview ? { "--pip-color": color } : undefined}
            >
              {stateClass === "losing" && <span className="vmp-pip-glyph">×</span>}
              {stateClass === "gaining" && <span className="vmp-pip-glyph">+</span>}
            </div>
          );
        })}
      </div>
      {inputs}
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   VARIANT 3 — "Slider"
   Direct manipulation: drag a knob along the bar to set the new value.
   Original value notch stays put. Change region is colored.
   ═══════════════════════════════════════════════════════════════════════════ */
function SliderVariant({
  isGold, color, current, max, previewMax, previewCurrent, target, setTarget, addLabel, subLabel,
}) {
  const trackRef = useRef(null);
  const draggingRef = useRef(false);

  const effectiveMax = isGold ? Math.max(50, current + 20) : previewMax;
  const previewVal = previewCurrent;

  const updateFromPointer = (clientX) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const value = Math.round(ratio * effectiveMax);
    setTarget(value);
  };

  const onPointerDown = (e) => {
    e.preventDefault();
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromPointer(e.clientX);
  };
  const onPointerMove = (e) => {
    if (!draggingRef.current) return;
    updateFromPointer(e.clientX);
  };
  const onPointerUp = (e) => {
    draggingRef.current = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
  };

  const pct = (v) => (effectiveMax > 0 ? Math.min(100, Math.max(0, (v / effectiveMax) * 100)) : 0);
  const currentPct = pct(current);
  const previewPct = pct(previewVal);
  const isHeal = previewVal > current;
  const lo = Math.min(currentPct, previewPct);
  const hi = Math.max(currentPct, previewPct);

  return (
    <div className="vmp-slider-wrap">
      <div
        ref={trackRef}
        className="vmp-slider-track"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Base fill = min(current, preview), so the change region is always visible */}
        <div className="vmp-slider-base" style={{ width: `${Math.min(currentPct, previewPct)}%`, background: color }} />
        {/* Change region */}
        {currentPct !== previewPct && (
          <div
            className={`vmp-slider-change ${isHeal ? "vmp-slider-heal" : "vmp-slider-dmg"}`}
            style={{ left: `${lo}%`, width: `${hi - lo}%` }}
          />
        )}
        {/* Original-position notch (where current is) */}
        <div className="vmp-slider-notch" style={{ left: `${currentPct}%` }} title={`Current: ${current}`} />
        {/* Draggable knob (preview value) */}
        <div
          className="vmp-slider-knob"
          style={{ left: `${previewPct}%`, background: color }}
          title={`Target: ${previewVal}`}
        >
          <span className="vmp-slider-knob-label">{previewVal}</span>
        </div>
      </div>

      <div className="vmp-slider-chips">
        <button onClick={() => setTarget(Math.max(0, previewVal - 5))}>−5 {subLabel}</button>
        <button onClick={() => setTarget(Math.max(0, previewVal - 1))}>−1</button>
        <button className="vmp-pip-reset" onClick={() => setTarget(current)}>Reset</button>
        <button onClick={() => setTarget((isGold ? previewVal : Math.min(max, previewVal)) + 1)}>+1</button>
        <button onClick={() => setTarget((isGold ? previewVal : Math.min(max, previewVal)) + 5)}>+5 {addLabel}</button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   VARIANT 4 — "Vial"
   Vertical potion gauge: liquid level = current, dashed line = target,
   animated bubbles when healing / drain effect when damaging.
   Bipolar keypad.
   ═══════════════════════════════════════════════════════════════════════════ */
function VialVariant({
  isGold, color, current, previewMax, previewCurrent,
  healAmount, setHealAmount, damageAmount, setDamageAmount,
  addLabel, subLabel, handleKeyDown,
}) {
  const inputs = (
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
  );

  if (isGold) {
    return <div className="vmp-vial-fallback">{inputs}</div>;
  }

  const currentPct = previewMax > 0 ? (current / previewMax) * 100 : 0;
  const previewPct = previewMax > 0 ? (previewCurrent / previewMax) * 100 : 0;
  const isHeal = previewCurrent > current;
  const isDmg = previewCurrent < current;
  const changed = previewCurrent !== current;

  return (
    <div className="vmp-vial-wrap">
      <div className="vmp-vial">
        <div className="vmp-vial-tube">
          {/* Liquid (current) — bubbles always present */}
          <div
            className={`vmp-vial-liquid ${isDmg ? "vmp-vial-draining" : ""}`}
            style={{ height: `${currentPct}%`, background: `linear-gradient(180deg, ${color}, color-mix(in srgb, ${color} 70%, #000))` }}
          >
            <span className="vmp-vial-bubble vmp-vial-bubble-1" />
            <span className="vmp-vial-bubble vmp-vial-bubble-2" />
            <span className="vmp-vial-bubble vmp-vial-bubble-3" />
          </div>
          {/* Healing ghost extending above current */}
          {isHeal && (
            <div
              className="vmp-vial-ghost vmp-vial-ghost-heal"
              style={{
                bottom: `${currentPct}%`,
                height: `${previewPct - currentPct}%`,
                background: `linear-gradient(180deg, color-mix(in srgb, ${color} 40%, transparent), color-mix(in srgb, ${color} 60%, transparent))`,
              }}
            />
          )}
          {/* Damage shaded zone within current */}
          {isDmg && (
            <div
              className="vmp-vial-ghost vmp-vial-ghost-dmg"
              style={{
                bottom: `${previewPct}%`,
                height: `${currentPct - previewPct}%`,
              }}
            />
          )}
          {/* Target line */}
          {changed && (
            <div className="vmp-vial-target-line" style={{ bottom: `${previewPct}%` }}>
              <span className="vmp-vial-target-label">→ {previewCurrent}</span>
            </div>
          )}
        </div>
        <div className="vmp-vial-base" />
      </div>

      <div className="vmp-vial-controls">{inputs}</div>
    </div>
  );
}
