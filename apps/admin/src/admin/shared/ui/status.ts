export function statusClass(tone: "idle" | "ok" | "error"): string {
  if (tone === "ok") return "status ok";
  if (tone === "error") return "status error";
  return "status";
}

export function exarotonStatusClass(status: number): string {
  if (status === 1) return "status-chip status-chip-online";
  if (status === 7) return "status-chip status-chip-crashed";
  if ([2, 3, 4, 5, 6, 8, 9, 10].includes(status)) {
    return "status-chip status-chip-busy";
  }
  return "status-chip status-chip-offline";
}

export function getExarotonStatusTone(status: number): "ok" | "error" | "idle" {
  if (status === 1) return "ok";
  if (status === 7) return "error";
  return "idle";
}
