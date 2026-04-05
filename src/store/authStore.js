import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('agripilot_user') || 'null'),
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
