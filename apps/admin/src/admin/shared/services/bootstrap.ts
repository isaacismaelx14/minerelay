"use client";

import { requestJson } from "@/admin/client/http";
import type {
  BootstrapPayload,
  FabricVersionsPayload,
} from "@/admin/client/types";

const BOOTSTRAP_CACHE_TTL_MS = 15_000;
const FABRIC_VERSIONS_CACHE_TTL_MS = 60_000;

let bootstrapCache: { payload: BootstrapPayload; expiresAt: number } | null =
  null;
let bootstrapInFlight: Promise<BootstrapPayload> | null = null;
const fabricVersionsCache = new Map<
  string,
  { payload: FabricVersionsPayload; expiresAt: number }
>();
const fabricVersionsInFlight = new Map<
  string,
  Promise<FabricVersionsPayload>
>();

export async function readBootstrapPayload(
  force = false,
): Promise<BootstrapPayload> {
  const now = Date.now();
  if (!force && bootstrapCache && bootstrapCache.expiresAt > now) {
    return bootstrapCache.payload;
  }
  if (bootstrapInFlight) {
    return bootstrapInFlight;
  }

  bootstrapInFlight = requestJson<BootstrapPayload>(
    "/v1/admin/bootstrap",
    "GET",
  )
    .then((payload) => {
      bootstrapCache = {
        payload,
        expiresAt: Date.now() + BOOTSTRAP_CACHE_TTL_MS,
      };
      return payload;
    })
    .finally(() => {
      bootstrapInFlight = null;
    });

  return bootstrapInFlight;
}

export async function readFabricVersionsPayload(
  minecraftVersion: string,
  force = false,
): Promise<FabricVersionsPayload> {
  const now = Date.now();
  const cached = fabricVersionsCache.get(minecraftVersion);
  if (!force && cached && cached.expiresAt > now) {
    return cached.payload;
  }

  const inFlight = fabricVersionsInFlight.get(minecraftVersion);
  if (inFlight) {
    return inFlight;
  }

  const request = requestJson<FabricVersionsPayload>(
    `/v1/admin/fabric/versions?minecraftVersion=${encodeURIComponent(minecraftVersion)}`,
    "GET",
  )
    .then((payload) => {
      fabricVersionsCache.set(minecraftVersion, {
        payload,
        expiresAt: Date.now() + FABRIC_VERSIONS_CACHE_TTL_MS,
      });
      return payload;
    })
    .finally(() => {
      fabricVersionsInFlight.delete(minecraftVersion);
    });

  fabricVersionsInFlight.set(minecraftVersion, request);
  return request;
}
