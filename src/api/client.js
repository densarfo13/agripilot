import axios from 'axios';
import { useAuthStore } from '../store/authStore.js';

// Detect native platform (Capacitor injects window.Capacitor on native)
const isNative = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform === true;

// On native (Android/iOS), API calls must go to the live server.
// On web, relative '/api' works via Vite proxy or Express production serving.
const API_BASE = isNative
  ? 'http://10.0.0.63:4000/api'
  : '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
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
