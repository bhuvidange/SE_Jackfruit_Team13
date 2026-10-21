import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { clearToken, getToken, setToken } from '../utils/tokenStore';

export const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const AuthContext = createContext(null);

async function authRequest(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(() => getToken());
  const [loading, setLoading] = useState(Boolean(getToken()));

  // Restore the session from a stored token.
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    authRequest('/auth/me', { token })
      .then((data) => active && setUser(data.user))
      .catch(() => {
        clearToken();
        if (active) {
          setTokenState(null);
          setUser(null);
        }
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // Only on first load; login/register set the user directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = useCallback((data) => {
    setToken(data.token);
    setTokenState(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const login = useCallback(
    async (email, password) => finish(await authRequest('/auth/login', { method: 'POST', body: { email, password } })),
    [finish]
  );

  const register = useCallback(
    async (fields) => finish(await authRequest('/auth/register', { method: 'POST', body: fields })),
    [finish]
  );

  const logout = useCallback(() => {
    clearToken();
    setTokenState(null);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, token, loading, login, register, logout }), [user, token, loading, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
