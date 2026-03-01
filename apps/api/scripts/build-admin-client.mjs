import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = join(__dirname, '..');
const sourceRoot = join(appRoot, 'src', 'admin', 'client');
const outputRoot = join(appRoot, 'src', 'admin', 'public');

const entries = [
  {
    entry: join(sourceRoot, 'login.client.tsx'),
    outfile: join(outputRoot, 'login.app.js'),
  },
  {
    entry: join(sourceRoot, 'admin.client.tsx'),
    outfile: join(outputRoot, 'admin.app.js'),
  },
];

for (const { entry, outfile } of entries) {
  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: 'browser',
    format: 'esm',
    target: ['es2022'],
    jsx: 'automatic',
    sourcemap: false,
    minify: true,
    legalComments: 'none',
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    },
  });
}

console.log('Built admin client bundles.');
