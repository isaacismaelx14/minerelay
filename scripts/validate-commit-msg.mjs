#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const commitMsgFile = process.argv[2];
if (!commitMsgFile) {
  console.error("[commit-msg] Missing commit message file argument.");
  process.exit(1);
}

const message = fs.readFileSync(commitMsgFile, "utf8").trim();
const firstLine = message.split(/\r?\n/u)[0]?.trim() ?? "";

if (!firstLine) {
  console.error("[commit-msg] Empty commit message.");
  process.exit(1);
}

if (/^(Merge|Revert|fixup!|squash!)/u.test(firstLine)) {
  process.exit(0);
}

const configPath = path.resolve(process.cwd(), "release.config.json");
if (!fs.existsSync(configPath)) {
  console.error(`[commit-msg] Missing release config: ${configPath}`);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const allowedTypes = Object.keys(config.types ?? {});
const allowedScopes = Object.keys(config.scopeMap ?? {});

if (allowedTypes.length === 0 || allowedScopes.length === 0) {
  console.error("[commit-msg] release.config.json must define non-empty types and scopeMap.");
  process.exit(1);
}

const headerMatch = firstLine.match(/^(?<type>[a-z]+)\((?<scope>[A-Za-z0-9._-]+)\)(?<breaking>!)?:\s+.+$/u);
if (!headerMatch?.groups) {
  printError(
    firstLine,
    allowedTypes,
    allowedScopes,
    "Expected format: type(scope): subject (optional ! before colon)",
  );
  process.exit(1);
}

const type = headerMatch.groups.type;
const scope = headerMatch.groups.scope;

if (!allowedTypes.includes(type)) {
  printError(firstLine, allowedTypes, allowedScopes, `Unsupported type: ${type}`);
  process.exit(1);
}

if (!allowedScopes.includes(scope)) {
  printError(firstLine, allowedTypes, allowedScopes, `Unsupported scope: ${scope}`);
  process.exit(1);
}

process.exit(0);

function printError(line, types, scopes, reason) {
  console.error(`[commit-msg] ${reason}`);
  console.error(`[commit-msg] Message: \"${line}\"`);
  console.error(`[commit-msg] Allowed types: ${types.join(", ")}`);
  console.error(`[commit-msg] Allowed scopes: ${scopes.join(", ")}`);
  console.error(`[commit-msg] Example: feat(api): add profile endpoint`);
}
