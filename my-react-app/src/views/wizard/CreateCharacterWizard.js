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
  equipMainHand,
  equipArmor,
  updateInventorySlot,
} from "../../api/characterApi";

const STEPS = ["Basics", "Origin", "Vision", "Attributes", "Talents", "Powers", "Equipment", "Review"];

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

      // Auto-equip: first weapon → main hand, armor → armor slot, second weapon → inventory slot 1
      if (createdWeapons[0]) {
        await equipMainHand(auth.token, charId, createdWeapons[0].weaponInstanceId);
      }
      if (createdArmor) {
        await equipArmor(auth.token, charId, createdArmor.armorInstanceId);
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

  const stepProps = { data, update, next, back };

  return (
    <div className="wizard-container">
      {/* Progress bar */}
      <div className="wizard-progress">
        {STEPS.map((label, i) => (
          <div
            key={i}
            className={`wizard-dot ${i === step ? "active" : ""} ${i < step ? "done" : ""}`}
          >
            <div className="wizard-dot-circle">{i < step ? "✓" : i + 1}</div>
            <span className="wizard-dot-label">{label}</span>
          </div>
        ))}
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
        {step === 7 && <Step8Review {...stepProps} onSubmit={submit} submitting={submitting} />}
      </div>
    </div>
  );
}
