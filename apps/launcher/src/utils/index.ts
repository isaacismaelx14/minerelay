import type { AppSettings } from "../types";

export const ONBOARDING_VERSION = 2;

export function bytesToHuman(bytes: number): string {
  if (bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const amount = bytes / 1024 ** exponent;
  return `${amount.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export function formatEta(seconds?: number): string {
  if (!seconds || seconds <= 0) {
    return "--";
  }

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);
  return `${minutes}m ${remaining}s`;
}

export function formatTime(date: Date | null): string {
  if (!date) {
    return "--";
  }

  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDateTime(value: string | null): string {
  if (!value) {
    return "--";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function onboardingRequired(settings: AppSettings): boolean {
  return (
    !settings.wizardCompleted ||
    settings.onboardingVersion !== ONBOARDING_VERSION ||
    !settings.apiBaseUrl
  );
}

export function normalizeApiBaseUrl(input: string): string {
  return normalizeSecureUrl(input, true);
}

export function normalizeProfileLockUrl(input: string): string {
  return normalizeSecureUrl(input, false);
}

export function normalizeSecureUrl(input: string, trimTrailingSlash: boolean): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return "";
  }

  const candidate = trimTrailingSlash
    ? trimmed.replace(/\/+$/u, "")
    : trimmed;

  try {
    const parsed = new URL(candidate);
    const localhost =
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "::1";
    const secure = parsed.protocol === "https:";
    const localHttp = parsed.protocol === "http:" && localhost;

    if (!secure && localHttp === false) {
      return "";
    }

    if (parsed.username || parsed.password || parsed.hash) {
      return "";
    }

    return candidate;
  } catch {
    return "";
  }
}
