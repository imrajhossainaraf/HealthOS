"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { authApi, storeApi, getToken, setToken } from "@/lib/api";
import { writeStorage, readStorage, migrateStorage } from "@/lib/storage";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | authed | guest

  // Pull every server document into the local store (server wins on login).
  const hydrate = useCallback(async () => {
    try {
      const { documents } = await storeApi.getAll();
      for (const [key, value] of Object.entries(documents || {})) {
        writeStorage(key, value);
      }
    } catch {
      /* offline — keep working from local cache */
    }
  }, []);

  // Restore session on mount.
  useEffect(() => {
    let cancelled = false;
    migrateStorage();
    (async () => {
      const token = getToken();
      if (!token) {
        if (!cancelled) setStatus("guest");
        return;
      }
      try {
        const { user: me } = await authApi.me();
        if (cancelled) return;
        setUser(me);
        setStatus("authed");
        await hydrate();
      } catch {
        setToken(null);
        if (!cancelled) setStatus("guest");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrate]);

  // Sync bridge: while authed, push every local document change up to the server.
  useEffect(() => {
    if (status !== "authed") return;
    const timers = new Map();
    const onChange = (e) => {
      const key = e?.detail?.key;
      if (!key || !key.startsWith("healthos:") || key === "healthos:token" || key === "healthos:lastCoords") return;
      clearTimeout(timers.get(key));
      timers.set(
        key,
        setTimeout(() => {
          storeApi.put(key, readStorage(key, null)).catch(() => {});
        }, 600)
      );
    };
    window.addEventListener("healthos:storage", onChange);
    return () => {
      window.removeEventListener("healthos:storage", onChange);
      timers.forEach(clearTimeout);
    };
  }, [status]);

  // Promote a freshly issued token into an active session (shared by login,
  // OTP verification, and the OAuth redirect).
  const establishSession = useCallback(
    async (token, u) => {
      setToken(token);
      const me = u || (await authApi.me()).user;
      setUser(me);
      setStatus("authed");
      await hydrate();
      return me;
    },
    [hydrate]
  );

  const login = useCallback(
    async (email, password) => {
      const { token, user: u } = await authApi.login({ email, password });
      return establishSession(token, u);
    },
    [establishSession]
  );

  // Registration now begins email verification; it does NOT sign the user in.
  // Returns { pendingVerification, email, devCode? }.
  const register = useCallback(
    (email, password, name, phone) =>
      authApi.register({ email, password, name, phone }),
    []
  );

  // Confirm the emailed code → completes the session.
  const verifyOtp = useCallback(
    async (email, code) => {
      const { token, user: u } = await authApi.verifyOtp({ email, code });
      return establishSession(token, u);
    },
    [establishSession]
  );

  const resendOtp = useCallback((email) => authApi.resendOtp(email), []);

  // Used by the Google OAuth redirect (?token=...).
  const loginWithToken = useCallback(
    (token) => establishSession(token),
    [establishSession]
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setStatus("guest");
    // Local data stays on the device; it simply stops syncing.
  }, []);

  const value = { user, status, login, register, verifyOtp, resendOtp, loginWithToken, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
