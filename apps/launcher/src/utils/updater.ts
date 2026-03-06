import type {
  LauncherUpdateAction,
  LauncherUpdateCommandError,
  LauncherUpdateErrorCode,
} from "../types";

const VALID_UPDATE_CODES: ReadonlySet<LauncherUpdateErrorCode> = new Set([
  "LUPD-ENDPOINT-INVALID",
  "LUPD-MANIFEST-UNAVAILABLE",
  "LUPD-UPDATER-INIT",
  "LUPD-CHECK-FAILED",
  "LUPD-DOWNLOAD-FAILED",
  "LUPD-INSTALL-FAILED",
]);

function buildUpdaterErrorMessage(
  action: LauncherUpdateAction,
  code: LauncherUpdateErrorCode,
): string {
  const label = action === "check" ? "update check" : "update installation";
  return `Cannot perform ${label}. Code: ${code}.`;
}

function isValidUpdaterCode(value: unknown): value is LauncherUpdateErrorCode {
  return (
    typeof value === "string" &&
    VALID_UPDATE_CODES.has(value as LauncherUpdateErrorCode)
  );
}

export function isLauncherUpdateCommandError(
  value: unknown,
): value is LauncherUpdateCommandError {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<LauncherUpdateCommandError>;
  return (
    isValidUpdaterCode(candidate.code) &&
    (candidate.action === "check" || candidate.action === "install") &&
    typeof candidate.userMessage === "string"
  );
}

function parseLauncherUpdateCommandError(
  value: unknown,
): LauncherUpdateCommandError | null {
  if (isLauncherUpdateCommandError(value)) {
    return value;
  }

  if (value instanceof Error) {
    return parseLauncherUpdateCommandError(value.message);
  }

  if (typeof value !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return isLauncherUpdateCommandError(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function formatLauncherUpdateCommandError(
  value: unknown,
  fallbackAction: LauncherUpdateAction,
): string {
  const parsed = parseLauncherUpdateCommandError(value);
  if (parsed) {
    return buildUpdaterErrorMessage(parsed.action, parsed.code);
  }

  const fallbackCode: LauncherUpdateErrorCode =
    fallbackAction === "check" ? "LUPD-CHECK-FAILED" : "LUPD-INSTALL-FAILED";
  return buildUpdaterErrorMessage(fallbackAction, fallbackCode);
}
