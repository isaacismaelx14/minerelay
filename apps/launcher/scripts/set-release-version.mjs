#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const version = process.argv[2]?.trim();

if (!version) {
  console.error(
    "Usage: node apps/launcher/scripts/set-release-version.mjs <version>",
  );
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`Invalid semantic version: "${version}"`);
  process.exit(1);
}

const repoRoot = process.cwd();
const launcherRoot = path.join(repoRoot, "apps", "launcher");

updateJsonVersionField(path.join(launcherRoot, "package.json"), version);
updateJsonVersionField(
  path.join(launcherRoot, "src-tauri", "tauri.conf.json"),
  version,
);

updateCargoPackageVersion(
  path.join(launcherRoot, "src-tauri", "Cargo.toml"),
  version,
);

console.log(`Stamped launcher version to ${version}`);

function updateJsonVersionField(filePath, nextVersion) {
  const raw = fs.readFileSync(filePath, "utf8");
  if (!/"version"\s*:\s*"[^"]+"/u.test(raw)) {
    throw new Error(`Failed to find version field in ${filePath}`);
  }
  const next = raw.replace(
    /("version"\s*:\s*")([^"]+)(")/u,
    `$1${nextVersion}$3`,
  );

  if (next === raw) {
    return;
  }

  fs.writeFileSync(filePath, next, "utf8");
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
