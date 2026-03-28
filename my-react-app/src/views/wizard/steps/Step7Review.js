import { useState, useEffect } from "react";
import { useAuth } from "../../../auth/AuthContext";
import {
  getVisions,
  getTalents,
  getArcana,
  getTechniques,
  getWeaponTypes,
  getArmorTypes,
} from "../../../api/characterApi";

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

export default function Step7Review({ data, back, onSubmit, submitting }) {
  const { auth } = useAuth();
  const [ref, setRef] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getVisions(auth.token).catch(() => []),
      getTalents(auth.token).catch(() => []),
      getArcana(auth.token).catch(() => []),
      getTechniques(auth.token).catch(() => []),
      getWeaponTypes(auth.token).catch(() => []),
      getArmorTypes(auth.token).catch(() => []),
    ]).then(([visions, talents, arcana, techniques, weaponTypes, armorTypes]) => {
      setRef({ visions, talents, arcana, techniques, weaponTypes, armorTypes });
    }).finally(() => setLoading(false));
  }, [auth.token]);

  const { attributes } = data;
  const life = 10 + attributes.endurance;
  const energy = 5 + attributes.willpower;

  const vision = ref?.visions?.find((v) => v.visionId === data.visionId);
  const selectedTalents = data.talentIds
    .map((id) => ref?.talents?.find((t) => t.talentId === id))
    .filter(Boolean);
  const selectedArcana = data.arcanaIds
    .map((id) => ref?.arcana?.find((a) => a.arcanaId === id))
    .filter(Boolean);
  const selectedTechniques = data.techniqueIds
    .map((id) => ref?.techniques?.find((t) => t.techniqueId === id))
    .filter(Boolean);
  const weaponDetails = data.weapons.map((w) => ({
    ...w,
    type: ref?.weaponTypes?.find((wt) => wt.weaponTypeId === w.weaponTypeId),
  }));
  const selectedArmorType = ref?.armorTypes?.find((at) => at.armorTypeId === data.armorTypeId);

  if (loading) {
    return (
      <div className="wizard-step">
        <p className="muted">Loading review...</p>
      </div>
    );
  }

  return (
    <div className="wizard-step review">
      <h2>Review Your Character</h2>
      <p className="wizard-hint">Take a final look before creating your character.</p>

      {/* ── Banner: Basics + Origin + Vision ── */}
      <div className="review-banner">
        <div className="review-banner-identity">
          {data.imageUrl && (
            <img className="review-portrait" src={data.imageUrl} alt={data.name} />
          )}
          <div>
            <p className="review-name">{data.name}</p>
            <p className="muted" style={{ margin: 0 }}>{data.nickname}</p>
          </div>
        </div>

        {(data.descriptor || data.profession) && (
          <div className="review-banner-section">
            <span className="review-section-label">Origin</span>
            <div className="review-origin-row">
              {data.descriptor && (
                <div className="review-origin-item">
                  <span className="muted">Descriptor</span>
                  <strong>{data.descriptor}</strong>
                </div>
              )}
              {data.profession && (
                <div className="review-origin-item">
                  <span className="muted">Profession</span>
                  <strong>{data.profession}</strong>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="review-banner-section">
          <span className="review-section-label">Vision</span>
          {vision ? (
            <div>
              <strong>{vision.name}</strong>
              {vision.description && (
                <p className="muted" style={{ margin: "0.15rem 0 0", fontSize: "0.85rem" }}>
                  {vision.description}
                </p>
              )}
            </div>
          ) : (
            <span className="muted">None</span>
          )}
        </div>
      </div>

      {/* ── Box 1: Attributes + Derived (full width) ── */}
      <div className="review-panel review-panel-attrs">
        <h3>Attributes</h3>
        <div className="attr-allocator-columns">
          {ATTR_PAIRS.map(([left, right]) => (
            <div key={`${left}-${right}`} className="review-attr-pair">
              <div className="attr-alloc-row review-attr-row">
                <span className="attr-alloc-label">{LABELS[left]}</span>
                <span className="attr-alloc-value">{attributes[left]}</span>
              </div>
              <div className="attr-alloc-row review-attr-row">
                <span className="attr-alloc-label">{LABELS[right]}</span>
                <span className="attr-alloc-value">{attributes[right]}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="derived-preview" style={{ marginBottom: 0 }}>
          <div className="derived-item">
            <span>Starting Life</span>
            <strong>{life}</strong>
          </div>
          <div className="derived-item">
            <span>Starting Energy</span>
            <strong>{energy}</strong>
          </div>
        </div>
      </div>

      {/* ── Middle: Box 2 (Talents) | Boxes 3+4 (Arcana / Techniques) ── */}
      <div className="review-middle">
        {/* Box 2: Talents */}
        <div className="review-panel">
          <h3>Talents</h3>
          <div className="review-panel-scroll">
            {selectedTalents.length > 0
              ? selectedTalents.map((t) => (
                  <div key={t.talentId} className="picker-card selected review-card">
                    <strong>{t.name}</strong>
                    {t.description && <p>{t.description}</p>}
                  </div>
                ))
              : <p className="muted">None selected</p>
            }
          </div>
        </div>

        {/* Boxes 3+4: Arcana and/or Techniques */}
        <div className="review-powers-col">
          {selectedArcana.length > 0 && (
            <div className="review-panel">
              <h3>Arcana</h3>
              <div className="review-panel-scroll">
                {selectedArcana.map((a) => (
                  <div key={a.arcanaId} className="picker-card selected review-card">
                    <strong>{a.name}</strong>
                    {a.description && <p>{a.description}</p>}
                    {a.upcast && (
                      <div className="card-sub-section">
                        <span className="card-sub-label">Upcast:</span>
                        <span className="card-sub-text">{a.upcast}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {selectedTechniques.length > 0 && (
            <div className="review-panel">
              <h3>Techniques</h3>
              <div className="review-panel-scroll">
                {selectedTechniques.map((t) => (
                  <div key={t.techniqueId} className="picker-card selected review-card">
                    <strong>{t.name}</strong>
                    {t.description && <p>{t.description}</p>}
                    {t.combo && (
                      <div className="card-sub-section">
                        <span className="card-sub-label">Combo:</span>
                        <span className="card-sub-text">{t.combo}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {selectedArcana.length === 0 && selectedTechniques.length === 0 && (
            <div className="review-panel">
              <h3>Powers</h3>
              <p className="muted">None selected</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Boxes 5a + 5b: Weapons | Armor (side by side, compact) ── */}
      <div className="review-equipment-boxes">
        <div className="review-panel">
          <h3>Weapons</h3>
          {weaponDetails.length > 0
            ? weaponDetails.map((w, i) => (
                <div key={i} className="review-equip-item">
                  <strong>{w.name || w.type?.name || "Weapon"}</strong>
                  {w.name && w.type?.name && <span className="muted">{w.type.name}</span>}
                </div>
              ))
            : <p className="muted">None</p>
          }
        </div>
        <div className="review-panel">
          <h3>Armor</h3>
          {data.armorTypeId
            ? (
              <div className="review-equip-item">
                <strong>{data.armorName || selectedArmorType?.name || "Armor"}</strong>
                {data.armorName && selectedArmorType?.name && (
                  <span className="muted">{selectedArmorType.name}</span>
                )}
              </div>
            )
            : <p className="muted">None</p>
          }
        </div>
      </div>

      <div className="wizard-nav">
        <button className="btn-secondary" onClick={back} disabled={submitting}>← Back</button>
        <button onClick={onSubmit} disabled={submitting}>
          {submitting ? "Creating..." : "Create Character"}
        </button>
      </div>
    </div>
  );
}
