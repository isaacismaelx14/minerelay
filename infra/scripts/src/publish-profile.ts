import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ProfileLockSchema } from "@minerelay/shared";

interface SeedPayload {
  serverId: string;
  profileId: string;
  version: number;
  minecraftVersion: string;
  loader: string;
  loaderVersion: string;
  defaultServerName: string;
  defaultServerAddress: string;
  allowedMinecraftVersions: string[];
  fancyMenuEnabled: boolean;
  fancyMenuSettings: unknown;
  lockUrl: string;
  lockJson: unknown;
}

function main() {
  const serverId = process.env.SERVER_ID ?? "mvl";
  const apiBase = process.env.API_BASE_URL ?? "http://localhost:3000";

  const lockPath = resolve(
    process.cwd(),
    "../../infra/sample-data/profile.lock.json",
  );
  const raw = JSON.parse(readFileSync(lockPath, "utf-8"));
  const lock = ProfileLockSchema.parse(raw);

  const payload: SeedPayload = {
    serverId,
    profileId: lock.profileId,
    version: lock.version,
    minecraftVersion: lock.minecraftVersion,
    loader: lock.loader,
    loaderVersion: lock.loaderVersion,
    defaultServerName: lock.defaultServer.name,
    defaultServerAddress: lock.defaultServer.address,
    allowedMinecraftVersions: [lock.minecraftVersion],
    fancyMenuEnabled: lock.fancyMenu.enabled,
    fancyMenuSettings: lock.fancyMenu,
    lockUrl: `${apiBase}/v1/locks/${lock.profileId}/${lock.version}`,
    lockJson: lock,
  };

  const outputPath = resolve(
    process.cwd(),
    "../../infra/sample-data/profile.seed.json",
  );
  writeFileSync(outputPath, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${outputPath}`);
}

main();
