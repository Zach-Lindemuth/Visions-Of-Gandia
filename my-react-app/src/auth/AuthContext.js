import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { refreshToken as refreshTokenApi, logoutUser } from "../api/authApi";

const AuthContext = createContext(null);

const ACTIVITY_WINDOW_MS = 5 * 60 * 1000;  // 5 minutes
const REFRESH_CHECK_INTERVAL_MS = 30 * 1000; // check every 30 seconds
const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000; // refresh 5 min before expiry

export function AuthProvider({ children }) {
  // auth is stored in memory only — never in localStorage or sessionStorage
  const [auth, setAuth] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const lastActivityRef = useRef(Date.now());
  const authRef = useRef(auth);
  authRef.current = auth;

  // Track user activity (mouse, keyboard, touch)
  useEffect(() => {
    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };
    window.addEventListener("mousemove", updateActivity, { passive: true });
    window.addEventListener("keydown", updateActivity, { passive: true });
    window.addEventListener("click", updateActivity, { passive: true });
    window.addEventListener("scroll", updateActivity, { passive: true });
    window.addEventListener("touchstart", updateActivity, { passive: true });
    return () => {
      window.removeEventListener("mousemove", updateActivity);
      window.removeEventListener("keydown", updateActivity);
      window.removeEventListener("click", updateActivity);
      window.removeEventListener("scroll", updateActivity);
      window.removeEventListener("touchstart", updateActivity);
    };
  }, []);

  // Attempt to restore session from HttpOnly refresh token cookie on mount
  useEffect(() => {
    refreshTokenApi()
      .then((data) => {
        setAuth({
          userId: data.userId,
          username: data.username,
          roleName: data.roleName,
          isActive: true,
          token: data.token,
          tokenExpiresAt: new Date(data.tokenExpiresAt),
        });
      })
      .catch(() => {
        // No valid session — user must log in
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // Proactive token refresh: runs every 30s, refreshes only if token is expiring
  // soon AND the user has been active in the last 5 minutes
  useEffect(() => {
    if (!auth) return;

    const intervalId = setInterval(async () => {
      const currentAuth = authRef.current;
      if (!currentAuth) return;

      const now = Date.now();
      const expiresAt = new Date(currentAuth.tokenExpiresAt).getTime();
      const msUntilExpiry = expiresAt - now;
      const userIsActive = now - lastActivityRef.current < ACTIVITY_WINDOW_MS;

      if (msUntilExpiry < REFRESH_BEFORE_EXPIRY_MS && userIsActive) {
        try {
          const data = await refreshTokenApi();
          setAuth((prev) =>
            prev
              ? { ...prev, token: data.token, tokenExpiresAt: new Date(data.tokenExpiresAt) }
              : null
          );
        } catch {
          // Refresh failed — let the token expire naturally.
          // The unauthorized event handler will redirect if the user acts.
        }
      }
    }, REFRESH_CHECK_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [auth?.tokenExpiresAt]); // Reset timer only when expiry changes

  // Handle 401 responses from API calls: attempt refresh, fall back to logout
  useEffect(() => {
    const handleUnauthorized = async () => {
      try {
        const data = await refreshTokenApi();
        setAuth((prev) =>
          prev
            ? { ...prev, token: data.token, tokenExpiresAt: new Date(data.tokenExpiresAt) }
            : null
        );
      } catch {
        // Refresh token is expired or invalid — force re-login
        setAuth(null);
      }
    };

    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, []);

  const login = useCallback((authData) => {
    setAuth({
      userId: authData.userId,
      username: authData.username,
      roleName: authData.roleName,
      isActive: authData.isActive,
      token: authData.token,
      tokenExpiresAt: new Date(authData.tokenExpiresAt),
    });
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutUser(); // revokes refresh token server-side and clears cookie
    } catch {
      // best-effort
    }
    setAuth(null);
  }, []);

  return (
    <AuthContext.Provider value={{ auth, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
