import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = join(root, 'www');
const excluded = new Set(['.git', '.agents', '.codex', 'android', 'node_modules', 'scripts', 'www', '.gradle-home']);

if (existsSync(output)) rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

for (const entry of readdirSync(root, { withFileTypes: true })) {
  if (excluded.has(entry.name) || entry.name.startsWith('.')) continue;
  cpSync(join(root, entry.name), join(output, entry.name), { recursive: true });
}

console.log(`PWA copied to ${output}`);
