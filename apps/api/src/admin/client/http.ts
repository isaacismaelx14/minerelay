export type RequestMethod = 'GET' | 'POST' | 'PATCH';

export async function readError(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const text = await response.text();
    return text || fallback;
  } catch {
    return fallback;
  }
}

function readCookie(name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^| )${escaped}=([^;]+)`));
  if (!match || !match[1]) {
    return null;
  }

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  retried = false,
): Promise<Response> {
  const headers = new Headers(init.headers ?? {});
  const csrf = readCookie('mvl_admin_csrf');
  if (csrf) {
    headers.set('x-csrf-token', csrf);
  }

  const response = await fetch(input, {
    ...init,
    credentials: 'include',
    headers,
  });

  if (response.status !== 401 || retried) {
    return response;
  }

  const refresh = await fetch('/v1/admin/auth/refresh', {
    method: 'POST',
    credentials: 'include',
  });

  if (!refresh.ok) {
    window.location.href = '/admin/login';
    throw new Error('Session expired');
  }

  return authFetch(input, init, true);
}

export async function requestJson<T>(
  url: string,
  method: RequestMethod,
  body?: unknown,
): Promise<T> {
  const response = await authFetch(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(await readError(response, `Request failed: ${url}`));
  }

  return (await response.json()) as T;
}

export async function uploadForm<T>(url: string, form: FormData): Promise<T> {
  const response = await authFetch(url, {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    throw new Error(await readError(response, `Upload failed: ${url}`));
  }

  return (await response.json()) as T;
}
