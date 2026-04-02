export const API_BASE = process.env.REACT_APP_API_BASE_URL;

export function authHeaders(token) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function handleResponse(res) {
  if (!res.ok) {
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    }
    // Surface a safe, generic message — never forward raw server text to the UI
    const status = res.status;
    let message;
    if (status === 400) message = "Invalid request.";
    else if (status === 403) message = "You don't have permission to do that.";
    else if (status === 404) message = "Not found.";
    else if (status === 409) message = "Conflict — please refresh and try again.";
    else if (status === 429) message = "Too many requests — please wait a moment.";
    else message = "Something went wrong. Please try again.";

    const error = new Error(message);
    error.status = status;
    throw error;
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
