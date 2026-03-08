import { headers } from "next/headers";
import { createHash } from "node:crypto";

import type { BootstrapPayload } from "@/admin/client/types";

const DEFAULT_API_ORIGIN = "http://localhost:3000";
const BOOTSTRAP_CACHE_TTL_MS = 15_000;
const BOOTSTRAP_FAILURE_CACHE_TTL_MS = 5_000;

const bootstrapCache = new Map<
  string,
  { expiresAt: number; payload: BootstrapPayload | null }
>();

export type ServerBootstrapResult = {
  payload: BootstrapPayload | null;
  isRscTransition: boolean;
};

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

function getAdminApiOrigin(): string {
  const configured =
    process.env.NEXT_PUBLIC_ADMIN_API_ORIGIN ?? DEFAULT_API_ORIGIN;
  return normalizeApiOrigin(configured);
}

function buildAdminApiUrl(path: string): string {
  return new URL(path, `${getAdminApiOrigin()}/`).toString();
}

function isRscTransitionRequest(requestHeaders: Headers): boolean {
  const rscHeader = requestHeaders.get("rsc");
  if (rscHeader === "1") {
    return true;
  }

  const accept = requestHeaders.get("accept")?.toLowerCase() ?? "";
  return accept.includes("text/x-component");
}

function buildSessionCacheKey(cookie: string | null): string {
  if (!cookie) {
    return "anonymous";
  }

  return createHash("sha256").update(cookie).digest("base64url");
}

export async function readServerBootstrapResult(): Promise<ServerBootstrapResult> {
  const requestHeaders = await headers();

  // During in-app route transitions we keep existing client state and avoid
  // a blocking SSR bootstrap network hop for every navigation.
  if (isRscTransitionRequest(requestHeaders)) {
    return {
      payload: null,
      isRscTransition: true,
    };
  }

  const cookie = requestHeaders.get("cookie");
  const cacheKey = buildSessionCacheKey(cookie);
  const cached = bootstrapCache.get(cacheKey);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return {
      payload: cached.payload,
      isRscTransition: false,
    };
  }

  try {
    const response = await fetch(
      buildAdminApiUrl("/v1/admin/bootstrap?includeLoaders=true"),
      {
        method: "GET",
        headers: cookie ? { cookie } : undefined,
        cache: "no-store",
      },
    );

    if (response.status === 401) {
      bootstrapCache.set(cacheKey, {
        payload: null,
        expiresAt: now + BOOTSTRAP_FAILURE_CACHE_TTL_MS,
      });
      return {
        payload: null,
        isRscTransition: false,
      };
    }

    if (!response.ok) {
      const text = await response.text();
      console.error(
        `[admin] bootstrap request failed (${response.status}): ${text || "empty response"}`,
      );
      bootstrapCache.set(cacheKey, {
        payload: null,
        expiresAt: now + BOOTSTRAP_FAILURE_CACHE_TTL_MS,
      });
      return {
        payload: null,
        isRscTransition: false,
      };
    }

    const payload = (await response.json()) as BootstrapPayload;
    bootstrapCache.set(cacheKey, {
      payload,
      expiresAt: now + BOOTSTRAP_CACHE_TTL_MS,
    });
    return {
      payload,
      isRscTransition: false,
    };
  } catch (error) {
    console.error("[admin] bootstrap request threw:", error);
    bootstrapCache.set(cacheKey, {
      payload: null,
      expiresAt: now + BOOTSTRAP_FAILURE_CACHE_TTL_MS,
    });
    return {
      payload: null,
      isRscTransition: false,
    };
  }
}

export async function readServerBootstrapPayload(): Promise<BootstrapPayload | null> {
  const result = await readServerBootstrapResult();
  return result.payload;
}
