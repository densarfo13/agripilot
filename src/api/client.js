import axios from 'axios';
import { useAuthStore } from '../store/authStore.js';

// Detect native platform: Capacitor injects window.Capacitor on native
// isNativePlatform can be a function (returns bool) or a boolean depending on version
const cap = typeof window !== 'undefined' && window.Capacitor;
const isNative = cap && (typeof cap.isNativePlatform === 'function' ? cap.isNativePlatform() : !!cap.isNativePlatform);

// On native (Android/iOS), API calls must go to the server's full URL.
// On web, relative '/api' works via Vite proxy or Express production serving.
// VITE_API_URL can be set at build time for native or custom deployments.
const API_BASE = isNative
  ? (import.meta.env.VITE_API_URL || 'https://agripilot.onrender.com/api')
  : (import.meta.env.VITE_API_URL || '/api');

// Simple UUID v4 generator for idempotency keys (no crypto dependency needed)
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach token + idempotency key to every mutation request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Auto-attach idempotency key for mutation requests (POST/PUT/PATCH)
  // Enables safe retry on network failures
  if (['post', 'put', 'patch'].includes(config.method)) {
    if (!config.headers['X-Idempotency-Key']) {
      config.headers['X-Idempotency-Key'] = generateId();
    }
  }
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default api;
