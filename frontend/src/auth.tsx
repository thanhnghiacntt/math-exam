import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setUnauthorizedHandler, tokenStore } from './api';
import type { Stats, User } from './types';

interface AuthCtx {
  user: User | null;
  ready: boolean;
  pending: number; // số yêu cầu chờ duyệt (admin)
  login: (token: string, user: User) => void;
  logout: () => void;
  setUser: (u: User) => void;
  refreshPending: () => void;
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(0);

  const logout = useCallback(() => {
    tokenStore.set(null);
    setUser(null);
    setPending(0);
  }, []);

  const refreshPending = useCallback(() => {
    api.get<Stats>('/admin/stats').then((s) => setPending(s.pending)).catch(() => {});
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    if (!tokenStore.get()) { setReady(true); return; }
    api.get<User>('/auth/me')
      .then(setUser)
      .catch(() => tokenStore.set(null))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') refreshPending();
  }, [user, refreshPending]);

  const login = (token: string, u: User) => { tokenStore.set(token); setUser(u); };

  return (
    <Ctx.Provider value={{ user, ready, pending, login, logout, setUser, refreshPending }}>
      {children}
    </Ctx.Provider>
  );
}
