import { ui } from "@minerelay/ui";

export function statusClass(tone: "idle" | "ok" | "error"): string {
  if (tone === "ok") return `${ui.statusBase} ${ui.statusOk}`;
  if (tone === "error") return `${ui.statusBase} ${ui.statusError}`;
  return `${ui.statusBase} ${ui.statusIdle}`;
}

export function exarotonStatusClass(status: number): string {
  if (status === 1) return `${ui.statusChip} ${ui.statusChipOnline}`;
  if (status === 7) return `${ui.statusChip} ${ui.statusChipCrashed}`;
  if ([2, 3, 4, 5, 6, 8, 9, 10].includes(status)) {
    return `${ui.statusChip} ${ui.statusChipBusy}`;
  }
  return `${ui.statusChip} ${ui.statusChipOffline}`;
}

export function getExarotonStatusTone(status: number): "ok" | "error" | "idle" {
  if (status === 1) return "ok";
  if (status === 7) return "error";
  return "idle";
}
