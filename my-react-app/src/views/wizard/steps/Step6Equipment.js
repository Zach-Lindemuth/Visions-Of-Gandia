import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../../auth/AuthContext";
import { getWeaponTypes, getArmorTypes } from "../../../api/characterApi";

const WEAPON_LIMIT = 2;
const ARMOR_LIMIT = 1;

const WEAPON_PLACEHOLDERS = {
  "One-Handed Melee": [
    "e.g. Rusty Shortsword",
    "e.g. Notched Handaxe",
    "e.g. Iron Mace",
    "e.g. Cracked Longsword",
    "e.g. Dented Warhammer",
    "e.g. Old Gladius",
  ],
  "One-Handed Ranged": [
    "e.g. Worn Hand Crossbow",
    "e.g. Battered Shortbow",
    "e.g. Cracked Bolt-Caster",
    "e.g. Old Hunting Sling",
  ],
  "Two-Handed Melee": [
    "e.g. Battered Greatsword",
    "e.g. Worn Greataxe",
    "e.g. Old Halberd",
    "e.g. Cracked Maul",
    "e.g. Dull War Scythe",
  ],
  "Two-Handed Ranged": [
    "e.g. Old Longbow",
    "e.g. Cracked War Bow",
    "e.g. Battered Hunting Bow",
    "e.g. Worn Crossbow",
  ],
  "One-Handed Focus": [
    "e.g. Cracked Crystal Orb",
    "e.g. Old Carved Wand",
    "e.g. Worn Enchanted Glove",
    "e.g. Tarnished Focus Shard",
  ],
  "Two-Handed Focus": [
    "e.g. Gnarled Wizard's Staff",
    "e.g. Cracked Oak Staff",
    "e.g. Old Runic Staff",
    "e.g. Worn Spellcaster's Rod",
  ],
};

const ARMOR_PLACEHOLDERS = {
  "Light": [
    "e.g. Worn Leather Coat",
    "e.g. Battered Hide Vest",
    "e.g. Old Studded Jerkin",
    "e.g. Cracked Leather Armor",
  ],
  "Medium": [
    "e.g. Rusty Chainmail",
    "e.g. Battered Scale Armor",
    "e.g. Old Ring Hauberk",
    "e.g. Tarnished Brigandine",
  ],
  "Heavy": [
    "e.g. Dented Plate Armor",
    "e.g. Old Knight's Cuirass",
    "e.g. Scratched Full Plate",
    "e.g. Battered Iron Suit",
  ],
  "Robes": [
    "e.g. Frayed Wizard's Robes",
    "e.g. Patched Cloth Vestments",
    "e.g. Old Ceremonial Robes",
    "e.g. Worn Mystic's Garb",
  ],
};

const FALLBACK_WEAPON = ["Old Blade", "Worn Armament", "Battered Steel", "Trusty Old Weapon"];
const FALLBACK_ARMOR  = ["Worn Armor", "Old Protective Gear", "Battered Defense", "Trusty Old Guard"];

function pickPlaceholder(map, fallback, typeName) {
  const list = map[typeName] ?? fallback;
  return list[Math.floor(Math.random() * list.length)];
}

