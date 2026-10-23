import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Redirect, useLocation } from "wouter";

import { api, setUnauthorizedHandler, tokenStore } from "./client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      const me = await api("/auth/me");
      setUser(me);
      return me;
    } catch (e) {
      if (e.status === 401) logout();
      return null;
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    // An expired or revoked session drops all client state and sends the user to sign in.
    setUnauthorizedHandler(() => {
      logout();
      const here = window.location.pathname + window.location.search;
      if (!here.startsWith("/login")) window.location.assign(`/login?next=${encodeURIComponent(here)}`);
    });
    if (!tokenStore.get()) return; // `loading` already starts false without a token
    api("/auth/me")
      .then(setUser)
      .catch((e) => e.status === 401 && logout())
      .finally(() => setLoading(false));
  }, [logout]);

  const signIn = useCallback(async (mode, payload) => {
    const r = await api(mode === "register" ? "/auth/register" : "/auth/login", { method: "POST", json: payload });
    tokenStore.set(r.access_token);
    setUser(r.user);
    return r.user;
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, logout, refresh, setUser }),
    [user, loading, signIn, logout, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export function PageLoader() {
  return (
    <div role="status" className="grid min-h-[60svh] place-items-center text-[15px] text-muted">
      Loading…
    </div>
  );
}

/** Gate a page behind sign-in (and optionally the admin role). */
export function Protected({ admin = false, children }) {
  const { user, loading } = useAuth();
  const [location] = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Redirect to={`/login?next=${encodeURIComponent(location + window.location.search)}`} />;
  if (admin && user.role !== "admin") return <Redirect to="/app" />;
  return children;
}
