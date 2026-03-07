"use client";

import type { AdminAuthPayload } from "./types";

export type RequestMethod = "GET" | "POST" | "PATCH" | "DELETE";

declare global {
  interface Window {
    __MSS_ADMIN_API_ORIGIN__?: string;
  }
}

const DEFAULT_API_ORIGIN = "http://localhost:3000";
const GET_CACHE_TTL_MS = 15_000;
const PREVIEW_POST_CACHE_TTL_MS = 15_000;
const CSRF_COOKIE = "mvl_admin_csrf";
const CSRF_HEADER = "x-csrf-token";
export const ADMIN_SESSION_STORAGE_KEY = "mss.admin.session.v1";

const responseCache = new Map<string, { expiresAt: number; data: unknown }>();
let refreshInFlight: Promise<void> | null = null;
let runtimeApiOrigin: string | null = null;

type AdminSessionSnapshot = Omit<AdminAuthPayload, "success">;

export async function readError(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const text = await response.text();
    try {
      const parsed = JSON.parse(text) as { message?: string | string[] };
      if (parsed && parsed.message) {
        if (Array.isArray(parsed.message)) {
          return parsed.message[0] || text || fallback;
        }
        return parsed.message;
      }
    } catch {
      // ignore
    }
    return text || fallback;
  } catch {
    return fallback;
  }
}

