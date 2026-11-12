import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { audit, npm, root } from './privacy-audit.mjs';

await audit();
execFileSync(process.execPath, ['--test', 'test/privacy.test.mjs', 'test/package.test.mjs', 'test/docs.test.mjs'], {cwd:root,stdio:'inherit'});
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
if (!pkg.keywords.includes('pi-package') || pkg.private) throw Error('Package cannot be discovered/published');
if (!pkg.repository?.url?.startsWith('https://github.com/') || !pkg.homepage?.startsWith('https://github.com/')) {
  throw Error('Set the actual public GitHub repository/homepage after authenticating. Publication blocked until source identity is known.');
}
const inventory = JSON.parse(npm(['pack', '--dry-run', '--json', '--ignore-scripts']))[0];
const allowed = new Set(['package.json', ...pkg.files]);
for (const item of inventory.files) if (!allowed.has(item.path)) throw Error('Unexpected npm payload file: ' + item.path);
for (const file of ['package.json', ...pkg.files]) if (!inventory.files.some(x => x.path === file)) throw Error('Expected npm payload missing: ' + file);
console.log('Release checks passed; npm payload:', inventory.files.map(x => x.path).join(', '));
