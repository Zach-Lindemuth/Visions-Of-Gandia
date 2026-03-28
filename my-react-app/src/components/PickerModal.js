import { useState, useRef, useEffect, useCallback } from "react";
import PaginatedPickerList from "../views/wizard/PaginatedPickerList";

const MIN_W = 360;
const MIN_H = 280;
const HANDLES = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

export default function PickerModal({
  title,
  items,
  loading,
  getId,
  renderCardContent,
  onSelect,
  onClose,
}) {
  const [pos, setPos] = useState(null);
  const [size, setSize] = useState(null);
  const dragRef = useRef(null);
  const resizeRef = useRef(null);

  useEffect(() => {
    const w = Math.min(900, window.innerWidth * 0.92);
    const h = Math.min(700, window.innerHeight * 0.88);
    setSize({ width: w, height: h });
    setPos({ x: (window.innerWidth - w) / 2, y: (window.innerHeight - h) / 2 });
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
      };
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
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [pos, size]
  );

  if (!pos || !size) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="picker-modal"
        style={{
          position: "fixed",
          left: pos.x,
          top: pos.y,
          width: size.width,
          height: size.height,
          maxWidth: "none",
          maxHeight: "none",
          margin: 0,
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
        <div className="picker-modal-drag-zone" onMouseDown={onDragStart}>
          <div className="picker-modal-header">
            <h2>{title}</h2>
            <button
              className="picker-modal-close"
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              &times;
            </button>
          </div>
        </div>
        <PaginatedPickerList
          items={items}
          loading={loading}
          emptyMessage="Nothing available to add."
          noResultsMessage="No results found."
          disabled={false}
          getId={getId}
          onSelect={onSelect}
          renderCardContent={renderCardContent}
        />
      </div>
    </div>
  );
}
