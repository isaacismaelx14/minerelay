#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const version = process.argv[2]?.trim();

if (!version) {
  console.error("Usage: node apps/launcher/scripts/set-release-version.mjs <version>");
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`Invalid semantic version: "${version}"`);
  process.exit(1);
}

const repoRoot = process.cwd();
const launcherRoot = path.join(repoRoot, "apps", "launcher");

updateJson(path.join(launcherRoot, "package.json"), (data) => {
  data.version = version;
  return data;
});

updateJson(path.join(launcherRoot, "src-tauri", "tauri.conf.json"), (data) => {
  data.version = version;
  return data;
});

updateCargoPackageVersion(path.join(launcherRoot, "src-tauri", "Cargo.toml"), version);

console.log(`Stamped launcher version to ${version}`);

function updateJson(filePath, mutate) {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  const next = mutate(parsed);
  fs.writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

function updateCargoPackageVersion(filePath, nextVersion) {
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  let inPackage = false;
  let replaced = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const section = line.match(/^\s*\[([^\]]+)\]\s*$/);

    if (section) {
      inPackage = section[1] === "package";
      continue;
    }

    if (!inPackage) {
      continue;
    }

    if (/^\s*version\s*=/.test(line)) {
      lines[index] = `version = "${nextVersion}"`;
      replaced = true;
      break;
    }
  }

  if (!replaced) {
    throw new Error(`Failed to find [package] version field in ${filePath}`);
  }

  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}
