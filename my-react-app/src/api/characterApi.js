const API_BASE = "https://localhost:7175/api";

function authHeaders(token) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function handleResponse(res) {
  if (!res.ok) {
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    }
    const text = await res.text();
    const error = new Error(text || `HTTP ${res.status}`);
    error.status = res.status;
    throw error;
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ── Characters ──────────────────────────────────────────
export async function getCharacters(token) {
  const res = await fetch(`${API_BASE}/characters/summaries`, { headers: authHeaders(token) });
  return handleResponse(res);
}

export async function getCharacterById(token, characterId) {
  const res = await fetch(`${API_BASE}/characters/${characterId}`, { headers: authHeaders(token) });
  return handleResponse(res);
}

export async function createCharacter(token, data) {
  const res = await fetch(`${API_BASE}/characters/create`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function deleteCharacter(token, characterId) {
  const res = await fetch(`${API_BASE}/characters/${characterId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  return handleResponse(res);
}

export async function updateCharacter(token, characterId, data) {
  const res = await fetch(`${API_BASE}/characters/${characterId}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

// ── Reference data ───────────────────────────────────────
export async function getTalents(token) {
  const res = await fetch(`${API_BASE}/talents`, { headers: authHeaders(token) });
  return handleResponse(res);
}

export async function getArcana(token) {
  const res = await fetch(`${API_BASE}/arcana`, { headers: authHeaders(token) });
  return handleResponse(res);
}

export async function getTechniques(token) {
  const res = await fetch(`${API_BASE}/techniques`, { headers: authHeaders(token) });
  return handleResponse(res);
}

export async function getOrigins(token) {
  const res = await fetch(`${API_BASE}/origins`, { headers: authHeaders(token) });
  return handleResponse(res);
}

export async function getVisions(token) {
  const res = await fetch(`${API_BASE}/visions`, { headers: authHeaders(token) });
  return handleResponse(res);
}

export async function getWeaponTypes(token) {
  const res = await fetch(`${API_BASE}/equipment-types/weapons`, { headers: authHeaders(token) });
  return handleResponse(res);
}

export async function getArmorTypes(token) {
  const res = await fetch(`${API_BASE}/equipment-types/armor`, { headers: authHeaders(token) });
  return handleResponse(res);
}

// ── Character associations ───────────────────────────────
export async function addTalentToCharacter(token, characterId, talentId) {
  const res = await fetch(`${API_BASE}/characters/${characterId}/talents/${talentId}`, {
    method: "POST",
    headers: authHeaders(token),
  });
  return handleResponse(res);
}

export async function addArcanaToCharacter(token, characterId, arcanaId) {
  const res = await fetch(`${API_BASE}/characters/${characterId}/arcana/${arcanaId}`, {
    method: "POST",
    headers: authHeaders(token),
  });
  return handleResponse(res);
}

export async function addTechniqueToCharacter(token, characterId, techniqueId) {
  const res = await fetch(`${API_BASE}/characters/${characterId}/techniques/${techniqueId}`, {
    method: "POST",
    headers: authHeaders(token),
  });
  return handleResponse(res);
}

export async function setCharacterOrigin(token, characterId, { descriptor, profession }) {
  const res = await fetch(`${API_BASE}/characters/${characterId}/origin`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ descriptor, profession }),
  });
  return handleResponse(res);
}

export async function addVisionToCharacter(token, characterId, visionId) {
  const res = await fetch(`${API_BASE}/characters/${characterId}/visions/${visionId}`, {
    method: "POST",
    headers: authHeaders(token),
  });
  return handleResponse(res);
}

// ── Remove associations ─────────────────────────────────
export async function removeTalentFromCharacter(token, characterId, talentId) {
  const res = await fetch(`${API_BASE}/characters/${characterId}/talents/${talentId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  return handleResponse(res);
}

export async function removeArcanaFromCharacter(token, characterId, arcanaId) {
  const res = await fetch(`${API_BASE}/characters/${characterId}/arcana/${arcanaId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  return handleResponse(res);
}

export async function removeTechniqueFromCharacter(token, characterId, techniqueId) {
  const res = await fetch(`${API_BASE}/characters/${characterId}/techniques/${techniqueId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  return handleResponse(res);
}

// ── Qualities ────────────────────────────────────────────
export async function getQualities(token, tags = []) {
  const params = new URLSearchParams();
  tags.forEach((t) => params.append("tags", t));
  const query = params.toString();
  const url = query ? `${API_BASE}/qualities?${query}` : `${API_BASE}/qualities`;
  const res = await fetch(url, { headers: authHeaders(token) });
  return handleResponse(res);
}

// ── Equipment ────────────────────────────────────────────
export async function createWeapon(token, characterId, data) {
  const res = await fetch(`${API_BASE}/characters/${characterId}/weapons`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function createArmor(token, characterId, data) {
  const res = await fetch(`${API_BASE}/characters/${characterId}/armor`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function getCharacterEquipment(token, characterId) {
  const res = await fetch(`${API_BASE}/characters/${characterId}/equipment`, {
    headers: authHeaders(token),
  });
  return handleResponse(res);
}

export async function getCharacterInventory(token, characterId) {
  const res = await fetch(`${API_BASE}/characters/${characterId}/inventory`, {
    headers: authHeaders(token),
  });
  return handleResponse(res);
}

export async function updateInventorySlot(token, characterId, slotIndex, data) {
  const res = await fetch(`${API_BASE}/characters/${characterId}/inventory/${slotIndex}`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function clearInventorySlot(token, characterId, slotIndex) {
  const res = await fetch(`${API_BASE}/characters/${characterId}/inventory/${slotIndex}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  return handleResponse(res);
}

export async function equipMainHand(token, characterId, weaponInstanceId) {
  const res = await fetch(`${API_BASE}/characters/${characterId}/equipment/main-hand`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({ weaponInstanceId }),
  });
  return handleResponse(res);
}

export async function equipArmor(token, characterId, armorInstanceId) {
  const res = await fetch(`${API_BASE}/characters/${characterId}/equipment/armor`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({ armorInstanceId }),
  });
  return handleResponse(res);
}

export async function addQualityToWeapon(token, characterId, weaponId, qualityId) {
  const res = await fetch(`${API_BASE}/characters/${characterId}/weapons/${weaponId}/qualities/${qualityId}`, {
    method: "POST",
    headers: authHeaders(token),
  });
  return handleResponse(res);
}

export async function removeQualityFromWeapon(token, characterId, weaponId, qualityId) {
  const res = await fetch(`${API_BASE}/characters/${characterId}/weapons/${weaponId}/qualities/${qualityId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  return handleResponse(res);
}

export async function addQualityToArmor(token, characterId, armorId, qualityId) {
  const res = await fetch(`${API_BASE}/characters/${characterId}/armor/${armorId}/qualities/${qualityId}`, {
    method: "POST",
    headers: authHeaders(token),
  });
  return handleResponse(res);
}

export async function removeQualityFromArmor(token, characterId, armorId, qualityId) {
  const res = await fetch(`${API_BASE}/characters/${characterId}/armor/${armorId}/qualities/${qualityId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  return handleResponse(res);
}

export async function equipOffHandWeapon(token, characterId, weaponInstanceId) {
  const res = await fetch(`${API_BASE}/characters/${characterId}/equipment/off-hand/weapon`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({ weaponInstanceId }),
  });
  return handleResponse(res);
}

export async function unequipSlot(token, characterId, slot) {
  const res = await fetch(`${API_BASE}/characters/${characterId}/equipment/${slot}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  return handleResponse(res);
}

export async function deleteWeapon(token, characterId, weaponId) {
  const res = await fetch(`${API_BASE}/characters/${characterId}/weapons/${weaponId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  return handleResponse(res);
}

export async function deleteArmor(token, characterId, armorId) {
  const res = await fetch(`${API_BASE}/characters/${characterId}/armor/${armorId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  return handleResponse(res);
}

export async function batchSetInventory(token, characterId, slots) {
  const res = await fetch(`${API_BASE}/characters/${characterId}/inventory`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({ slots }),
  });
  return handleResponse(res);
}
