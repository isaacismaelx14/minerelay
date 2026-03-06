import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, "..");
const vinextCli = resolve(appRoot, "node_modules/vinext/dist/cli.js");
const args = process.argv.slice(2);
const currentMajor = Number.parseInt(
  process.versions.node.split(".")[0] ?? "0",
  10,
);

if (args.length === 0) {
  console.error("[admin] Missing vinext command.");
  process.exit(1);
}

const result =
  currentMajor >= 22
    ? spawnSync(process.execPath, [vinextCli, ...args], {
        cwd: appRoot,
        stdio: "inherit",
      })
    : spawnSync("npx", ["node@22", vinextCli, ...args], {
        cwd: appRoot,
        stdio: "inherit",
      });

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
