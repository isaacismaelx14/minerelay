#!/usr/bin/env node

import { execSync } from "node:child_process";

const PRETTIER_EXTENSIONS = new Set([
  ".js",
  ".cjs",
  ".mjs",
  ".ts",
  ".tsx",
  ".jsx",
  ".json",
  ".yml",
  ".yaml",
  ".css",
  ".scss",
  ".html",
]);
const PRETTIER_IGNORED_FILES = new Set([
  "apps/launcher/src-tauri/tauri.conf.json",
]);

const output = execSync("git diff --cached --name-only --diff-filter=ACM", {
  encoding: "utf8",
}).trim();

if (!output) {
  process.exit(0);
}

const stagedFiles = output
  .split(/\r?\n/u)
  .map((entry) => entry.trim())
  .filter((entry) => entry.length > 0);

const filesToCheck = stagedFiles.filter((file) => {
  const lower = file.toLowerCase();
  if (PRETTIER_IGNORED_FILES.has(lower)) {
    return false;
  }
  const extensionIndex = lower.lastIndexOf(".");
  if (extensionIndex === -1) {
    return false;
  }
  return PRETTIER_EXTENSIONS.has(lower.slice(extensionIndex));
});

if (filesToCheck.length === 0) {
  process.exit(0);
}

const escaped = filesToCheck
  .map((file) => `'${file.replaceAll("'", "'\\''")}'`)
  .join(" ");
execSync(`pnpm exec prettier --check ${escaped}`, {
  stdio: "inherit",
});
