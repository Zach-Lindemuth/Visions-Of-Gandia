import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { getCharacterById, getCharacterEquipment, getCharacterInventory } from "../api/characterApi";

export default function CharacterSheet() {
  const { id } = useParams();
  const { auth } = useAuth();
  const [character, setCharacter] = useState(null);
  const [equipment, setEquipment] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      getCharacterById(auth.token, id),
      getCharacterEquipment(auth.token, id).catch(() => null),
      getCharacterInventory(auth.token, id).catch(() => null),
    ])
      .then(([char, eq, inv]) => {
        setCharacter(char);
        setEquipment(eq);
        setInventory(inv);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [auth.token, id]);

  if (loading) return <div className="sheet-loading muted">Loading character...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!character) return <div className="error">Character not found.</div>;

  const lifeMax = character.healthMax ?? 0;
  const life = character.healthCurrent ?? 0;
  const energyMax = character.energyMax ?? 0;
  const energy = character.energyCurrent ?? 0;

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
      <div className="sheet-vitals">
        <Vital label="Life" current={life} max={lifeMax} color="var(--vital-life)" />
        <Vital label="Energy" current={energy} max={energyMax} color="var(--vital-energy)" />
        <div className="vital-extra">
          <span className="muted">Items</span>
          <strong>{character.itemPointsCurrent ?? 3} / {character.itemPointsMax ?? 3}</strong>
        </div>
        <div className="vital-extra">
          <span className="muted">Gold</span>
          <strong>{character.gold ?? 0}</strong>
        </div>
      </div>

      {/* ── Attributes ─────────────────────────── */}
      <div className="sheet-section">
        <div className="sheet-attrs">
          <div className="attr-col">
            <p className="attr-col-head muted">Life Attributes</p>
            <AttrRow label="Might" value={character.might} />
            <AttrRow label="Precision" value={character.precision} />
            <AttrRow label="Mind" value={character.mind} />
          </div>
          <div className="attr-col">
            <p className="attr-col-head muted">Energy Attributes</p>
            <AttrRow label="Endurance" value={character.endurance} />
            <AttrRow label="Agility" value={character.agility} />
            <AttrRow label="Willpower" value={character.willpower} />
          </div>
        </div>
      </div>

      {/* ── Origin & Vision ────────────────────── */}
      {(character.origin || character.vision) && (
        <div className="sheet-section sheet-row">
          {character.origin && (
            <SheetCard heading="Origin" title={character.origin.name} body={character.origin.description} />
          )}
          {character.vision && (
            <SheetCard heading="Vision" title={character.vision.name} body={character.vision.description} />
          )}
        </div>
      )}

      {/* ── Talents ────────────────────────────── */}
      {character.talents?.length > 0 && (
        <div className="sheet-section">
          <h3 className="section-heading">Talents</h3>
          <div className="sheet-cards">
            {character.talents.map((t, i) => (
              <SheetCard key={t.talentId ?? i} title={t.name} body={t.description} />
            ))}
          </div>
        </div>
      )}

      {/* ── Arcana ─────────────────────────────── */}
      {character.arcanas?.length > 0 && (
        <div className="sheet-section">
          <h3 className="section-heading">Arcana</h3>
          <div className="sheet-cards">
            {character.arcanas.map((a, i) => (
              <SheetCard
                key={a.arcanaId ?? i}
                title={a.name}
                body={a.description}
                sub={a.upcast ? `Upcast: ${a.upcast}` : null}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Techniques ─────────────────────────── */}
      {character.techniques?.length > 0 && (
        <div className="sheet-section">
          <h3 className="section-heading">Techniques</h3>
          <div className="sheet-cards">
            {character.techniques.map((t, i) => (
              <SheetCard
                key={t.techniqueId ?? i}
                title={t.name}
                body={t.description}
                sub={t.combo ? `Combo: ${t.combo}` : null}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Equipment ──────────────────────────── */}
      {equipment && (
        <div className="sheet-section">
          <h3 className="section-heading">Equipment</h3>
          <div className="sheet-row">
            <EquipSlot label="Main Hand" item={equipment.mainHand} itemType="weapon" />
            <EquipSlot label="Off Hand" item={equipment.offHand ?? equipment.offHandShield} itemType="weapon" />
            <EquipSlot label="Armor" item={equipment.armor} itemType="armor" />
          </div>
        </div>
      )}

      {/* ── Inventory ──────────────────────────── */}
      {inventory && (
        <div className="sheet-section">
          <h3 className="section-heading">Inventory</h3>
          <div className="inventory-grid">
            {inventory.slots.map((slot) => (
              <div key={slot.slotIndex} className="inv-slot">
                <span className="inv-num">{slot.slotIndex}</span>
                <span className="inv-content">
                  {slot.genericItemDescription
                    || slot.weapon?.name
                    || slot.armor?.name
                    || slot.shield?.name
                    || <span className="muted">—</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="sheet-footer">
        <Link to="/">← Back to Characters</Link>
      </div>
    </div>
  );
}

function Vital({ label, current, max, color }) {
  const pct = max > 0 ? Math.min(100, (current / max) * 100) : 0;
  return (
    <div className="vital">
      <div className="vital-header">
        <span className="vital-label">{label}</span>
        <span className="vital-value">{current} / {max}</span>
      </div>
      <div className="vital-track">
        <div className="vital-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function AttrRow({ label, value }) {
  return (
    <div className="attr-row-sheet">
      <span className="attr-sheet-label">{label}</span>
      <span className="attr-sheet-val">{value ?? 0}</span>
    </div>
  );
}

function SheetCard({ heading, title, body, sub }) {
  return (
    <div className="sheet-card">
      {heading && <p className="card-heading muted">{heading}</p>}
      {title && <p className="card-title">{title}</p>}
      {body && <p className="card-body">{body}</p>}
      {sub && <p className="card-sub"><em>{sub}</em></p>}
    </div>
  );
}

function EquipSlot({ label, item, itemType }) {
  return (
    <div className="equip-slot-sheet">
      <p className="equip-slot-label muted">{label}</p>
      {item ? (
        <>
          <p className="equip-slot-name">{item.name}</p>
          {itemType === "weapon" && item.weaponType && (
            <p className="muted">{item.weaponType.name}</p>
          )}
          {itemType === "armor" && item.armorType && (
            <p className="muted">{item.armorType.name}</p>
          )}
        </>
      ) : (
        <p className="muted">—</p>
      )}
    </div>
  );
}
