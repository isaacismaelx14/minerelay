import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { resolve } from 'node:path';

function hashFile(path: string): Promise<string> {
  return new Promise((resolveHash, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(path);

    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolveHash(hash.digest('hex')));
  });
}

async function main() {
  const fileArg = process.argv[2];
  if (!fileArg) {
    throw new Error('Usage: pnpm --filter @mss/infra-scripts sha256 <file-path>');
  }

  const absolute = resolve(process.cwd(), fileArg);
  const digest = await hashFile(absolute);
  console.log(`${digest}  ${absolute}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
