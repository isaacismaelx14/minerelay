import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ProfileLockSchema } from '@mvl/shared';

function main() {
  const lockPath = resolve(process.cwd(), '../../infra/sample-data/profile.lock.json');
  const raw = JSON.parse(readFileSync(lockPath, 'utf-8'));
  const lock = ProfileLockSchema.parse(raw);

  console.log(`# Profile ${lock.profileId} v${lock.version}`);
  console.log(`- Minecraft: ${lock.minecraftVersion}`);
  console.log(`- Loader: ${lock.loader} ${lock.loaderVersion}`);
  console.log(`- Mods: ${lock.items.length}`);
  for (const mod of lock.items) {
    console.log(`  - ${mod.name} (${mod.versionId ?? mod.provider})`);
  }
}

main();