function normalizeApiOrigin(raw: string): string {
  const value = raw.trim();
  if (!value) {
    throw new Error("Missing NEXT_PUBLIC_ADMIN_API_ORIGIN.");
  }

  const parsed = new URL(value);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Invalid NEXT_PUBLIC_ADMIN_API_ORIGIN: ${value}`);
  }

  parsed.pathname = "/";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

export function getAdminApiOrigin(): string {
  const fromWindow =
    typeof window !== "undefined"
      ? (window.__MSS_ADMIN_API_ORIGIN__ ?? null)
      : null;
  const configured =
    runtimeApiOrigin ??
    fromWindow ??
    process.env.NEXT_PUBLIC_ADMIN_API_ORIGIN ??
    DEFAULT_API_ORIGIN;
  return normalizeApiOrigin(configured);
}

export function setRuntimeAdminApiOrigin(raw: string | null | undefined): void {
  if (!raw) {
    return;
  }

  runtimeApiOrigin = normalizeApiOrigin(raw);
}

export function buildAdminApiUrl(path: string): string {
  return new URL(path, `${getAdminApiOrigin()}/`).toString();
}

function resolveRequestTarget(input: RequestInfo | URL): RequestInfo | URL {
  if (typeof input === "string") {
    if (/^https?:\/\//i.test(input)) {
      return input;
    }
    return buildAdminApiUrl(input);
  }

  if (input instanceof URL) {
    return /^https?:\/\//i.test(input.toString())
      ? input
      : new URL(buildAdminApiUrl(input.toString()));
  }

  return input;
}

function canUseStorage(): boolean {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function readCookieValue(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  if (!match || !match[1]) {
    return null;
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

export function readAdminSession(): AdminSessionSnapshot | null {
  if (!canUseStorage()) {
    return null;
  }

  const raw = window.localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AdminSessionSnapshot>;
    if (
      typeof parsed.accessToken !== "string" ||
      typeof parsed.refreshToken !== "string" ||
      typeof parsed.expiresAt !== "string" ||
      typeof parsed.refreshExpiresAt !== "string"
    ) {
      return null;
    }

    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      expiresAt: parsed.expiresAt,
      refreshExpiresAt: parsed.refreshExpiresAt,
    };
  } catch {
    return null;
  }
}

export function writeAdminSession(payload: AdminAuthPayload): void {
  if (!canUseStorage()) {
    return;
  }

  const snapshot: AdminSessionSnapshot = {
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    expiresAt: payload.expiresAt,
    refreshExpiresAt: payload.refreshExpiresAt,
  };
  window.localStorage.setItem(
    ADMIN_SESSION_STORAGE_KEY,
    JSON.stringify(snapshot),
  );
}

export function clearAdminSession(): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
}

function redirectToLogin(): void {
  if (typeof window === "undefined" || window.location.pathname === "/login") {
    return;
  }

  window.location.href = "/login";
}

async function refreshAdminSession(): Promise<void> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    const session = readAdminSession();
    if (!session?.refreshToken) {
      clearAdminSession();
      throw new Error("Session expired");
    }

    const response = await fetch(buildAdminApiUrl("/v1/admin/auth/refresh"), {
      method: "POST",
      headers: {
        "x-admin-refresh-token": session.refreshToken,
      },
      credentials: "include",
    });

    if (!response.ok) {
      clearAdminSession();
      throw new Error(await readError(response, "Session expired"));
    }

    writeAdminSession((await response.json()) as AdminAuthPayload);
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  retried = false,
): Promise<Response> {
  const headers = new Headers(init.headers ?? {});
  const session = readAdminSession();
  if (session?.accessToken) {
    headers.set("authorization", `Bearer ${session.accessToken}`);
  } else if (
    (init.method ?? "GET").toUpperCase() !== "GET" &&
    (init.method ?? "GET").toUpperCase() !== "HEAD" &&
    (init.method ?? "GET").toUpperCase() !== "OPTIONS"
  ) {
    const csrfToken = readCookieValue(CSRF_COOKIE);
    if (csrfToken) {
      headers.set(CSRF_HEADER, csrfToken);
    }
  }

  const response = await fetch(resolveRequestTarget(input), {
    ...init,
    headers,
    credentials: "include",
  });

  if (response.status !== 401 || retried) {
    return response;
  }

  try {
    await refreshAdminSession();
  } catch {
    clearAdminSession();
    redirectToLogin();
    throw new Error("Session expired");
  }

  return authFetch(input, init, true);
}

export async function requestJson<T>(
  url: string,
  method: RequestMethod,
  body?: unknown,
): Promise<T> {
  const dedupeKey = buildDedupeKey(url, method, body);
  if (dedupeKey) {
    const now = Date.now();
    const cached = responseCache.get(dedupeKey);
    if (cached && cached.expiresAt > now) {
      return cached.data as T;
    }
  }

  const response = await authFetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(await readError(response, `Request failed: ${url}`));
  }

  const payload = (await response.json()) as T;
  if (dedupeKey) {
    responseCache.set(dedupeKey, {
      data: payload,
      expiresAt: Date.now() + dedupeTtlMs(url, method),
    });
  }

  return payload;
}

function buildDedupeKey(
  url: string,
  method: RequestMethod,
  body?: unknown,
): string | null {
  if (method === "GET") {
    return `GET ${url}`;
  }
  if (method === "POST" && url === "/v1/admin/fancymenu/preview/build") {
    return `POST ${url} ${JSON.stringify(body ?? {})}`;
  }
  return null;
}

function dedupeTtlMs(url: string, method: RequestMethod): number {
  if (method === "POST" && url === "/v1/admin/fancymenu/preview/build") {
    return PREVIEW_POST_CACHE_TTL_MS;
  }
  return GET_CACHE_TTL_MS;
}

export async function uploadForm<T>(url: string, form: FormData): Promise<T> {
  const response = await authFetch(url, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    throw new Error(await readError(response, `Upload failed: ${url}`));
  }

  return (await response.json()) as T;
}

export function buildEventSourceUrl(
  path: string,
  searchParams?: Record<string, string>,
): string {
  const url = new URL(buildAdminApiUrl(path));

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value) {
        url.searchParams.set(key, value);
      }
    }
  }

  return url.toString();
}

export function createAdminEventSource(
  path: string,
  searchParams?: Record<string, string>,
): EventSource {
  return new EventSource(buildEventSourceUrl(path, searchParams), {
    withCredentials: true,
  });
}
