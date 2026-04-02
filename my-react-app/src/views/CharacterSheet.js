import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useRoom } from "../context/RoomContext";
import JoinRoomModal from "../components/JoinRoomModal";
import { getRoomCharacter } from "../api/roomApi";
import PickerModal from "../components/PickerModal";
import VitalManagementPanel from "../components/VitalManagementPanel";
import {
  getCharacterById,
  getCharacterEquipment,
  getCharacterInventory,
  getTalents,
  getArcana,
  getTechniques,
  getQualities,
  getWeaponTypes,
  getArmorTypes,
  createWeapon,
  createArmor,
  deleteWeapon,
  deleteArmor,
  addTalentToCharacter,
  addArcanaToCharacter,
  addTechniqueToCharacter,
  removeTalentFromCharacter,
  removeArcanaFromCharacter,
  removeTechniqueFromCharacter,
  updateCharacter,
  updateInventorySlot,
  clearInventorySlot,
  addQualityToWeapon,
  removeQualityFromWeapon,
  addQualityToArmor,
  removeQualityFromArmor,
  equipMainHand,
  equipArmor,
  equipOffHandWeapon,
  unequipSlot,
  batchSetInventory,
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
  const navigate = useNavigate();
  const { room, isOwner, changedCharacterId, clearChangedCharacter } = useRoom();
  const [character, setCharacter] = useState(null);
  const [equipment, setEquipment] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [refData, setRefData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pickerModal, setPickerModal] = useState(null);
  const [vitalPanel, setVitalPanel] = useState(null); // 'life' | 'energy' | 'items' | 'gold' | null
  const [busy, setBusy] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  // Tracks the timestamp of the last mutation WE submitted, so we can ignore
  // CharacterChanged events that we ourselves caused (we already have latest state).
  const lastLocalMutationRef = useRef(0);

  // Room access: is this character owned by someone else in the room?
  const roomMember = room?.members?.find((m) => m.characterId === parseInt(id));
  const isRoomCharacter = !!roomMember && roomMember.ownerUserId !== auth?.userId;
  // Members see others read-only; room owner has full write access
  const sheetReadOnly = isRoomCharacter && !isOwner;
  const canEditVitals = !sheetReadOnly;

  // Inventory item picker (for empty slots)
  const [invItemPickerSlot, setInvItemPickerSlot] = useState(null); // slotIndex | null

  // Equipment slot creator (for empty equipment slots)
  const [createEquipSlot, setCreateEquipSlot] = useState(null); // 'mainHand' | 'offHand' | 'armor' | null

  // Drag & drop state
  const [dragging, setDragging] = useState(null);
  // { source: 'equipped'|'inventory', slot?: 'mainHand'|'offHand'|'armor', slotIndex?: number, itemType: 'weapon'|'armor'|'shield'|'generic', item: object }
  const [dragOverTarget, setDragOverTarget] = useState(null); // 'mainHand'|'offHand'|'armor'|`inv-${n}`
  const [inventoryUnlocked, setInventoryUnlocked] = useState(false);
  const [confirmDeleteEquip, setConfirmDeleteEquip] = useState(null); // { slot, name }

  // Equipment quality picker state
  const [qualityPickerTarget, setQualityPickerTarget] = useState(null); // { slot: 'mainHand'|'offHand'|'armor', itemId: number }
  const [allQualities, setAllQualities] = useState([]);
  const [qualitiesLoading, setQualitiesLoading] = useState(false);
  const [activeTagFilters, setActiveTagFilters] = useState([]);

  useEffect(() => {
    setLoading(true);
    setError(null);

    if (isRoomCharacter && room) {
      // Fetch another player's character via the room-scoped endpoint.
      Promise.all([
        getRoomCharacter(auth.token, room.roomId, id),
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
    } else {
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
    }
  }, [auth.token, id, isRoomCharacter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync vitals from room updates (e.g. room owner edits another's vitals)
  useEffect(() => {
    if (!isRoomCharacter || !room) return;
    const card = room.members.find((m) => m.characterId === parseInt(id));
    if (card && character) {
      setCharacter((prev) =>
        prev
          ? {
              ...prev,
              healthCurrent: card.healthCurrent,
              healthMax: card.healthMax,
              energyCurrent: card.energyCurrent,
              energyMax: card.energyMax,
              itemPointsCurrent: card.itemPointsCurrent,
              itemPointsMax: card.itemPointsMax,
              gold: card.gold,
            }
          : prev
      );
    }
  }, [room?.members]); // eslint-disable-line react-hooks/exhaustive-deps

  // Silent re-fetch when CharacterChanged arrives for this character.
  // Skipped if WE made the change within the last 2 seconds (we already have latest state).
  useEffect(() => {
    if (changedCharacterId !== parseInt(id)) return;
    clearChangedCharacter();

    const msSinceOwnMutation = Date.now() - lastLocalMutationRef.current;
    if (msSinceOwnMutation < 2000) return; // our own change — local state is already correct

    // Re-fetch silently (no loading spinner)
    const silentFetch = isRoomCharacter && room
      ? Promise.all([
          getRoomCharacter(auth.token, room.roomId, id),
          getCharacterEquipment(auth.token, id).catch(() => null),
          getCharacterInventory(auth.token, id).catch(() => null),
        ])
      : Promise.all([
          getCharacterById(auth.token, id),
          getCharacterEquipment(auth.token, id).catch(() => null),
          getCharacterInventory(auth.token, id).catch(() => null),
        ]);

    silentFetch.then(([char, eq, inv]) => {
      if (char) setCharacter(char);
      if (eq !== undefined) setEquipment(eq);
      if (inv !== undefined) setInventory(inv);
    }).catch(() => { /* silent — don't surface re-fetch errors */ });
  }, [changedCharacterId]); // eslint-disable-line react-hooks/exhaustive-deps

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
    lastLocalMutationRef.current = Date.now();
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
    lastLocalMutationRef.current = Date.now();
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

  // ── Delete equipped item ───────────────────────────────

  const handleDeleteEquipment = (slot) => {
    const item = equipment?.[slot];
    if (!item) return;
    setConfirmDeleteEquip({ slot, name: item.name || (slot === "armor" ? "Armor" : "Weapon") });
  };

  const handleConfirmDeleteEquip = async () => {
    if (!confirmDeleteEquip) return;
    const { slot } = confirmDeleteEquip;
    const item = equipment?.[slot];
    if (!item) return;
    setBusy(true);
    try {
      if (slot === "armor") {
        await deleteArmor(auth.token, id, item.armorInstanceId);
      } else {
        await deleteWeapon(auth.token, id, item.weaponInstanceId);
      }
      setEquipment((prev) => ({ ...prev, [slot]: null }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      setConfirmDeleteEquip(null);
    }
  };

  // ── Inventory item picker ──────────────────────────────

  const handleInvItemPickSuccess = (updatedSlot) => {
    setInventory((prev) => ({
      ...prev,
      slots: prev.slots.map((s) => s.slotIndex === updatedSlot.slotIndex ? updatedSlot : s),
    }));
    setInvItemPickerSlot(null);
  };

  const handleEquipSlotCreateSuccess = (updatedEquipment) => {
    setEquipment(updatedEquipment);
    setCreateEquipSlot(null);
  };

  // ── Drag & drop ────────────────────────────────────────

  const EQUIP_SLOT_API = { mainHand: "main-hand", offHand: "off-hand", armor: "armor" };

  const canDropOnEquipSlot = (slot) => {
    if (!dragging || dragging.source !== "inventory") return false;
    if (slot === "armor") return dragging.itemType === "armor";
    return dragging.itemType === "weapon";
  };

  const handleEquipmentDragStart = (e, slot) => {
    const item = equipment?.[slot];
    if (!item || busy) { e.preventDefault(); return; }
    const itemType = slot === "armor" ? "armor" : "weapon";
    setDragging({ source: "equipped", slot, itemType, item });
    e.dataTransfer.effectAllowed = "move";
    // Use the dragged element itself as the ghost image so it's always visible
    e.dataTransfer.setDragImage(e.currentTarget, e.nativeEvent.offsetX, e.nativeEvent.offsetY);
  };

  const handleInventoryDragStart = (e, slotData) => {
    if (busy) { e.preventDefault(); return; }
    const item = slotData.weapon || slotData.armor || slotData.shield;
    const hasContent = !!(item || slotData.genericItemDescription);
    if (!hasContent) { e.preventDefault(); return; }
    if (!item && !inventoryUnlocked) { e.preventDefault(); return; }
    const itemType = slotData.weapon ? "weapon" : slotData.armor ? "armor" : slotData.shield ? "shield" : "generic";
    setDragging({ source: "inventory", slotIndex: slotData.slotIndex, itemType, item: slotData });
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDragging(null);
    setDragOverTarget(null);
  };

  const handleEquipmentDragOver = (e, slot) => {
    if (!canDropOnEquipSlot(slot)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverTarget(slot);
  };

  const handleEquipmentDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragOverTarget(null);
  };

  const handleEquipmentDrop = async (e, targetSlot) => {
    e.preventDefault();
    if (!canDropOnEquipSlot(targetSlot)) return;
    const sourceSlotIndex = dragging.slotIndex;
    const sourceSlotData = dragging.item; // the inventory slot object
    setDragging(null);
    setDragOverTarget(null);

    setBusy(true);
    try {
      let updatedEquip;
      if (targetSlot === "armor") {
        const newArmor = sourceSlotData.armor;
        const oldArmor = equipment?.armor;
        updatedEquip = await equipArmor(auth.token, id, newArmor.armorInstanceId);
        setEquipment(updatedEquip);
        if (oldArmor) {
          const updatedSlot = await updateInventorySlot(auth.token, id, sourceSlotIndex, { armorInstanceId: oldArmor.armorInstanceId });
          setInventory((prev) => ({ ...prev, slots: prev.slots.map((s) => s.slotIndex === sourceSlotIndex ? updatedSlot : s) }));
        } else {
          await clearInventorySlot(auth.token, id, sourceSlotIndex);
          setInventory((prev) => ({ ...prev, slots: prev.slots.map((s) => s.slotIndex === sourceSlotIndex ? { slotIndex: s.slotIndex, weapon: null, armor: null, shield: null, genericItemDescription: null } : s) }));
        }
      } else {
        const newWeapon = sourceSlotData.weapon;
        const oldWeapon = equipment?.[targetSlot];
        if (targetSlot === "mainHand") {
          updatedEquip = await equipMainHand(auth.token, id, newWeapon.weaponInstanceId);
        } else {
          updatedEquip = await equipOffHandWeapon(auth.token, id, newWeapon.weaponInstanceId);
        }
        setEquipment(updatedEquip);
        if (oldWeapon) {
          const updatedSlot = await updateInventorySlot(auth.token, id, sourceSlotIndex, { weaponInstanceId: oldWeapon.weaponInstanceId });
          setInventory((prev) => ({ ...prev, slots: prev.slots.map((s) => s.slotIndex === sourceSlotIndex ? updatedSlot : s) }));
        } else {
          await clearInventorySlot(auth.token, id, sourceSlotIndex);
          setInventory((prev) => ({ ...prev, slots: prev.slots.map((s) => s.slotIndex === sourceSlotIndex ? { slotIndex: s.slotIndex, weapon: null, armor: null, shield: null, genericItemDescription: null } : s) }));
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleInventorySlotDragOver = (e, targetSlotIndex) => {
    if (!dragging) return;
    if (dragging.source === "equipped") {
      // Allow dropping equipped items on empty inventory slots only
      const targetSlot = inventory?.slots.find((s) => s.slotIndex === targetSlotIndex);
      const isEmpty = !targetSlot?.weapon && !targetSlot?.armor && !targetSlot?.shield && !targetSlot?.genericItemDescription;
      if (!isEmpty) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverTarget(`inv-${targetSlotIndex}`);
    } else if (dragging.source === "inventory" && inventoryUnlocked && dragging.slotIndex !== targetSlotIndex) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverTarget(`inv-${targetSlotIndex}`);
    }
  };

  const handleInventorySlotDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragOverTarget(null);
  };

  const handleInventorySlotDrop = async (e, targetSlotIndex) => {
    e.preventDefault();
    if (!dragging) return;
    const prevDragging = dragging;
    setDragging(null);
    setDragOverTarget(null);

    if (prevDragging.source === "equipped") {
      const targetSlot = inventory?.slots.find((s) => s.slotIndex === targetSlotIndex);
      const isEmpty = !targetSlot?.weapon && !targetSlot?.armor && !targetSlot?.shield && !targetSlot?.genericItemDescription;
      if (!isEmpty) return;
      const { slot, itemType, item } = prevDragging;
      setBusy(true);
      try {
        await unequipSlot(auth.token, id, EQUIP_SLOT_API[slot]);
        setEquipment((prev) => ({ ...prev, [slot]: null }));
        const putData =
          itemType === "armor" ? { armorInstanceId: item.armorInstanceId }
          : itemType === "shield" ? { shieldInstanceId: item.shieldInstanceId }
          : { weaponInstanceId: item.weaponInstanceId };
        const updatedSlot = await updateInventorySlot(auth.token, id, targetSlotIndex, putData);
        setInventory((prev) => ({ ...prev, slots: prev.slots.map((s) => s.slotIndex === targetSlotIndex ? updatedSlot : s) }));
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
    } else if (prevDragging.source === "inventory" && inventoryUnlocked) {
      const sourceSlotIndex = prevDragging.slotIndex;
      if (sourceSlotIndex === targetSlotIndex) return;
      // Swap slot contents locally — saved on lock
      setInventory((prev) => {
        const src = prev.slots.find((s) => s.slotIndex === sourceSlotIndex);
        const dst = prev.slots.find((s) => s.slotIndex === targetSlotIndex);
        if (!src || !dst) return prev;
        return {
          ...prev,
          slots: prev.slots.map((s) => {
            if (s.slotIndex === sourceSlotIndex) return { slotIndex: sourceSlotIndex, weapon: dst.weapon, armor: dst.armor, shield: dst.shield, genericItemDescription: dst.genericItemDescription };
            if (s.slotIndex === targetSlotIndex) return { slotIndex: targetSlotIndex, weapon: src.weapon, armor: src.armor, shield: src.shield, genericItemDescription: src.genericItemDescription };
            return s;
          }),
        };
      });
    }
  };

  const handleLockInventory = async () => {
    setBusy(true);
    try {
      const slots = inventory.slots.map((s) => ({
        slotIndex: s.slotIndex,
        genericItemDescription: s.genericItemDescription ?? null,
        weaponInstanceId: s.weapon?.weaponInstanceId ?? null,
        armorInstanceId: s.armor?.armorInstanceId ?? null,
        shieldInstanceId: s.shield?.shieldInstanceId ?? null,
      }));
      await batchSetInventory(auth.token, id, slots);
      setInventoryUnlocked(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // ── Equipment quality picker ───────────────────────────

  const openEquipmentQualityPicker = (slot) => {
    const item = equipment?.[slot];
    if (!item) return;
    const itemId = slot === "armor" ? item.armorInstanceId : item.weaponInstanceId;
    const categoryTag =
      slot === "armor"
        ? "Armor"
        : item.weaponType?.tag?.includes("FOCUS")
        ? "Focus"
        : "Weapon";
    setQualityPickerTarget({ slot, itemId });
    setActiveTagFilters([]);
    setQualitiesLoading(true);
    getQualities(auth.token, [categoryTag])
      .then((q) => setAllQualities(Array.isArray(q) ? q : []))
      .catch(() => setAllQualities([]))
      .finally(() => setQualitiesLoading(false));
  };

  const closeEquipmentQualityPicker = () => {
    setQualityPickerTarget(null);
    setAllQualities([]);
    setActiveTagFilters([]);
  };

  const getAvailableEquipmentFilterTags = () => {
    const tagSet = new Set();
    allQualities.forEach((q) => q.tags?.forEach((t) => tagSet.add(t)));
    ["Weapon", "Armor", "Shield", "Focus"].forEach((t) => tagSet.delete(t));
    return [...tagSet].sort();
  };

  const getFilteredEquipmentQualities = () => {
    if (activeTagFilters.length === 0) return allQualities;
    return allQualities.filter((q) =>
      activeTagFilters.every((tag) => q.tags?.includes(tag))
    );
  };

  const toggleEquipmentQuality = async (qualityId) => {
    if (!qualityPickerTarget) return;
    const { slot, itemId } = qualityPickerTarget;
    const item = equipment?.[slot];
    const already = item?.qualities?.some((q) => q.qualityId === qualityId);
    setBusy(true);
    try {
      if (slot === "armor") {
        if (already) {
          await removeQualityFromArmor(auth.token, id, itemId, qualityId);
          setEquipment((prev) => ({
            ...prev,
            armor: { ...prev.armor, qualities: prev.armor.qualities.filter((q) => q.qualityId !== qualityId) },
          }));
        } else {
          const updated = await addQualityToArmor(auth.token, id, itemId, qualityId);
          setEquipment((prev) => ({ ...prev, armor: updated }));
        }
      } else {
        if (already) {
          await removeQualityFromWeapon(auth.token, id, itemId, qualityId);
          setEquipment((prev) => ({
            ...prev,
            [slot]: { ...prev[slot], qualities: prev[slot].qualities.filter((q) => q.qualityId !== qualityId) },
          }));
        } else {
          const updated = await addQualityToWeapon(auth.token, id, itemId, qualityId);
          setEquipment((prev) => ({ ...prev, [slot]: updated }));
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveEquipmentQuality = async (slot, qualityId) => {
    const item = equipment?.[slot];
    const itemId = slot === "armor" ? item?.armorInstanceId : item?.weaponInstanceId;
    if (!itemId) return;
    setBusy(true);
    try {
      if (slot === "armor") {
        await removeQualityFromArmor(auth.token, id, itemId, qualityId);
        setEquipment((prev) => ({
          ...prev,
          armor: { ...prev.armor, qualities: prev.armor.qualities.filter((q) => q.qualityId !== qualityId) },
        }));
      } else {
        await removeQualityFromWeapon(auth.token, id, itemId, qualityId);
        setEquipment((prev) => ({
          ...prev,
          [slot]: { ...prev[slot], qualities: prev[slot].qualities.filter((q) => q.qualityId !== qualityId) },
        }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
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
    <div className={`sheet ${sheetReadOnly ? "sheet-view-only" : ""}`}>
      {/* ── Header ─────────────────────────────── */}
      <div className="sheet-header">
        <div className="sheet-identity">
          <h1 className="sheet-name">{character.name}</h1>
          <p className="sheet-title">{character.nickname}</p>
          <p className="sheet-meta muted">Level 1 · {character.experience ?? 0} XP</p>
          {isRoomCharacter && (
            <span className="sheet-readonly-badge">
              {isOwner ? "Room Owner" : "Read Only"}
            </span>
          )}
        </div>
        <div className="sheet-header-actions">
        </div>
        {character.imageUrl && (
          <img src={character.imageUrl} alt={character.name} className="sheet-avatar" />
        )}
      </div>

      {showRoomModal && (
        <JoinRoomModal
          characterId={parseInt(id)}
          onClose={() => setShowRoomModal(false)}
        />
      )}

      {confirmDeleteEquip && (
        <div className="modal-overlay" onClick={() => !busy && setConfirmDeleteEquip(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Delete {confirmDeleteEquip.slot === "armor" ? "Armor" : "Weapon"}?</h2>
            <p style={{ margin: "0 0 6px" }}>
              <strong>{confirmDeleteEquip.name}</strong> will be permanently deleted.
            </p>
            <p className="muted" style={{ fontSize: "0.85rem", margin: "0 0 20px" }}>This cannot be undone.</p>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button className="btn-secondary" onClick={() => setConfirmDeleteEquip(null)} disabled={busy}>Cancel</button>
              <button className="equip-delete-confirm-btn" onClick={handleConfirmDeleteEquip} disabled={busy}>
                {busy ? "Deleting…" : "Delete Forever"}
              </button>
            </div>
            <button className="modal-close-btn" onClick={() => setConfirmDeleteEquip(null)} disabled={busy}>✕</button>
          </div>
        </div>
      )}

      <div className="sheet-body">
        {/* ── Left column ──────────────────────── */}
        <div className="sheet-col-left">

          {/* Vitals */}
          <div className="sheet-vitals-panel">
            <div className="vitals-row">
              <Vital
                label="Life"
                current={character.healthCurrent ?? 0}
                max={character.healthMax ?? 0}
                color="var(--vital-life)"
                onChangeCurrent={(d) => updateStat("healthCurrent", d)}
                onOpenPanel={() => !sheetReadOnly && setVitalPanel("life")}
                disabled={!canEditVitals}
              />
              <Vital
                label="Energy"
                current={character.energyCurrent ?? 0}
                max={character.energyMax ?? 0}
                color="var(--vital-energy)"
                onChangeCurrent={(d) => updateStat("energyCurrent", d)}
                onOpenPanel={() => !sheetReadOnly && setVitalPanel("energy")}
                disabled={!canEditVitals}
              />
              <VitalSimple
                label="Items"
                display={`${character.itemPointsCurrent ?? 3} / ${character.itemPointsMax ?? 3}`}
                onOpenPanel={() => !sheetReadOnly && setVitalPanel("items")}
                onDec={() => updateStat("itemPointsCurrent", -1)}
                onInc={() => updateStat("itemPointsCurrent", 1)}
                disabled={!canEditVitals}
              />
              <VitalSimple
                label="Gold"
                display={character.gold ?? 0}
                onOpenPanel={() => !sheetReadOnly && setVitalPanel("gold")}
                onDec={() => updateStat("gold", -1)}
                onInc={() => updateStat("gold", 1)}
                disabled={!canEditVitals}
              />
            </div>
            {!sheetReadOnly && (
              <button className="btn-secondary vitals-reset-btn" onClick={handleReset}>
                Reset
              </button>
            )}
          </div>

          {/* Attributes */}
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

          {/* Origin & Vision */}
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

          {/* Talents */}
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

          {/* Arcana */}
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

          {/* Techniques */}
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

        </div>{/* end sheet-col-left */}

        {/* ── Right column ─────────────────────── */}
        <div className="sheet-col-right">

      {/* ── Equipment ──────────────────────────── */}
      <div className="review-equipment-boxes">
        {/* Main Hand */}
        <div
          className={`review-panel equip-drop-panel${canDropOnEquipSlot("mainHand") ? " equip-drop-valid" : ""}${dragOverTarget === "mainHand" ? " equip-drop-over" : ""}`}
          onDragOver={(e) => handleEquipmentDragOver(e, "mainHand")}
          onDragLeave={handleEquipmentDragLeave}
          onDrop={(e) => handleEquipmentDrop(e, "mainHand")}
        >
          <div className="equip-panel-title-row">
            <h3>Main Hand</h3>
            {equipment?.mainHand && (
              <button className="equip-delete-btn" onClick={() => handleDeleteEquipment("mainHand")} disabled={busy} title="Delete weapon">
                ×
              </button>
            )}
          </div>
          {equipment?.mainHand ? (
            <div className={dragging?.source === "equipped" && dragging.slot === "mainHand" ? "equip-dragging" : ""}>
              <div
                className="review-equip-item equip-name-draggable"
                draggable
                onDragStart={(e) => handleEquipmentDragStart(e, "mainHand")}
                onDragEnd={handleDragEnd}
                title="Drag to inventory"
              >
                <strong>{equipment.mainHand.name}</strong>
                {equipment.mainHand.weaponType && (
                  <span className="muted">{equipment.mainHand.weaponType.name}</span>
                )}
              </div>
              <EquipmentQualityList
                qualities={equipment.mainHand.qualities}
                onRemove={(qId) => handleRemoveEquipmentQuality("mainHand", qId)}
                onAdd={() => openEquipmentQualityPicker("mainHand")}
                disabled={busy}
              />
            </div>
          ) : (
            <button className="equip-slot-empty-btn" onClick={() => setCreateEquipSlot("mainHand")} disabled={busy}>
              + New Weapon
            </button>
          )}
        </div>

        {/* Off Hand */}
        <div
          className={`review-panel equip-slot-empty-panel equip-drop-panel${canDropOnEquipSlot("offHand") ? " equip-drop-valid" : ""}${dragOverTarget === "offHand" ? " equip-drop-over" : ""}`}
          onDragOver={(e) => handleEquipmentDragOver(e, "offHand")}
          onDragLeave={handleEquipmentDragLeave}
          onDrop={(e) => handleEquipmentDrop(e, "offHand")}
        >
          <div className="equip-panel-title-row">
            <h3>Off Hand</h3>
            {equipment?.offHand && (
              <button className="equip-delete-btn" onClick={() => handleDeleteEquipment("offHand")} disabled={busy} title="Delete weapon">
                ×
              </button>
            )}
          </div>
          {equipment?.offHand ? (
            <div className={dragging?.source === "equipped" && dragging.slot === "offHand" ? "equip-dragging" : ""}>
              <div
                className="review-equip-item equip-name-draggable"
                draggable
                onDragStart={(e) => handleEquipmentDragStart(e, "offHand")}
                onDragEnd={handleDragEnd}
                title="Drag to inventory"
              >
                <strong>{equipment.offHand.name}</strong>
                {equipment.offHand.weaponType && (
                  <span className="muted">{equipment.offHand.weaponType.name}</span>
                )}
              </div>
              <EquipmentQualityList
                qualities={equipment.offHand.qualities}
                onRemove={(qId) => handleRemoveEquipmentQuality("offHand", qId)}
                onAdd={() => openEquipmentQualityPicker("offHand")}
                disabled={busy}
              />
            </div>
          ) : equipment?.offHandShield ? (
            <div className="review-equip-item">
              <strong>{equipment.offHandShield.name}</strong>
              {equipment.offHandShield.shieldType && (
                <span className="muted">{equipment.offHandShield.shieldType.name}</span>
              )}
            </div>
          ) : (
            <button className="equip-slot-empty-btn" onClick={() => setCreateEquipSlot("offHand")} disabled={busy}>
              + New Weapon
            </button>
          )}
        </div>

        {/* Armor */}
        <div
          className={`review-panel equip-panel-armor equip-drop-panel${canDropOnEquipSlot("armor") ? " equip-drop-valid" : ""}${dragOverTarget === "armor" ? " equip-drop-over" : ""}`}
          onDragOver={(e) => handleEquipmentDragOver(e, "armor")}
          onDragLeave={handleEquipmentDragLeave}
          onDrop={(e) => handleEquipmentDrop(e, "armor")}
        >
          <div className="equip-panel-title-row">
            <h3>Armor</h3>
            {equipment?.armor && (
              <button className="equip-delete-btn" onClick={() => handleDeleteEquipment("armor")} disabled={busy} title="Delete armor">
                ×
              </button>
            )}
          </div>
          {equipment?.armor ? (
            <div className={dragging?.source === "equipped" && dragging.slot === "armor" ? "equip-dragging" : ""}>
              <div
                className="review-equip-item equip-name-draggable"
                draggable
                onDragStart={(e) => handleEquipmentDragStart(e, "armor")}
                onDragEnd={handleDragEnd}
                title="Drag to inventory"
              >
                <strong>{equipment.armor.name}</strong>
                {equipment.armor.armorType && (
                  <span className="muted">{equipment.armor.armorType.name}</span>
                )}
              </div>
              <EquipmentQualityList
                qualities={equipment.armor.qualities}
                onRemove={(qId) => handleRemoveEquipmentQuality("armor", qId)}
                onAdd={() => openEquipmentQualityPicker("armor")}
                disabled={busy}
              />
            </div>
          ) : (
            <button className="equip-slot-empty-btn" onClick={() => setCreateEquipSlot("armor")} disabled={busy}>
              + New Armor
            </button>
          )}
        </div>
      </div>

      {/* ── Inventory ──────────────────────────── */}
      {inventory && (
        <div className="review-panel">
          <div className="inv-panel-header">
            <h3>Inventory</h3>
            {inventoryUnlocked ? (
              <button className="inv-lock-btn" onClick={handleLockInventory} disabled={busy}>
                Save Order
              </button>
            ) : (
              <button className="inv-unlock-btn" onClick={() => setInventoryUnlocked(true)} disabled={busy}>
                Rearrange
              </button>
            )}
          </div>
          <div className={`inventory-grid${inventoryUnlocked ? " inventory-unlocked" : ""}`}>
            {inventory.slots.map((slot) => (
              <InventorySlot
                key={slot.slotIndex}
                slot={slot}
                unlocked={inventoryUnlocked}
                isDragging={dragging?.source === "inventory" && dragging.slotIndex === slot.slotIndex}
                isDragOver={dragOverTarget === `inv-${slot.slotIndex}`}
                isValidDropTarget={
                  dragging?.source === "equipped"
                    ? !slot.weapon && !slot.armor && !slot.shield && !slot.genericItemDescription
                    : dragging?.source === "inventory" && inventoryUnlocked && dragging.slotIndex !== slot.slotIndex
                }
                onDragStart={(e) => handleInventoryDragStart(e, slot)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleInventorySlotDragOver(e, slot.slotIndex)}
                onDragLeave={handleInventorySlotDragLeave}
                onDrop={(e) => handleInventorySlotDrop(e, slot.slotIndex)}
                onPickItem={() => setInvItemPickerSlot(slot.slotIndex)}
                onUpdate={(desc) => handleInventoryUpdate(slot.slotIndex, desc)}
                onClear={() => handleInventoryClear(slot.slotIndex)}
              />
            ))}
          </div>
        </div>
      )}

        </div>{/* end sheet-col-right */}
      </div>{/* end sheet-body */}

      <div className="sheet-footer">
        <Link to="/">← Back to Characters</Link>
      </div>

      {pickerProps && (
        <PickerModal {...pickerProps} loading={busy} onClose={() => setPickerModal(null)} />
      )}

      {qualityPickerTarget && (
        <EquipmentQualityPickerModal
          target={qualityPickerTarget}
          equipment={equipment}
          qualities={getFilteredEquipmentQualities()}
          loading={qualitiesLoading}
          availableTags={getAvailableEquipmentFilterTags()}
          activeTagFilters={activeTagFilters}
          onToggleTag={(tag) =>
            setActiveTagFilters((prev) =>
              prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
            )
          }
          onToggle={toggleEquipmentQuality}
          onClose={closeEquipmentQualityPicker}
          busy={busy}
        />
      )}

      {invItemPickerSlot !== null && (
        <InventoryItemPickerModal
          slotIndex={invItemPickerSlot}
          characterId={id}
          token={auth.token}
          onSuccess={handleInvItemPickSuccess}
          onClose={() => setInvItemPickerSlot(null)}
        />
      )}

      {createEquipSlot !== null && (
        <EquipSlotCreateModal
          slot={createEquipSlot}
          characterId={id}
          token={auth.token}
          onSuccess={handleEquipSlotCreateSuccess}
          onClose={() => setCreateEquipSlot(null)}
        />
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

function Vital({ label, current, max, color, onChangeCurrent, onOpenPanel, disabled }) {
  const pct = max > 0 ? Math.min(100, (current / max) * 100) : 0;
  return (
    <div className={`vital ${disabled ? "vital-disabled" : ""}`}>
      <div className="vital-row">
        <span className="vital-label">{label}</span>
        <span
          className={`vital-value ${disabled ? "" : "vital-value-clickable"}`}
          onClick={disabled ? undefined : onOpenPanel}
          title={disabled ? undefined : `Manage ${label}`}
        >
          {current} / {max}
        </span>
      </div>
      <div
        className="vital-track"
        onClick={disabled ? undefined : onOpenPanel}
        style={{ cursor: disabled ? "default" : "pointer" }}
      >
        <div className="vital-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="vital-controls-below">
        <button className="vital-btn" onClick={() => !disabled && onChangeCurrent(-1)} disabled={disabled}>−</button>
        <button className="vital-btn" onClick={() => !disabled && onChangeCurrent(1)} disabled={disabled}>+</button>
      </div>
    </div>
  );
}

function VitalSimple({ label, display, onOpenPanel, onDec, onInc, disabled }) {
  return (
    <div className={`vital vital-simple ${disabled ? "vital-disabled" : ""}`}>
      <div className="vital-row">
        <span className="vital-label">{label}</span>
        <span
          className={`vital-value ${disabled ? "" : "vital-value-clickable"}`}
          onClick={disabled ? undefined : onOpenPanel}
          title={disabled ? undefined : `Manage ${label}`}
        >
          {display}
        </span>
      </div>
      <div className="vital-controls-below">
        <button className="vital-btn" onClick={onDec} disabled={disabled}>−</button>
        <button className="vital-btn" onClick={onInc} disabled={disabled}>+</button>
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

function InventorySlot({
  slot, unlocked, isDragging, isDragOver, isValidDropTarget,
  onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop,
  onPickItem, onUpdate, onClear,
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  const item = slot.weapon || slot.armor || slot.shield;
  const content = item?.name || slot.genericItemDescription || null;
  const isEquipment = !!item;
  const qualities = item?.qualities ?? [];
  const canDrag = !!(item || (unlocked && content));

  const startEdit = () => {
    if (isEquipment || unlocked) return;
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

  let slotClass = "inv-slot";
  if (isDragging) slotClass += " inv-slot-dragging";
  if (isDragOver) slotClass += " inv-slot-drag-over";
  if (isValidDropTarget && !isDragging) slotClass += " inv-slot-drop-valid";
  if (unlocked && canDrag) slotClass += " inv-slot-unlocked";

  return (
    <div
      className={slotClass}
      draggable={canDrag}
      onDragStart={canDrag ? onDragStart : undefined}
      onDragEnd={canDrag ? onDragEnd : undefined}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={!editing && !content ? (onPickItem ?? startEdit) : undefined}
    >
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
        <div className="inv-main">
          <span
            className={`inv-content${!content ? " inv-empty" : ""}`}
            onClick={content && !isEquipment && !unlocked ? startEdit : undefined}
          >
            {content || "empty"}
          </span>
          {qualities.length > 0 && (
            <div className="equip-sheet-qualities">
              {qualities.map((q) => (
                <span key={q.qualityId} className="equip-sheet-quality-badge">{q.name}</span>
              ))}
            </div>
          )}
        </div>
      )}
      {content && !editing && !unlocked && (
        <button className="inv-clear-btn" onClick={(e) => { e.stopPropagation(); onClear(); }} title="Clear slot">
          &times;
        </button>
      )}
    </div>
  );
}

const QUALITY_CATEGORY_TAGS = ["Weapon", "Armor", "Shield", "Focus"];

function EquipmentQualityList({ qualities, onRemove, onAdd, disabled }) {
  return (
    <div className="equip-sheet-quality-section">
      {qualities?.length > 0 && (
        <div className="equip-sheet-quality-cards">
          {qualities.map((q) => (
            <div key={q.qualityId} className="equip-sheet-quality-card">
              <div className="equip-sheet-quality-card-header">
                <strong>{q.name}</strong>
                <button
                  className="slot-remove"
                  onClick={() => onRemove(q.qualityId)}
                  disabled={disabled}
                  title="Remove quality"
                >
                  &times;
                </button>
              </div>
              {q.description && <p className="equip-sheet-quality-desc">{q.description}</p>}
              {q.tags?.filter((t) => !QUALITY_CATEGORY_TAGS.includes(t)).length > 0 && (
                <div className="quality-tag-row">
                  {q.tags
                    .filter((t) => !QUALITY_CATEGORY_TAGS.includes(t))
                    .map((t) => (
                      <span key={t} className="quality-tag-chip">{t}</span>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <button className="equip-add-quality-btn" onClick={onAdd} disabled={disabled}>
        + Add Quality
      </button>
    </div>
  );
}

function EquipmentQualityPickerModal({
  target,
  equipment,
  qualities,
  loading,
  availableTags,
  activeTagFilters,
  onToggleTag,
  onToggle,
  onClose,
  busy,
}) {
  let title = "Select Qualities";
  if (target.slot === "armor" && equipment?.armor) {
    title = `${equipment.armor.armorType?.name ?? "Armor"} Qualities`;
  } else if (equipment?.[target.slot]) {
    title = `${equipment[target.slot].weaponType?.name ?? "Weapon"} Qualities`;
  }

  const selectedIds =
    target.slot === "armor"
      ? (equipment?.armor?.qualities ?? []).map((q) => q.qualityId)
      : (equipment?.[target.slot]?.qualities ?? []).map((q) => q.qualityId);

  return (
    <PickerModal
      title={title}
      items={qualities}
      loading={loading}
      getId={(q) => q.qualityId}
      onSelect={onToggle}
      onClose={onClose}
      renderCardContent={(q) => {
        const isSelected = selectedIds.includes(q.qualityId);
        return (
          <div className={`quality-picker-card-inner${isSelected ? " quality-selected" : ""}`}>
            <div className="quality-picker-card-header">
              <strong>{q.name}</strong>
              {isSelected && <span className="quality-check-mark">&#10003;</span>}
            </div>
            {q.description && <p>{q.description}</p>}
            {q.tags?.filter((t) => !QUALITY_CATEGORY_TAGS.includes(t)).length > 0 && (
              <div className="quality-tag-row">
                {q.tags
                  .filter((t) => !QUALITY_CATEGORY_TAGS.includes(t))
                  .map((t) => (
                    <span key={t} className="quality-tag-chip">{t}</span>
                  ))}
              </div>
            )}
          </div>
        );
      }}
      tagFilter={
        availableTags.length > 0 ? (
          <div className="quality-tag-filter-bar">
            {availableTags.map((tag) => (
              <button
                key={tag}
                className={`quality-tag-filter-btn${activeTagFilters.includes(tag) ? " active" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleTag(tag);
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        ) : null
      }
      footer={
        <div className="quality-modal-footer">
          <span className="quality-modal-count muted">{selectedIds.length} selected</span>
          <button className="quality-accept-btn" onClick={onClose} disabled={busy}>
            Accept
          </button>
        </div>
      }
    />
  );
}

// ── Equip Slot Create Modal ───────────────────────────────────────────────────

function EquipSlotCreateModal({ slot, characterId, token, onSuccess, onClose }) {
  const category = slot === "armor" ? "armor" : "weapon";
  const slotLabel = slot === "mainHand" ? "Main Hand" : slot === "offHand" ? "Off Hand" : "Armor";

  const [types, setTypes] = useState([]);
  const [typesLoading, setTypesLoading] = useState(true);
  const [selectedTypeId, setSelectedTypeId] = useState(null);
  const [name, setName] = useState("");
  const [qualityIds, setQualityIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [qualityPickerOpen, setQualityPickerOpen] = useState(false);
  const [allQualities, setAllQualities] = useState([]);
  const [qualitiesLoading, setQualitiesLoading] = useState(false);
  const [activeTagFilters, setActiveTagFilters] = useState([]);

  useEffect(() => {
    const fn = category === "armor" ? getArmorTypes : getWeaponTypes;
    fn(token)
      .then((data) => setTypes(Array.isArray(data) ? data : []))
      .catch(() => setTypes([]))
      .finally(() => setTypesLoading(false));
  }, [category, token]);

  const selectedType = types.find((t) =>
    category === "weapon" ? t.weaponTypeId === selectedTypeId : t.armorTypeId === selectedTypeId
  );

  const openQualityPicker = () => {
    const tag = selectedType?.tag?.includes("FOCUS") ? "Focus" : category === "weapon" ? "Weapon" : "Armor";
    setQualitiesLoading(true);
    getQualities(token, [tag])
      .then((q) => setAllQualities(Array.isArray(q) ? q : []))
      .catch(() => setAllQualities([]))
      .finally(() => setQualitiesLoading(false));
    setQualityPickerOpen(true);
  };

  const filteredQualities = activeTagFilters.length === 0
    ? allQualities
    : allQualities.filter((q) => activeTagFilters.every((t) => q.tags?.includes(t)));

  const availableTags = (() => {
    const s = new Set();
    allQualities.forEach((q) => q.tags?.forEach((t) => s.add(t)));
    QUALITY_CATEGORY_TAGS.forEach((t) => s.delete(t));
    return [...s].sort();
  })();

  const toggleQuality = (qualityId) =>
    setQualityIds((prev) =>
      prev.includes(qualityId) ? prev.filter((id) => id !== qualityId) : [...prev, qualityId]
    );

  const handleSubmit = async () => {
    if (!selectedTypeId) return;
    setBusy(true);
    setError(null);
    try {
      let updatedEquip;
      if (category === "weapon") {
        const created = await createWeapon(token, characterId, {
          weaponTypeId: selectedTypeId,
          name: name.trim() || selectedType?.name || "",
          qualityIds,
        });
        if (slot === "mainHand") {
          updatedEquip = await equipMainHand(token, characterId, created.weaponInstanceId);
        } else {
          updatedEquip = await equipOffHandWeapon(token, characterId, created.weaponInstanceId);
        }
      } else {
        const created = await createArmor(token, characterId, {
          armorTypeId: selectedTypeId,
          name: name.trim() || selectedType?.name || "",
          qualityIds,
        });
        updatedEquip = await equipArmor(token, characterId, created.armorInstanceId);
      }
      onSuccess(updatedEquip);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="inv-item-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="inv-item-picker-header">
          <h2>New {category === "weapon" ? "Weapon" : "Armor"}</h2>
          <button className="picker-modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="inv-item-configure">
          {typesLoading ? (
            <p className="muted">Loading types...</p>
          ) : (
            <>
              <label className="inv-item-configure-label">Type</label>
              <div className="inv-type-grid">
                {types.map((t) => {
                  const typeId = category === "weapon" ? t.weaponTypeId : t.armorTypeId;
                  return (
                    <button
                      key={typeId}
                      className={`inv-type-card${selectedTypeId === typeId ? " selected" : ""}`}
                      onClick={() => setSelectedTypeId(typeId)}
                    >
                      <strong>{t.name}</strong>
                      {t.description && <span>{t.description}</span>}
                    </button>
                  );
                })}
              </div>

              <label className="inv-item-configure-label" style={{ marginTop: "0.9rem" }}>
                Custom name <span className="muted">(optional)</span>
              </label>
              <input
                className="inv-item-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={selectedType?.name ?? `e.g. My ${category === "weapon" ? "Weapon" : "Armor"}`}
              />

              <label className="inv-item-configure-label" style={{ marginTop: "0.9rem" }}>Qualities</label>
              <div className="equip-quality-row">
                {qualityIds.length > 0 && (
                  <div className="equip-quality-badges">
                    {qualityIds.map((qId) => {
                      const q = allQualities.find((x) => x.qualityId === qId);
                      return (
                        <span key={qId} className="equip-quality-badge">
                          {q?.name ?? `#${qId}`}
                          <button className="equip-quality-badge-remove" onClick={() => toggleQuality(qId)} title="Remove">&times;</button>
                        </span>
                      );
                    })}
                  </div>
                )}
                <button
                  className="equip-add-quality-btn"
                  onClick={openQualityPicker}
                  disabled={!selectedTypeId}
                >
                  + Qualities
                </button>
              </div>
            </>
          )}

          {error && <p className="error" style={{ marginTop: "0.5rem" }}>{error}</p>}

          <div className="inv-item-picker-footer">
            <button
              className="quality-accept-btn"
              onClick={handleSubmit}
              disabled={!selectedTypeId || busy}
            >
              {busy ? "Creating…" : `Equip ${slotLabel}`}
            </button>
          </div>
        </div>
      </div>

      {qualityPickerOpen && (
        <PickerModal
          title={`${selectedType?.name ?? ""} Qualities`}
          items={filteredQualities}
          loading={qualitiesLoading}
          getId={(q) => q.qualityId}
          onSelect={toggleQuality}
          onClose={() => { setQualityPickerOpen(false); setActiveTagFilters([]); }}
          renderCardContent={(q) => {
            const isSelected = qualityIds.includes(q.qualityId);
            return (
              <div className={`quality-picker-card-inner${isSelected ? " quality-selected" : ""}`}>
                <div className="quality-picker-card-header">
                  <strong>{q.name}</strong>
                  {isSelected && <span className="quality-check-mark">&#10003;</span>}
                </div>
                {q.description && <p>{q.description}</p>}
                {q.tags?.filter((t) => !QUALITY_CATEGORY_TAGS.includes(t)).length > 0 && (
                  <div className="quality-tag-row">
                    {q.tags.filter((t) => !QUALITY_CATEGORY_TAGS.includes(t)).map((t) => (
                      <span key={t} className="quality-tag-chip">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          }}
          tagFilter={
            availableTags.length > 0 ? (
              <div className="quality-tag-filter-bar">
                {availableTags.map((tag) => (
                  <button
                    key={tag}
                    className={`quality-tag-filter-btn${activeTagFilters.includes(tag) ? " active" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTagFilters((prev) =>
                        prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                      );
                    }}
                  >{tag}</button>
                ))}
              </div>
            ) : null
          }
          footer={
            <div className="quality-modal-footer">
              <span className="quality-modal-count muted">{qualityIds.length} selected</span>
              <button className="quality-accept-btn" onClick={() => { setQualityPickerOpen(false); setActiveTagFilters([]); }}>
                Accept
              </button>
            </div>
          }
        />
      )}
    </div>
  );
}

// ── Inventory Item Picker Modal ──────────────────────────────────────────────

function InventoryItemPickerModal({ slotIndex, characterId, token, onSuccess, onClose }) {
  const [step, setStep] = useState("category"); // 'category' | 'configure'
  const [category, setCategory] = useState(null); // 'weapon' | 'armor' | 'generic'
  const [types, setTypes] = useState([]);
  const [typesLoading, setTypesLoading] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState(null);
  const [name, setName] = useState("");
  const [genericDescription, setGenericDescription] = useState("");
  const [qualityIds, setQualityIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Quality picker
  const [qualityPickerOpen, setQualityPickerOpen] = useState(false);
  const [allQualities, setAllQualities] = useState([]);
  const [qualitiesLoading, setQualitiesLoading] = useState(false);
  const [activeTagFilters, setActiveTagFilters] = useState([]);

  const selectedType = types.find((t) =>
    category === "weapon" ? t.weaponTypeId === selectedTypeId : t.armorTypeId === selectedTypeId
  );

  const chooseCategory = (cat) => {
    setCategory(cat);
    if (cat === "generic") { setStep("configure"); return; }
    setTypesLoading(true);
    const fn = cat === "weapon" ? getWeaponTypes : getArmorTypes;
    fn(token)
      .then((data) => setTypes(Array.isArray(data) ? data : []))
      .catch(() => setTypes([]))
      .finally(() => { setTypesLoading(false); setStep("configure"); });
  };

  const openQualityPicker = () => {
    const tag = selectedType?.tag?.includes("FOCUS") ? "Focus" : category === "weapon" ? "Weapon" : "Armor";
    setQualitiesLoading(true);
    getQualities(token, [tag])
      .then((q) => setAllQualities(Array.isArray(q) ? q : []))
      .catch(() => setAllQualities([]))
      .finally(() => setQualitiesLoading(false));
    setQualityPickerOpen(true);
  };

  const filteredQualities = activeTagFilters.length === 0
    ? allQualities
    : allQualities.filter((q) => activeTagFilters.every((t) => q.tags?.includes(t)));

  const availableTags = (() => {
    const s = new Set();
    allQualities.forEach((q) => q.tags?.forEach((t) => s.add(t)));
    QUALITY_CATEGORY_TAGS.forEach((t) => s.delete(t));
    return [...s].sort();
  })();

  const toggleQuality = (qualityId) =>
    setQualityIds((prev) =>
      prev.includes(qualityId) ? prev.filter((id) => id !== qualityId) : [...prev, qualityId]
    );

  const canSubmit =
    category === "generic"
      ? genericDescription.trim().length > 0
      : !!selectedTypeId;

  const handleSubmit = async () => {
    setBusy(true);
    setError(null);
    try {
      let updateData;
      if (category === "generic") {
        updateData = { genericItemDescription: genericDescription.trim() };
      } else if (category === "weapon") {
        const created = await createWeapon(token, characterId, {
          weaponTypeId: selectedTypeId,
          name: name.trim() || selectedType?.name || "",
          qualityIds,
        });
        updateData = { weaponInstanceId: created.weaponInstanceId };
      } else {
        const created = await createArmor(token, characterId, {
          armorTypeId: selectedTypeId,
          name: name.trim() || selectedType?.name || "",
          qualityIds,
        });
        updateData = { armorInstanceId: created.armorInstanceId };
      }
      const updatedSlot = await updateInventorySlot(token, characterId, slotIndex, updateData);
      onSuccess(updatedSlot);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="inv-item-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="inv-item-picker-header">
          <h2>
            {step === "category" && `Slot ${slotIndex}`}
            {step === "configure" && category === "generic" && "Add Item"}
            {step === "configure" && category === "weapon" && "New Weapon"}
            {step === "configure" && category === "armor" && "New Armor"}
          </h2>
          <div className="inv-item-picker-header-actions">
            {step === "configure" && (
              <button className="inv-item-picker-back" onClick={() => { setStep("category"); setSelectedTypeId(null); setQualityIds([]); }}>
                ← Back
              </button>
            )}
            <button className="picker-modal-close" onClick={onClose}>&times;</button>
          </div>
        </div>

        {step === "category" && (
          <div className="inv-item-picker-categories">
            <button className="inv-item-picker-cat-card" onClick={() => chooseCategory("weapon")}>
              <strong>Weapon</strong>
              <span>Create a new weapon and place it here</span>
            </button>
            <button className="inv-item-picker-cat-card" onClick={() => chooseCategory("armor")}>
              <strong>Armor</strong>
              <span>Create a new armor piece and place it here</span>
            </button>
            <button className="inv-item-picker-cat-card" onClick={() => chooseCategory("generic")}>
              <strong>Generic Item</strong>
              <span>Write a custom description for any item</span>
            </button>
          </div>
        )}

        {step === "configure" && category === "generic" && (
          <div className="inv-item-configure">
            <label className="inv-item-configure-label">Description</label>
            <textarea
              className="inv-item-textarea"
              value={genericDescription}
              onChange={(e) => setGenericDescription(e.target.value)}
              placeholder="e.g. A sack of grain, 3 torches, rope..."
              rows={4}
              autoFocus
            />
          </div>
        )}

        {step === "configure" && (category === "weapon" || category === "armor") && (
          <div className="inv-item-configure">
            {typesLoading ? (
              <p className="muted">Loading types...</p>
            ) : (
              <>
                <label className="inv-item-configure-label">Type</label>
                <div className="inv-type-grid">
                  {types.map((t) => {
                    const typeId = category === "weapon" ? t.weaponTypeId : t.armorTypeId;
                    return (
                      <button
                        key={typeId}
                        className={`inv-type-card${selectedTypeId === typeId ? " selected" : ""}`}
                        onClick={() => setSelectedTypeId(typeId)}
                      >
                        <strong>{t.name}</strong>
                        {t.description && <span>{t.description}</span>}
                      </button>
                    );
                  })}
                </div>

                <label className="inv-item-configure-label" style={{ marginTop: "0.9rem" }}>
                  Custom name <span className="muted">(optional)</span>
                </label>
                <input
                  className="inv-item-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={selectedType?.name ?? `e.g. My ${category === "weapon" ? "Weapon" : "Armor"}`}
                />

                <label className="inv-item-configure-label" style={{ marginTop: "0.9rem" }}>Qualities</label>
                <div className="equip-quality-row">
                  {qualityIds.length > 0 && (
                    <div className="equip-quality-badges">
                      {qualityIds.map((qId) => {
                        const q = allQualities.find((x) => x.qualityId === qId);
                        return (
                          <span key={qId} className="equip-quality-badge">
                            {q?.name ?? `#${qId}`}
                            <button
                              className="equip-quality-badge-remove"
                              onClick={() => toggleQuality(qId)}
                              title="Remove"
                            >&times;</button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <button
                    className="equip-add-quality-btn"
                    onClick={openQualityPicker}
                    disabled={!selectedTypeId}
                  >
                    + Qualities
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {error && <p className="error" style={{ marginTop: "0.5rem" }}>{error}</p>}

        {step === "configure" && (
          <div className="inv-item-picker-footer">
            <button
              className="quality-accept-btn"
              onClick={handleSubmit}
              disabled={!canSubmit || busy}
            >
              {busy ? "Adding…" : "Add to Inventory"}
            </button>
          </div>
        )}
      </div>

      {qualityPickerOpen && (
        <PickerModal
          title={`${selectedType?.name ?? ""} Qualities`}
          items={filteredQualities}
          loading={qualitiesLoading}
          getId={(q) => q.qualityId}
          onSelect={toggleQuality}
          onClose={() => { setQualityPickerOpen(false); setActiveTagFilters([]); }}
          renderCardContent={(q) => {
            const isSelected = qualityIds.includes(q.qualityId);
            return (
              <div className={`quality-picker-card-inner${isSelected ? " quality-selected" : ""}`}>
                <div className="quality-picker-card-header">
                  <strong>{q.name}</strong>
                  {isSelected && <span className="quality-check-mark">&#10003;</span>}
                </div>
                {q.description && <p>{q.description}</p>}
                {q.tags?.filter((t) => !QUALITY_CATEGORY_TAGS.includes(t)).length > 0 && (
                  <div className="quality-tag-row">
                    {q.tags.filter((t) => !QUALITY_CATEGORY_TAGS.includes(t)).map((t) => (
                      <span key={t} className="quality-tag-chip">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          }}
          tagFilter={
            availableTags.length > 0 ? (
              <div className="quality-tag-filter-bar">
                {availableTags.map((tag) => (
                  <button
                    key={tag}
                    className={`quality-tag-filter-btn${activeTagFilters.includes(tag) ? " active" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTagFilters((prev) =>
                        prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                      );
                    }}
                  >{tag}</button>
                ))}
              </div>
            ) : null
          }
          footer={
            <div className="quality-modal-footer">
              <span className="quality-modal-count muted">{qualityIds.length} selected</span>
              <button className="quality-accept-btn" onClick={() => { setQualityPickerOpen(false); setActiveTagFilters([]); }}>
                Accept
              </button>
            </div>
          }
        />
      )}
    </div>
  );
}
