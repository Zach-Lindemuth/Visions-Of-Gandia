import { API_BASE, authHeaders, handleResponse } from "./apiClient";

export async function getRoomCharacter(token, roomId, characterId) {
  const res = await fetch(`${API_BASE}/rooms/${roomId}/characters/${characterId}`, {
    headers: authHeaders(token),
  });
  return handleResponse(res);
}

export async function updateRoomCharacterStats(token, roomId, characterId, stats) {
  const res = await fetch(`${API_BASE}/rooms/${roomId}/characters/${characterId}/stats`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(stats),
  });
  return handleResponse(res);
}
