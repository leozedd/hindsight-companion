import { readFile, readdir, lstat } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const npmCLI = process.platform === 'win32' ? 'npm.cmd' : 'npm';
export function npm(args) {
  // This helper only inventories a package; it cannot accept arbitrary shell input.
  if (JSON.stringify(args) !== JSON.stringify(['pack', '--dry-run', '--json', '--ignore-scripts'])) throw Error('Unsupported packaging command');
  const win = process.platform === 'win32';
  return execFileSync(win ? (process.env.ComSpec || 'cmd.exe') : npmCLI,
    win ? ['/d', '/s', '/c', 'npm.cmd ' + args.join(' ')] : args,
    { cwd: root, encoding: 'utf8', shell: false });
}
export const rules = [
  ['private user path', /(?:[A-Z]:[\\/](?:Users|Documents and Settings)[\\/][^\s<>"']+|\/home\/[^\s<>"']+|\/Users\/[^\s<>"']+)/i],
  ['private LAN address', /\b(?:192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/],
  ['credential token', /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{16,}|npm_[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16})\b/],
  ['private key', /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/],
  ['credential assignment', /(?:apiToken|api[_-]?key|password|_authToken)["']?\s*[:=]\s*["'][A-Za-z0-9+/_=-]{24,}["']/i],
  ['email address', /\b[A-Z0-9._%+-]+@(?!users\.noreply\.github\.com\b|example\.com\b)[A-Z0-9.-]+\.[A-Z]{2,}\b/i],
];

export function inspectText(text, extraForbidden = []) {
  const issues = rules.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
  const localName = basename(homedir());
  const values = [...extraForbidden, ...(localName.length >= 4 ? [localName] : [])];
  if (values.some(value => value && text.toLowerCase().includes(value.toLowerCase()))) issues.push('local/private identifier');
  if (text.includes('\u0000')) issues.push('binary content');
  return issues;
}
async function walk(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['.git', 'node_modules', '__pycache__', '.release'].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw Error('Symlink is not allowed in release sources: ' + relative(root, path));
    if (entry.isDirectory()) result.push(...await walk(path)); else result.push(relative(root, path).replaceAll('\\', '/'));
  }
  return result;
}
export async function audit() {
  const allow = JSON.parse(await readFile(join(root, 'release-files.json'), 'utf8'));
  if (!Array.isArray(allow) || new Set(allow).size !== allow.length) throw Error('Invalid source allowlist');
  const actual = await walk(root);
  for (const file of actual) if (!allow.includes(file)) throw Error('Unlisted file: ' + file);
  for (const file of allow) {
    if (file.startsWith('/') || file.includes('..') || /(^|\/)(?:\.env|coding-agent\.json|logs|updates|backups|venv|models)(?:$|\/)/.test(file)) throw Error('Forbidden release path: ' + file);
    const path = join(root, file);
    if (!(await lstat(path)).isFile()) throw Error('Missing source file: ' + file);
    const text = await readFile(path, 'utf8');
    const issues = inspectText(text);
    if (issues.length) throw Error(`${file}: ${issues.join(', ')} (matched values suppressed)`);
  }
  try {
    const tracked = execFileSync('git', ['ls-files', '-z'], {cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
    for (const file of tracked) {
      if (!allow.includes(file)) throw Error('Tracked file is not allowlisted: ' + file);
      const staged = execFileSync('git', ['show', ':' + file], {cwd:root,encoding:'utf8'});
      const issues = inspectText(staged);
      if (issues.length) throw Error(`${file}: staged ${issues.join(', ')} (matched values suppressed)`);
    }
  } catch (error) {
    if (!String(error.stderr).includes('not a git repository')) throw error;
  }
  return allow;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await audit();
  console.log('Privacy/source allowlist gate passed. Matched values are never printed.');
}
