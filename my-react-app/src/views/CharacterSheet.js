import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import PickerModal from "../components/PickerModal";
import VitalManagementPanel from "../components/VitalManagementPanel";
import {
  getCharacterById,
  getCharacterEquipment,
  getCharacterInventory,
  getTalents,
  getArcana,
  getTechniques,
  addTalentToCharacter,
  addArcanaToCharacter,
  addTechniqueToCharacter,
  removeTalentFromCharacter,
  removeArcanaFromCharacter,
  removeTechniqueFromCharacter,
  updateCharacter,
  updateInventorySlot,
  clearInventorySlot,
} from "../api/characterApi";

const ATTR_PAIRS = [
  ["might", "endurance"],
  ["precision", "agility"],
  ["mind", "willpower"],
];

const LABELS = {
  might: "Might",
  precision: "Precision",
  mind: "Mind",
  endurance: "Endurance",
  agility: "Agility",
  willpower: "Willpower",
};

export default function CharacterSheet() {
  const { id } = useParams();
  const { auth } = useAuth();
  const [character, setCharacter] = useState(null);
  const [equipment, setEquipment] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [refData, setRefData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pickerModal, setPickerModal] = useState(null);
  const [vitalPanel, setVitalPanel] = useState(null); // 'life' | 'energy' | 'items' | 'gold' | null
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      getCharacterById(auth.token, id),
      getCharacterEquipment(auth.token, id).catch(() => null),
      getCharacterInventory(auth.token, id).catch(() => null),
      getTalents(auth.token).catch(() => []),
      getArcana(auth.token).catch(() => []),
      getTechniques(auth.token).catch(() => []),
    ])
      .then(([char, eq, inv, talents, arcana, techniques]) => {
        setCharacter(char);
        setEquipment(eq);
        setInventory(inv);
        setRefData({ talents, arcana, techniques });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [auth.token, id]);

  // ── Add / Remove handlers ──────────────────────────────

  const handleAdd = async (type, itemId) => {
    setBusy(true);
    try {
      if (type === "talent") {
        await addTalentToCharacter(auth.token, id, itemId);
        const item = refData.talents.find((t) => t.talentId === itemId);
        setCharacter((prev) => ({ ...prev, talents: [...(prev.talents || []), item] }));
      } else if (type === "arcana") {
        await addArcanaToCharacter(auth.token, id, itemId);
        const item = refData.arcana.find((a) => a.arcanaId === itemId);
        setCharacter((prev) => ({ ...prev, arcanas: [...(prev.arcanas || []), item] }));
      } else if (type === "technique") {
        await addTechniqueToCharacter(auth.token, id, itemId);
        const item = refData.techniques.find((t) => t.techniqueId === itemId);
        setCharacter((prev) => ({ ...prev, techniques: [...(prev.techniques || []), item] }));
      }
      setPickerModal(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (type, itemId) => {
    setBusy(true);
    try {
      if (type === "talent") {
        await removeTalentFromCharacter(auth.token, id, itemId);
        setCharacter((prev) => ({ ...prev, talents: prev.talents.filter((t) => t.talentId !== itemId) }));
      } else if (type === "arcana") {
        await removeArcanaFromCharacter(auth.token, id, itemId);
        setCharacter((prev) => ({ ...prev, arcanas: prev.arcanas.filter((a) => a.arcanaId !== itemId) }));
      } else if (type === "technique") {
        await removeTechniqueFromCharacter(auth.token, id, itemId);
        setCharacter((prev) => ({ ...prev, techniques: prev.techniques.filter((t) => t.techniqueId !== itemId) }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // ── Inventory handlers ─────────────────────────────────

  const handleInventoryUpdate = async (slotIndex, description) => {
    try {
      await updateInventorySlot(auth.token, id, slotIndex, { genericItemDescription: description });
      setInventory((prev) => ({
        ...prev,
        slots: prev.slots.map((s) =>
          s.slotIndex === slotIndex ? { ...s, genericItemDescription: description } : s
        ),
      }));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleInventoryClear = async (slotIndex) => {
    try {
      await clearInventorySlot(auth.token, id, slotIndex);
      setInventory((prev) => ({
        ...prev,
        slots: prev.slots.map((s) =>
          s.slotIndex === slotIndex
            ? { ...s, genericItemDescription: null, weapon: null, armor: null, shield: null }
            : s
        ),
      }));
    } catch (err) {
      setError(err.message);
    }
  };

  // ── Stat update handler ─────────────────────────────────

  const updateStat = async (field, delta) => {
    const current = character[field] ?? 0;
    const newVal = Math.max(0, current + delta);
    if (newVal === current) return;

    // When changing max health/energy, also adjust current by the same amount
    const patch = { [field]: newVal };
    const localPatch = { [field]: newVal };
    if (field === "healthMax") {
      const curHp = character.healthCurrent ?? 0;
      const newHp = Math.max(0, curHp + delta);
      patch.healthCurrent = newHp;
      localPatch.healthCurrent = newHp;
    } else if (field === "energyMax") {
      const curEn = character.energyCurrent ?? 0;
      const newEn = Math.max(0, curEn + delta);
      patch.energyCurrent = newEn;
      localPatch.energyCurrent = newEn;
    } else if (field === "itemPointsMax") {
      const curIp = character.itemPointsCurrent ?? 0;
      const newIp = Math.max(0, curIp + delta);
      patch.itemPointsCurrent = newIp;
      localPatch.itemPointsCurrent = newIp;
    }

    setCharacter((prev) => ({ ...prev, ...localPatch }));
    try {
      await updateCharacter(auth.token, id, patch);
    } catch (err) {
      setCharacter((prev) => ({ ...prev, [field]: current }));
      setError(err.message);
    }
  };

  const updateStats = async (patch) => {
    const rollback = {};
    for (const key of Object.keys(patch)) rollback[key] = character[key];
    setCharacter((prev) => ({ ...prev, ...patch }));
    try {
      await updateCharacter(auth.token, id, patch);
    } catch (err) {
      setCharacter((prev) => ({ ...prev, ...rollback }));
      setError(err.message);
    }
  };

  const handleReset = async () => {
    const hMax = character.healthMax ?? 0;
    const eMax = character.energyMax ?? 0;
    const iMax = character.itemPointsMax ?? 3;
    await updateStats({
      healthCurrent: hMax,
      energyCurrent: eMax,
      itemPointsCurrent: iMax,
    });
  };

  // ── Picker modal helpers ───────────────────────────────

  const getPickerProps = () => {
    if (!pickerModal || !refData) return null;

    const ownedTalentIds = new Set((character.talents || []).map((t) => t.talentId));
    const ownedArcanaIds = new Set((character.arcanas || []).map((a) => a.arcanaId));
    const ownedTechniqueIds = new Set((character.techniques || []).map((t) => t.techniqueId));

    if (pickerModal === "talent") {
      return {
        title: "Add Talent",
        items: refData.talents.filter((t) => !ownedTalentIds.has(t.talentId)),
        getId: (t) => t.talentId,
        onSelect: (id) => handleAdd("talent", id),
        renderCardContent: (t) => (
          <>
            <strong>{t.name}</strong>
            {t.description && <p>{t.description}</p>}
          </>
        ),
      };
    }
    if (pickerModal === "arcana") {
      return {
        title: "Add Arcana",
        items: refData.arcana.filter((a) => !ownedArcanaIds.has(a.arcanaId)),
        getId: (a) => a.arcanaId,
        onSelect: (id) => handleAdd("arcana", id),
        renderCardContent: (a) => (
          <>
            <strong>{a.name}</strong>
            {a.description && <p>{a.description}</p>}
            {a.upcast && (
              <div className="card-sub-section">
                <span className="card-sub-label">Upcast:</span>
                <span className="card-sub-text">{a.upcast}</span>
              </div>
            )}
          </>
        ),
      };
    }
    if (pickerModal === "technique") {
      return {
        title: "Add Technique",
        items: refData.techniques.filter((t) => !ownedTechniqueIds.has(t.techniqueId)),
        getId: (t) => t.techniqueId,
        onSelect: (id) => handleAdd("technique", id),
        renderCardContent: (t) => (
          <>
            <strong>{t.name}</strong>
            {t.description && <p>{t.description}</p>}
            {t.combo && (
              <div className="card-sub-section">
                <span className="card-sub-label">Combo:</span>
                <span className="card-sub-text">{t.combo}</span>
              </div>
            )}
          </>
        ),
      };
    }
    return null;
  };

  // ── Render ─────────────────────────────────────────────

  if (loading) return <div className="sheet-loading muted">Loading character...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!character) return <div className="error">Character not found.</div>;

  const lifeMax = character.healthMax ?? 0;
  const life = character.healthCurrent ?? 0;
  const energyMax = character.energyMax ?? 0;
  const energy = character.energyCurrent ?? 0;
  const pickerProps = getPickerProps();

  return (
    <div className="sheet">
      {/* ── Header ─────────────────────────────── */}
      <div className="sheet-header">
        <div className="sheet-identity">
          <h1 className="sheet-name">{character.name}</h1>
          <p className="sheet-title">{character.nickname}</p>
          <p className="sheet-meta muted">Level 1 · {character.experience ?? 0} XP</p>
        </div>
        {character.imageUrl && (
          <img src={character.imageUrl} alt={character.name} className="sheet-avatar" />
        )}
      </div>

      {/* ── Vitals ─────────────────────────────── */}
      <div className="sheet-vitals-panel">
        <div className="vitals-row">
          <Vital
            label="Life"
            current={character.healthCurrent ?? 0}
            max={character.healthMax ?? 0}
            color="var(--vital-life)"
            onChangeCurrent={(d) => updateStat("healthCurrent", d)}
            onOpenPanel={() => setVitalPanel("life")}
          />
          <Vital
            label="Energy"
            current={character.energyCurrent ?? 0}
            max={character.energyMax ?? 0}
            color="var(--vital-energy)"
            onChangeCurrent={(d) => updateStat("energyCurrent", d)}
            onOpenPanel={() => setVitalPanel("energy")}
          />
          <VitalSimple
            label="Items"
            display={`${character.itemPointsCurrent ?? 3} / ${character.itemPointsMax ?? 3}`}
            onOpenPanel={() => setVitalPanel("items")}
            onDec={() => updateStat("itemPointsCurrent", -1)}
            onInc={() => updateStat("itemPointsCurrent", 1)}
          />
          <VitalSimple
            label="Gold"
            display={character.gold ?? 0}
            onOpenPanel={() => setVitalPanel("gold")}
            onDec={() => updateStat("gold", -1)}
            onInc={() => updateStat("gold", 1)}
          />
        </div>
        <button className="btn-secondary vitals-reset-btn" onClick={handleReset}>
          Reset
        </button>
      </div>

      {/* ── Attributes (review-panel style with +/−) ── */}
      <div className="review-panel review-panel-attrs">
        <h3>Attributes</h3>
        <div className="attr-allocator-columns" style={{ marginBottom: 0 }}>
          {ATTR_PAIRS.map(([left, right]) => (
            <div key={`${left}-${right}`} className="review-attr-pair">
              <div className="attr-alloc-row review-attr-row">
                <span className="attr-alloc-label">{LABELS[left]}</span>
                <div className="attr-alloc-controls">
                  <button className="attr-btn" onClick={() => updateStat(left, -1)}>−</button>
                  <span className="attr-alloc-value">{character[left] ?? 0}</span>
                  <button className="attr-btn" onClick={() => updateStat(left, 1)}>+</button>
                </div>
              </div>
              <div className="attr-alloc-row review-attr-row">
                <span className="attr-alloc-label">{LABELS[right]}</span>
                <div className="attr-alloc-controls">
                  <button className="attr-btn" onClick={() => updateStat(right, -1)}>−</button>
                  <span className="attr-alloc-value">{character[right] ?? 0}</span>
                  <button className="attr-btn" onClick={() => updateStat(right, 1)}>+</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Origin & Vision ────────────────────── */}
      {(character.origin || character.vision) && (
        <div className="sheet-section-row">
          {character.origin && (
            <div className="review-panel">
              <h3>Origin</h3>
              <p className="card-title">{character.origin.name}</p>
              {character.origin.description && (
                <p className="card-body">{character.origin.description}</p>
              )}
            </div>
          )}
          {character.vision && (
            <div className="review-panel">
              <h3>Vision</h3>
              <p className="card-title">{character.vision.name}</p>
              {character.vision.description && (
                <p className="card-body">{character.vision.description}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Talents ────────────────────────────── */}
      <div className="review-panel">
        <h3>Talents</h3>
        <div className="sheet-cards">
          {(character.talents || []).map((t) => (
            <RemovableCard
              key={t.talentId}
              title={t.name}
              body={t.description}
              onRemove={() => handleRemove("talent", t.talentId)}
              disabled={busy}
            />
          ))}
          <AddSlot label="Add Talent" onClick={() => setPickerModal("talent")} disabled={busy} />
        </div>
      </div>

      {/* ── Arcana ─────────────────────────────── */}
      <div className="review-panel">
        <h3>Arcana</h3>
        <div className="sheet-cards">
          {(character.arcanas || []).map((a) => (
            <RemovableCard
              key={a.arcanaId}
              title={a.name}
              body={a.description}
              sub={a.upcast ? `Upcast: ${a.upcast}` : null}
              onRemove={() => handleRemove("arcana", a.arcanaId)}
              disabled={busy}
            />
          ))}
          <AddSlot label="Add Arcana" onClick={() => setPickerModal("arcana")} disabled={busy} />
        </div>
      </div>

      {/* ── Techniques ─────────────────────────── */}
      <div className="review-panel">
        <h3>Techniques</h3>
        <div className="sheet-cards">
          {(character.techniques || []).map((t) => (
            <RemovableCard
              key={t.techniqueId}
              title={t.name}
              body={t.description}
              sub={t.combo ? `Combo: ${t.combo}` : null}
              onRemove={() => handleRemove("technique", t.techniqueId)}
              disabled={busy}
            />
          ))}
          <AddSlot label="Add Technique" onClick={() => setPickerModal("technique")} disabled={busy} />
        </div>
      </div>

      {/* ── Equipment ──────────────────────────── */}
      <div className="review-equipment-boxes">
        <div className="review-panel">
          <h3>Main Hand</h3>
          {equipment?.mainHand ? (
            <div className="review-equip-item">
              <strong>{equipment.mainHand.name}</strong>
              {equipment.mainHand.weaponType && (
                <span className="muted">{equipment.mainHand.weaponType.name}</span>
              )}
            </div>
          ) : (
            <p className="muted">—</p>
          )}
        </div>
        <div className="review-panel">
          <h3>Armor</h3>
          {equipment?.armor ? (
            <div className="review-equip-item">
              <strong>{equipment.armor.name}</strong>
              {equipment.armor.armorType && (
                <span className="muted">{equipment.armor.armorType.name}</span>
              )}
            </div>
          ) : (
            <p className="muted">—</p>
          )}
        </div>
      </div>

      {/* ── Inventory ──────────────────────────── */}
      {inventory && (
        <div className="review-panel">
          <h3>Inventory</h3>
          <div className="inventory-grid">
            {inventory.slots.map((slot) => (
              <InventorySlot
                key={slot.slotIndex}
                slot={slot}
                onUpdate={(desc) => handleInventoryUpdate(slot.slotIndex, desc)}
                onClear={() => handleInventoryClear(slot.slotIndex)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="sheet-footer">
        <Link to="/">← Back to Characters</Link>
      </div>

      {pickerProps && (
        <PickerModal {...pickerProps} loading={busy} onClose={() => setPickerModal(null)} />
      )}

      {vitalPanel && (
        <VitalManagementPanel
          type={vitalPanel}
          current={
            vitalPanel === "life" ? character.healthCurrent ?? 0
            : vitalPanel === "energy" ? character.energyCurrent ?? 0
            : vitalPanel === "items" ? character.itemPointsCurrent ?? 3
            : character.gold ?? 0
          }
          max={
            vitalPanel === "life" ? character.healthMax ?? 0
            : vitalPanel === "energy" ? character.energyMax ?? 0
            : character.itemPointsMax ?? 3
          }
          onApply={(delta) => {
            const field =
              vitalPanel === "life" ? "healthCurrent"
              : vitalPanel === "energy" ? "energyCurrent"
              : vitalPanel === "items" ? "itemPointsCurrent"
              : "gold";
            updateStat(field, delta);
          }}
          onChangeMax={(delta) => {
            const field =
              vitalPanel === "life" ? "healthMax"
              : vitalPanel === "energy" ? "energyMax"
              : "itemPointsMax";
            updateStat(field, delta);
          }}
          onClose={() => setVitalPanel(null)}
        />
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────

function Vital({ label, current, max, color, onChangeCurrent, onOpenPanel }) {
  const pct = max > 0 ? Math.min(100, (current / max) * 100) : 0;
  return (
    <div className="vital">
      <div className="vital-row">
        <span className="vital-label">{label}</span>
        <span className="vital-value vital-value-clickable" onClick={onOpenPanel} title={`Manage ${label}`}>
          {current} / {max}
        </span>
      </div>
      <div className="vital-track" onClick={onOpenPanel} style={{ cursor: "pointer" }}>
        <div className="vital-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="vital-controls-below">
        <button className="vital-btn" onClick={() => onChangeCurrent(-1)}>−</button>
        <button className="vital-btn" onClick={() => onChangeCurrent(1)}>+</button>
      </div>
    </div>
  );
}

function VitalSimple({ label, display, onOpenPanel, onDec, onInc }) {
  return (
    <div className="vital vital-simple">
      <div className="vital-row">
        <span className="vital-label">{label}</span>
        <span className="vital-value vital-value-clickable" onClick={onOpenPanel} title={`Manage ${label}`}>
          {display}
        </span>
      </div>
      <div className="vital-controls-below">
        <button className="vital-btn" onClick={onDec}>−</button>
        <button className="vital-btn" onClick={onInc}>+</button>
      </div>
    </div>
  );
}

function RemovableCard({ title, body, sub, onRemove, disabled }) {
  return (
    <div className="picker-card selected review-card">
      <div className="talent-selected-header">
        <strong>{title}</strong>
        <button
          className="slot-remove"
          onClick={onRemove}
          disabled={disabled}
          title="Remove"
        >
          &times;
        </button>
      </div>
      {body && <p>{body}</p>}
      {sub && (
        <p className="card-sub"><em>{sub}</em></p>
      )}
    </div>
  );
}

function AddSlot({ label, onClick, disabled }) {
  return (
    <button className="sheet-add-slot" onClick={onClick} disabled={disabled}>
      <span className="add-slot-icon">+</span>
      <span className="add-slot-label">{label}</span>
    </button>
  );
}

function InventorySlot({ slot, onUpdate, onClear }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  const content =
    slot.weapon?.name ||
    slot.armor?.name ||
    slot.shield?.name ||
    slot.genericItemDescription ||
    null;

  const isEquipment = !!(slot.weapon || slot.armor || slot.shield);

  const startEdit = () => {
    if (isEquipment) return;
    setValue(slot.genericItemDescription || "");
    setEditing(true);
  };

  const save = () => {
    setEditing(false);
    const trimmed = value.trim();
    if (trimmed) {
      onUpdate(trimmed);
    } else if (slot.genericItemDescription) {
      onClear();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") save();
    if (e.key === "Escape") setEditing(false);
  };

  return (
    <div className="inv-slot" onClick={!editing && !content ? startEdit : undefined}>
      <span className="inv-num">{slot.slotIndex}</span>
      {editing ? (
        <input
          className="inv-edit-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={handleKeyDown}
          autoFocus
          placeholder="Describe item..."
        />
      ) : (
        <span
          className={`inv-content${!content ? " inv-empty" : ""}`}
          onClick={content && !isEquipment ? startEdit : undefined}
        >
          {content || "—"}
        </span>
      )}
      {content && !editing && (
        <button className="inv-clear-btn" onClick={onClear} title="Clear slot">
          &times;
        </button>
      )}
    </div>
  );
}
