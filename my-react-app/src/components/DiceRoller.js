import { useState, useRef } from "react";

const DICE = [4, 6, 8, 10, 12, 20, 100];
const MAX = 10;

const CFG = {
  4:   { label: "d4",  ms: 1400, tick: 40 },
  6:   { label: "d6",  ms: 1600, tick: 46 },
  8:   { label: "d8",  ms: 1700, tick: 52 },
  10:  { label: "d10", ms: 1800, tick: 56 },
  12:  { label: "d12", ms: 2000, tick: 62 },
  20:  { label: "d20", ms: 2400, tick: 68 },
  100: { label: "d%",  ms: 1900, tick: 34 },
};

function DieShape({ sides }) {
  switch (sides) {
    case 4:   return <polygon points="50,8 94,88 6,88" />;
    case 6:   return <rect x="10" y="10" width="80" height="80" rx="6" />;
    case 8:   return <polygon points="50,7 93,50 50,93 7,50" />;
    case 10:  return <polygon points="50,7 89,38 78,90 22,90 11,38" />;
    case 12:  return <polygon points="50,5 86,19 96,57 74,93 26,93 4,57 14,19" />;
    case 20:  return <polygon points="50,5 92,27 92,73 50,95 8,73 8,27" />;
    case 100: return <circle cx="50" cy="50" r="42" />;
    default:  return <circle cx="50" cy="50" r="42" />;
  }
}

let uid = 0;
const rnd = (n) => Math.floor(Math.random() * n) + 1;

export default function DiceRoller() {
  const [open, setOpen] = useState(false);
  const [dice, setDice] = useState([]);
  const [rolling, setRolling] = useState(false);
  const timers = useRef([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const addDie = (sides) => {
    if (dice.length >= MAX || rolling) return;
    setDice((d) => [...d, { id: uid++, sides, display: 1, rolling: false, selected: false }]);
  };

  const runAnim = (targets) => {
    setRolling(true);
    const finals = targets.map((d) => ({ ...d, value: rnd(d.sides) }));
    let done = 0;

    finals.forEach((die) => {
      const { ms, tick } = CFG[die.sides] || { ms: 1000, tick: 50 };
      const end = Date.now() + ms;

      const step = () => {
        if (Date.now() >= end) {
          setDice((p) =>
            p.map((r) => r.id === die.id ? { ...r, display: die.value, rolling: false } : r)
          );
          if (++done === finals.length) setRolling(false);
          return;
        }
        setDice((p) =>
          p.map((r) => r.id === die.id ? { ...r, display: rnd(die.sides) } : r)
        );
        const t = setTimeout(step, tick);
        timers.current.push(t);
      };
      step();
    });
  };

  const handleRoll = () => {
    if (!dice.length || rolling) return;
    setDice((p) => p.map((r) => ({ ...r, rolling: true, selected: false })));
    runAnim(dice);
  };

  const handleReroll = () => {
    if (rolling) return;
    const sel = dice.filter((r) => r.selected);
    if (!sel.length) return;
    setDice((p) => p.map((r) => r.selected ? { ...r, rolling: true, selected: false } : r));
    runAnim(sel);
  };

  const toggleSelect = (id) => {
    if (rolling) return;
    setDice((p) => p.map((r) => r.id === id ? { ...r, selected: !r.selected } : r));
  };

  const handleClear = () => {
    clearTimers();
    setDice([]);
    setRolling(false);
  };

  // Group by sides, ordered ascending
  const groups = DICE
    .map((sides) => ({ sides, items: dice.filter((d) => d.sides === sides) }))
    .filter((g) => g.items.length > 0);

  const allLanded = dice.length > 0 && !dice.some((r) => r.rolling);
  const total = allLanded ? dice.reduce((s, r) => s + r.display, 0) : null;
  const selCount = dice.filter((r) => r.selected).length;

  return (
    <div className="dice-tray">
      <button
        className="dice-toggle-btn"
        onClick={() => setOpen((o) => !o)}
        title="Dice Roller"
      >
        🎲
      </button>

      {open && (
        <div className="dice-panel">
          <div className="dice-panel-header">
            <span className="dice-panel-title">Dice Roller</span>
            <span className="dice-count-badge">{dice.length} / {MAX}</span>
          </div>

          {/* Die type picker */}
          <div className="dice-picker">
            {DICE.map((s) => (
              <button
                key={s}
                className="die-btn"
                onClick={() => addDie(s)}
                disabled={dice.length >= MAX || rolling}
                title={`Add ${CFG[s].label}`}
              >
                <svg className="die-btn-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                  <DieShape sides={s} />
                </svg>
                <span className="die-btn-label">{CFG[s].label}</span>
              </button>
            ))}
          </div>

          {/* Tray — rows grouped by die type, lowest faces on top */}
          {dice.length > 0 && (
            <div className="dice-tray-groups">
              {groups.map((g) => (
                <div key={g.sides} className="dice-tray-row">
                  <span className="dice-row-label">{CFG[g.sides].label}</span>
                  <div className="dice-row-dice">
                    {g.items.map((r) => (
                      <button
                        key={r.id}
                        className={`die-result die-result-d${r.sides}${r.rolling ? " die-anim" : ""}${r.selected ? " die-selected" : ""}`}
                        onClick={() => toggleSelect(r.id)}
                        disabled={r.rolling}
                        title={r.rolling ? "" : r.selected ? "Deselect" : "Select to reroll"}
                      >
                        <svg
                          className="die-shape-svg"
                          viewBox="0 0 100 100"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <DieShape sides={r.sides} />
                        </svg>
                        <span className="die-val">{r.display}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {total !== null && (
                <div className="dice-total">= <strong>{total}</strong></div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="dice-actions">
            <button className="btn-secondary dice-clear" onClick={handleClear}>
              Clear
            </button>
            {selCount > 0 && (
              <button className="dice-reroll" onClick={handleReroll} disabled={rolling}>
                Reroll {selCount}
              </button>
            )}
            <button
              className="dice-roll"
              onClick={handleRoll}
              disabled={!dice.length || rolling}
            >
              Roll{dice.length ? ` ${dice.length}` : ""}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
