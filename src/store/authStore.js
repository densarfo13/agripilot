import { create } from 'zustand';

function safeParseUser() {
  try {
    const raw = localStorage.getItem('farroway_user');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Basic sanity check — user must have at least id and role
    if (parsed && typeof parsed === 'object' && parsed.role) return parsed;
    return null;
  } catch {
    localStorage.removeItem('farroway_user');
    return null;
  }
}

export const useAuthStore = create((set) => ({
  user: safeParseUser(),
  token: localStorage.getItem('farroway_token') || null,
  // Set to true when a 401 STEP_UP_REQUIRED is received — renders StepUpModal globally
  stepUpRequired: false,

  setAuth: (user, token) => {
    localStorage.setItem('farroway_user', JSON.stringify(user));
    localStorage.setItem('farroway_token', token);
    set({ user, token });
  },

  logout: () => {
    localStorage.removeItem('farroway_user');
    localStorage.removeItem('farroway_token');
    set({ user: null, token: null, stepUpRequired: false });
  },

  setStepUpRequired: (val) => set({ stepUpRequired: val }),
}));
