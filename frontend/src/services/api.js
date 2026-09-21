let csrf = '';

export async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method: options.method || 'GET',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: 'no-store',
    });
  } catch {
    throw new Error('Cannot reach the inventory server. Check your connection and try again.');
  }
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && path !== '/auth/login' && path !== '/auth/me') {
    window.dispatchEvent(new CustomEvent('inventory:session-expired'));
  }
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  if (data.csrf) csrf = data.csrf;
  return data;
}

export function clearCsrf() { csrf = ''; }
