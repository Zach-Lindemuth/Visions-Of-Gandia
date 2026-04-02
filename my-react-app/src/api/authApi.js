import { API_BASE } from "./apiClient";

export async function loginUser(username, password) {
  const response = await fetch(`${API_BASE}/authentication/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    credentials: "include",
  });

  if (!response.ok) {
    let message = "Invalid username or password";
    if (response.status === 403) {
      message = "Account pending approval";
    }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

export async function registerUser(username, password, email) {
  const response = await fetch(`${API_BASE}/authentication/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, email }),
  });

  if (response.status === 400) {
    const error = new Error("Username already exists");
    error.status = response.status;
    throw error;
  }

  if (!response.ok) {
    const error = new Error("Failed to create account");
    error.status = response.status;
    throw error;
  }
}

export async function refreshToken() {
  const response = await fetch(`${API_BASE}/authentication/refresh`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    const error = new Error("Session expired");
    error.status = response.status;
    throw error;
  }

  return response.json(); // { token, tokenExpiresAt, userId, username, roleName }
}

export async function logoutUser() {
  await fetch(`${API_BASE}/authentication/logout`, {
    method: "POST",
    credentials: "include",
  });
}

export async function refreshWithRetry() {
  try {
    return await refreshToken();
  } catch (err) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return await refreshToken();
  }
}
