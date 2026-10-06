// Packs the playable game (and nothing else) into dist/ and a zip for
// itch.io / IndieConnect: index.html at the root, no tests, docs or dev server.
import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = join(root, 'dist', 'web');
const zip = join(root, 'dist', 'maggie-ke-liye-kuch-bhi-web.zip');
const files = ['index.html', 'styles.css', 'manifest.webmanifest', 'assets', 'src', 'shared'];

await rm(join(root, 'dist'), { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const f of files) await cp(join(root, f), join(out, f), { recursive: true });
execFileSync('zip', ['-qr', zip, '.', '-x', '.DS_Store', '*/.DS_Store'], { cwd: out });
const { size } = await stat(zip);
console.log(`dist/maggie-ke-liye-kuch-bhi-web.zip  ${(size / 1024 / 1024).toFixed(2)} MB`);
