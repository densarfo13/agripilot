const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

async function parseJson(res) {
  let data = null;

  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const err = new Error(data?.error || 'Request failed');
    err.status = res.status;
    err.fieldErrors = data?.fieldErrors || {};
    throw err;
  }

  return data;
}

async function request(path, options = {}, allowRefresh = true) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (res.status === 401 && allowRefresh) {
    const refreshRes = await fetch(`${API_BASE}/api/v2/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    if (refreshRes.ok) {
      return request(path, options, false);
    }
  }

  return parseJson(res);
}

export function registerUser(payload) {
  return request('/api/v2/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function loginUser(payload) {
  return request('/api/v2/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function logoutUser() {
  return request('/api/v2/auth/logout', {
    method: 'POST',
  }, false);
}

export function getCurrentUser() {
  return request('/api/v2/auth/me');
}

export function verifyEmail(token) {
  return request('/api/v2/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  }, false);
}

export function resendVerification() {
  return request('/api/v2/auth/resend-verification', {
    method: 'POST',
  });
}

export function forgotPassword(payload) {
  return request('/api/v2/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, false);
}

export function resetPassword(payload) {
  return request('/api/v2/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, false);
}

export function getFarmProfile() {
  return request('/api/v2/farm-profile');
}

export function saveFarmProfile(payload) {
  return request('/api/v2/farm-profile', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getCurrentWeather(lat, lng) {
  return request(`/api/v2/weather/current?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`);
}

export function healthCheck() {
  return request('/api/v2/monitoring/health', { method: 'GET' }, false);
}
