const API_BASE = "https://localhost:7175/api"; // change as needed

export async function loginUser(username, password) {
  const response = await fetch(`${API_BASE}/authentication/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
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
  // expected: { userId, role, token }
}

export async function registerUser(username, password, email) {
  const response = await fetch(`${API_BASE}/authentication/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, email })
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

  return;
}