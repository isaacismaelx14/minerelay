export function normalizeSemver(value: string): {
  major: number;
  minor: number;
  patch: number;
} {
  const match = value.trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    return { major: 1, minor: 0, patch: 0 };
  }

  return {
    major: Number(match[1]) || 1,
    minor: Number(match[2]) || 0,
    patch: Number(match[3]) || 0,
  };
}

export function bumpSemver(
  current: { major: number; minor: number; patch: number },
  type: "major" | "minor" | "patch",
): string {
  if (type === "major") {
    return `${current.major + 1}.0.0`;
  }

  if (type === "minor") {
    return `${current.major}.${current.minor + 1}.0`;
  }

  return `${current.major}.${current.minor}.${current.patch + 1}`;
}