export default function Step6Equipment({ data, update, next, back }) {
  const { auth } = useAuth();
  const [weaponTypes, setWeaponTypes] = useState([]);
  const [armorTypes, setArmorTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shaking, setShaking] = useState(false);
  const [weaponPlaceholders, setWeaponPlaceholders] = useState([]);
  const [armorPlaceholder, setArmorPlaceholder] = useState("");
  const shakeTimer = useRef(null);

  useEffect(() => {
    Promise.all([
      getWeaponTypes(auth.token).catch(() => []),
      getArmorTypes(auth.token).catch(() => []),
    ])
      .then(([w, a]) => {
        setWeaponTypes(Array.isArray(w) ? w : []);
        setArmorTypes(Array.isArray(a) ? a : []);
      })
      .finally(() => setLoading(false));
  }, [auth.token]);

  const addWeapon = (type) => {
    if (data.weapons.length < WEAPON_LIMIT) {
      setWeaponPlaceholders((prev) => [
        ...prev,
        pickPlaceholder(WEAPON_PLACEHOLDERS, FALLBACK_WEAPON, type.name),
      ]);
      update({
        weapons: [...data.weapons, { weaponTypeId: type.weaponTypeId, name: "", description: "" }],
      });
    }
  };

  const removeWeapon = (index) => {
    setWeaponPlaceholders((prev) => prev.filter((_, i) => i !== index));
    update({ weapons: data.weapons.filter((_, i) => i !== index) });
  };

  const updateWeaponName = (index, name) => {
    const updated = data.weapons.map((w, i) => (i === index ? { ...w, name } : w));
    update({ weapons: updated });
  };

  const selectArmor = (at) => {
    setArmorPlaceholder(pickPlaceholder(ARMOR_PLACEHOLDERS, FALLBACK_ARMOR, at.name));
    update({ armorTypeId: at.armorTypeId, armorName: "" });
  };

  const removeArmor = () => {
    setArmorPlaceholder("");
    update({ armorTypeId: null, armorName: "" });
  };

  const weaponsDone = data.weapons.length === WEAPON_LIMIT;
  const armorDone = !!data.armorTypeId;
  const allDone = weaponsDone && armorDone;

  const tryNext = () => {
    if (!allDone) {
      clearTimeout(shakeTimer.current);
      setShaking(false);
      requestAnimationFrame(() => {
        setShaking(true);
        shakeTimer.current = setTimeout(() => setShaking(false), 450);
      });
      return;
    }
    const normalizedWeapons = data.weapons.map((w) => {
      if (w.name.trim()) return w;
      const type = weaponTypes.find((wt) => wt.weaponTypeId === w.weaponTypeId);
      return { ...w, name: type?.name ?? w.name };
    });
    const normalizedArmorName =
      data.armorName.trim() || selectedArmorType?.name || data.armorName;
    update({ weapons: normalizedWeapons, armorName: normalizedArmorName });
    next();
  };

  const selectedArmorType = armorTypes.find((at) => at.armorTypeId === data.armorTypeId);

  return (
    <div className="wizard-step">
      <div className="wizard-step-header">
        <h2>Equipment</h2>
        <div className="equip-badges">
          <div className={`selection-badge ${weaponsDone ? "done" : ""} ${shaking && !weaponsDone ? "shake" : ""}`}>
            {data.weapons.length} / {WEAPON_LIMIT} weapons
          </div>
          <div className={`selection-badge ${armorDone ? "done" : ""} ${shaking && !armorDone ? "shake" : ""}`}>
            {armorDone ? 1 : 0} / {ARMOR_LIMIT} armor
          </div>
        </div>
      </div>
      <p className="wizard-hint">
        Choose <strong>2 weapons</strong> and <strong>1 armor</strong> to start with.
      </p>

      {loading ? (
        <p className="muted">Loading equipment types...</p>
      ) : (
        <div className="equip-columns">
          {/* ── Weapons ── */}
          <div className="equip-section">
            <h3>Weapons</h3>

            {data.weapons.length > 0 && (
              <div className="talent-selected-panel">
                {data.weapons.map((w, i) => {
                  const type = weaponTypes.find((wt) => wt.weaponTypeId === w.weaponTypeId);
                  return (
                    <div key={i} className="equip-selected-card">
                      <div className="talent-selected-header">
                        <strong>{type?.name ?? "Weapon"}</strong>
                        <button className="equip-remove-btn" onClick={() => removeWeapon(i)} title="Remove">×</button>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0, marginTop: "0.65rem" }}>
                        <label>Custom name</label>
                        <input
                          value={w.name}
                          onChange={(e) => updateWeaponName(i, e.target.value)}
                          placeholder={weaponPlaceholders[i] ?? ""}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {weaponTypes.length === 0 ? (
              <p className="muted">No weapon types in the database yet.</p>
            ) : !weaponsDone ? (
              <div className="picker-list">
                {weaponTypes.map((wt) => (
                  <button
                    key={wt.weaponTypeId}
                    className="picker-card"
                    onClick={() => addWeapon(wt)}
                  >
                    <strong>{wt.name}</strong>
                    {wt.description && <p>{wt.description}</p>}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* ── Armor ── */}
          <div className="equip-section">
            <h3>Armor</h3>

            {data.armorTypeId && (
              <div className="talent-selected-panel">
                <div className="equip-selected-card">
                  <div className="talent-selected-header">
                    <strong>{selectedArmorType?.name ?? "Armor"}</strong>
                    <button className="equip-remove-btn" onClick={removeArmor} title="Remove">×</button>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0, marginTop: "0.65rem" }}>
                    <label>Custom name</label>
                    <input
                      value={data.armorName}
                      onChange={(e) => update({ armorName: e.target.value })}
                      placeholder={armorPlaceholder}
                    />
                  </div>
                </div>
              </div>
            )}

            {armorTypes.length === 0 ? (
              <p className="muted">No armor types in the database yet.</p>
            ) : !armorDone ? (
              <div className="picker-list">
                {armorTypes.map((at) => (
                  <button
                    key={at.armorTypeId}
                    className="picker-card"
                    onClick={() => selectArmor(at)}
                  >
                    <strong>{at.name}</strong>
                    {at.description && <p>{at.description}</p>}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}

      <div className="wizard-nav">
        <button className="btn-secondary" onClick={back}>← Back</button>
        {allDone && (
          <button className="wizard-confirm-btn" onClick={tryNext}>Confirm Equipment →</button>
        )}
        <button onClick={tryNext}>Next →</button>
      </div>
    </div>
  );
}
