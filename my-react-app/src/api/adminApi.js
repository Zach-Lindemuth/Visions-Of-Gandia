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

// ── Talents ──────────────────────────────────────────────
export async function createTalent(token, data) {
  const res = await fetch(`${API_BASE}/talents`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function updateTalent(token, data) {
  const res = await fetch(`${API_BASE}/talents`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function deleteTalent(token, id) {
  const res = await fetch(`${API_BASE}/talents/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  return handleResponse(res);
}

// ── Arcana ───────────────────────────────────────────────
export async function createArcana(token, data) {
  const res = await fetch(`${API_BASE}/arcana`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function updateArcana(token, data) {
  const res = await fetch(`${API_BASE}/arcana`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function deleteArcana(token, id) {
  const res = await fetch(`${API_BASE}/arcana/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  return handleResponse(res);
}

// ── Techniques ───────────────────────────────────────────
export async function createTechnique(token, data) {
  const res = await fetch(`${API_BASE}/techniques`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function updateTechnique(token, data) {
  const res = await fetch(`${API_BASE}/techniques`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function deleteTechnique(token, id) {
  const res = await fetch(`${API_BASE}/techniques/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  return handleResponse(res);
}

// ── Origins ──────────────────────────────────────────────
export async function createOrigin(token, data) {
  const res = await fetch(`${API_BASE}/origins`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function updateOrigin(token, data) {
  const res = await fetch(`${API_BASE}/origins`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function deleteOrigin(token, id) {
  const res = await fetch(`${API_BASE}/origins/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  return handleResponse(res);
}

// ── Users ────────────────────────────────────────────────
export async function getUsers(token) {
  const res = await fetch(`${API_BASE}/users`, { headers: authHeaders(token) });
  return handleResponse(res);
}

export async function setUserActive(token, userId, isActive) {
  const res = await fetch(`${API_BASE}/users/${userId}/status`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ isActive }),
  });
  return handleResponse(res);
}

// ── Visions ──────────────────────────────────────────────
export async function createVision(token, data) {
  const res = await fetch(`${API_BASE}/visions`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function updateVision(token, data) {
  const res = await fetch(`${API_BASE}/visions`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function deleteVision(token, id) {
  const res = await fetch(`${API_BASE}/visions/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  return handleResponse(res);
}
