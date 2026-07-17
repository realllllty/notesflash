import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'dist');
const destination = resolve(root, 'cloud', 'public');

if (!destination.startsWith(`${resolve(root, 'cloud')}/`)) {
  throw new Error('Refusing to sync outside cloud/.');
}

const sourceStats = await stat(source).catch(() => null);
if (!sourceStats?.isDirectory()) {
  throw new Error('dist/ does not exist. Run npm run build first.');
}

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true });

console.log(`Synced PWA assets to ${destination}`);
