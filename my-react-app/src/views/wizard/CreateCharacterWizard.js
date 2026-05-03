import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import Step1Basics from "./steps/Step1Basics";
import Step2OriginVision from "./steps/Step2OriginVision";
import Step3Vision from "./steps/Step3Vision";
import Step4Attributes from "./steps/Step3Attributes";
import Step5Talents from "./steps/Step4Talents";
import Step6Powers from "./steps/Step5Powers";
import Step7Equipment from "./steps/Step6Equipment";
import Step8Review from "./steps/Step7Review";
import {
  createCharacter,
  setCharacterOrigin,
  addVisionToCharacter,
  addTalentToCharacter,
  addArcanaToCharacter,
  addTechniqueToCharacter,
  createWeapon,
  createArmor,
  createShield,
  equipMainHand,
  equipOffHandShield,
  equipArmor,
  updateInventorySlot,
} from "../../api/characterApi";

const STEPS = ["Basics", "Origin", "Vision", "Attributes", "Talents", "Powers", "Equipment", "Review"];

// Per-step completion checks. Vision (index 2) and Review (index 7) are always
// considered complete since Vision is optional and Review has no inputs.
const STEP_VALIDATORS = [
  (d) => d.name.trim().length > 0 && d.nickname.trim().length > 0,
  (d) => d.descriptor.trim().length > 0 && d.profession.trim().length > 0,
  () => true,
  (d) => Object.values(d.attributes).reduce((s, v) => s + v, 0) === 14,
  (d) => d.talentIds.length === 2,
  (d) => d.arcanaIds.length + d.techniqueIds.length === 2,
  (d) => d.weapons.length === 2 && d.armorTypeId != null,
  () => true,
];

const INITIAL = {
  name: "",
  nickname: "",
  imageUrl: "",
  descriptor: "",
  profession: "",
  visionId: null,
  attributes: { might: 1, precision: 1, mind: 1, endurance: 1, agility: 1, willpower: 1 },
  talentIds: [],
  arcanaIds: [],
  techniqueIds: [],
  weapons: [],
  armorTypeId: null,
  armorName: "",
  armorQualityIds: [],
  shieldTypeId: null,
  shieldName: "",
  shieldQualityIds: [],
};

export default function CreateCharacterWizard() {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [data, setData] = useState(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const update = (partial) => setData((prev) => ({ ...prev, ...partial }));
  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));
  const goTo = (i) => setStep(Math.max(0, Math.min(i, STEPS.length - 1)));

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const { attributes: a } = data;

      const character = await createCharacter(auth.token, {
        name: data.name,
        nickname: data.nickname,
        imageUrl: data.imageUrl || "",
        might: a.might,
        precision: a.precision,
        mind: a.mind,
        endurance: a.endurance,
        agility: a.agility,
        willpower: a.willpower,
      });

      const charId = character.characterId;

      if (data.descriptor || data.profession) {
        await setCharacterOrigin(auth.token, charId, {
          descriptor: data.descriptor || null,
          profession: data.profession || null,
        });
      }
      if (data.visionId) await addVisionToCharacter(auth.token, charId, data.visionId);
      for (const id of data.talentIds) await addTalentToCharacter(auth.token, charId, id);
      for (const id of data.arcanaIds) await addArcanaToCharacter(auth.token, charId, id);
      for (const id of data.techniqueIds) await addTechniqueToCharacter(auth.token, charId, id);
      // Create weapons with qualities
      const createdWeapons = [];
      for (const w of data.weapons) {
        const weapon = await createWeapon(auth.token, charId, {
          name: w.name,
          description: "",
          weaponTypeId: w.weaponTypeId,
          qualityIds: w.qualityIds?.length > 0 ? w.qualityIds : null,
        });
        createdWeapons.push(weapon);
      }

      // Create armor with qualities
      let createdArmor = null;
      if (data.armorTypeId) {
        createdArmor = await createArmor(auth.token, charId, {
          name: data.armorName || "Armor",
          description: "",
          armorTypeId: data.armorTypeId,
          qualityIds: data.armorQualityIds?.length > 0 ? data.armorQualityIds : null,
        });
      }

      // Create shield with qualities (server fills default sunderMax when sent as 0)
      let createdShield = null;
      if (data.shieldTypeId) {
        createdShield = await createShield(auth.token, charId, {
          name: data.shieldName || "Shield",
          description: "",
          shieldTypeId: data.shieldTypeId,
          sunderMax: 0,
          qualityIds: data.shieldQualityIds?.length > 0 ? data.shieldQualityIds : null,
        });
      }

      // Auto-equip: first weapon → main hand, armor → armor slot.
      // Shield (if created) → off-hand; second weapon → inventory slot 1.
      // No shield: second weapon → inventory slot 1 (legacy behavior).
      if (createdWeapons[0]) {
        await equipMainHand(auth.token, charId, createdWeapons[0].weaponInstanceId);
      }
      if (createdArmor) {
        await equipArmor(auth.token, charId, createdArmor.armorInstanceId);
      }
      if (createdShield) {
        await equipOffHandShield(auth.token, charId, createdShield.shieldInstanceId);
      }
      if (createdWeapons[1]) {
        await updateInventorySlot(auth.token, charId, 1, {
          weaponInstanceId: createdWeapons[1].weaponInstanceId,
        });
      }

      navigate(`/characters/${charId}`);
    } catch (err) {
      setError(err.message || "Failed to create character.");
      setSubmitting(false);
    }
  };

  const stepValidity = STEP_VALIDATORS.map((fn) => fn(data));
  const allRequiredValid = stepValidity.every(Boolean);

  const stepProps = { data, update, next, back };

  return (
    <div className="wizard-container">
      {/* Progress bar */}
      <div className="wizard-progress">
        {STEPS.map((label, i) => {
          const isValid = stepValidity[i];
          return (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              disabled={submitting}
              className={`wizard-dot ${i === step ? "active" : ""} ${isValid ? "done" : ""}`}
              aria-label={`Go to step ${i + 1}: ${label}`}
              aria-current={i === step ? "step" : undefined}
            >
              <div className="wizard-dot-circle">{isValid ? "✓" : i + 1}</div>
              <span className="wizard-dot-label">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Step content */}
      <div className="wizard-body">
        {error && <div className="error">{error}</div>}
        {step === 0 && <Step1Basics {...stepProps} />}
        {step === 1 && <Step2OriginVision {...stepProps} />}
        {step === 2 && <Step3Vision {...stepProps} />}
        {step === 3 && <Step4Attributes {...stepProps} />}
        {step === 4 && <Step5Talents {...stepProps} />}
        {step === 5 && <Step6Powers {...stepProps} />}
        {step === 6 && <Step7Equipment {...stepProps} />}
        {step === 7 && (
          <Step8Review
            {...stepProps}
            onSubmit={submit}
            submitting={submitting}
            canSubmit={allRequiredValid}
            stepValidity={stepValidity}
            stepLabels={STEPS}
            goTo={goTo}
          />
        )}
      </div>
    </div>
  );
}
