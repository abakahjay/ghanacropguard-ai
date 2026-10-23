import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { api, loadSession, setToken, setUnauthorizedHandler } from "./api";

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);

  const signOut = useCallback(async () => {
    await setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void signOut();
    });
    (async () => {
      const t = await loadSession();
      if (t) {
        try {
          setUser(await api("/auth/me"));
        } catch {
          // offline at launch: keep the token, the user sees an offline banner and can retry
        }
      }
      setReady(true);
    })();
  }, [signOut]);

  const value = useMemo(
    () => ({
      ready,
      user,
      signOut,
      signIn: async (email, password) => {
        const r = await api("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
        await setToken(r.access_token);
        setUser(r.user);
      },
      register: async (p) => {
        const r = await api("/auth/register", { method: "POST", body: JSON.stringify(p) });
        await setToken(r.access_token);
        setUser(r.user);
      },
      refresh: async () => setUser(await api("/auth/me")),
    }),
    [ready, user, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
