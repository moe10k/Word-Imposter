import { rm } from 'node:fs/promises';
import { build } from 'esbuild';

await rm('build', { recursive: true, force: true });

await build({
  entryPoints: {
    server: 'server.ts',
    'scripts/migrate': 'scripts/migrate.ts',
  },
  outdir: 'build',
  outbase: '.',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node24',
  packages: 'external',
  sourcemap: true,
  tsconfig: 'tsconfig.server.json',
});
