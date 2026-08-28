const API_BASE = window.location.hostname === 'localhost' && window.location.port === '3000'
  ? ''
  : 'http://localhost:3000';

const MAX_RETRIES = 10;
const RETRY_DELAY = 2000;

async function fetchWithRetry(url: string, options?: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  try {
    const res = await fetch(url, options);
    return res;
  } catch (err) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw err;
  }
}

export async function api(path: string, options?: RequestInit): Promise<Response> {
  return fetchWithRetry(`${API_BASE}${path}`, options);
}

export async function apiJson<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await api(path, options);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}
