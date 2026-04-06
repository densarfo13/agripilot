import { create } from 'zustand';

function safeParseUser() {
  try {
    const raw = localStorage.getItem('agripilot_user');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Basic sanity check — user must have at least id and role
    if (parsed && typeof parsed === 'object' && parsed.role) return parsed;
    return null;
  } catch {
    localStorage.removeItem('agripilot_user');
    return null;
  }
}

export const useAuthStore = create((set) => ({
  user: safeParseUser(),
  token: localStorage.getItem('agripilot_token') || null,

  setAuth: (user, token) => {
    localStorage.setItem('agripilot_user', JSON.stringify(user));
    localStorage.setItem('agripilot_token', token);
    set({ user, token });
  },

  logout: () => {
    localStorage.removeItem('agripilot_user');
    localStorage.removeItem('agripilot_token');
    set({ user: null, token: null });
  },
}));
