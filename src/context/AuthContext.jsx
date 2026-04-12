import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
  resendVerification,
} from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  async function bootstrap() {
    try {
      const data = await getCurrentUser();
      setUser(data.user || null);
    } catch {
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  }

  useEffect(() => {
    bootstrap();
  }, []);

  async function login(payload) {
    const data = await loginUser(payload);
    setUser(data.user || null);
    return data;
  }

  async function register(payload) {
    const data = await registerUser(payload);
    setUser(data.user || null);
    return data;
  }

  async function logout() {
    await logoutUser().catch(() => {});
    setUser(null);
  }

  async function resendEmailVerification() {
    return resendVerification();
  }

  const value = useMemo(
    () => ({
      user,
      authLoading,
      isAuthenticated: !!user,
      login,
      register,
      logout,
      bootstrap,
      resendEmailVerification,
    }),
    [user, authLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
