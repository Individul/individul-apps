const API_BASE = (import.meta.env.BASE_URL || '/') + 'api';

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('monitor_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (res.status === 401) {
    localStorage.removeItem('monitor_token');
    window.location.href = import.meta.env.BASE_URL + 'login';
    throw new Error('Neautorizat');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }

  // Handle CSV export (non-JSON)
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('text/csv')) {
    return res;
  }

  return res.json();
}

export async function login(password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Eroare' }));
    throw new Error(err.error || 'Eroare la autentificare');
  }

  const data = await res.json();
  localStorage.setItem('monitor_token', data.token);
  return data;
}

export async function checkAuth() {
  const token = localStorage.getItem('monitor_token');
  if (!token) return false;

  try {
    const res = await fetch(`${API_BASE}/auth/check`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function logout() {
  const token = localStorage.getItem('monitor_token');
  if (token) {
    fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    }).catch(() => {});
  }
  localStorage.removeItem('monitor_token');
}
