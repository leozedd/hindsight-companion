import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { copyFile, open, readFile, realpath, rename, stat, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, normalize, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export class ProjectRegistrationError extends Error {}

async function projectPathInWorkspace(root, cwd) {
  const canonicalRoot = await realpath(root);
  let ancestor = cwd;
  for (;;) {
    const suffix = relative(await realpath(ancestor), canonicalRoot);
    if (suffix !== '..' && !suffix.startsWith(`..${sep}`) && !isAbsolute(suffix)) {
      const candidate = resolve(ancestor, suffix);
      if (await realpath(candidate) === canonicalRoot) return candidate;
    }
    const parent = dirname(ancestor);
    if (parent === ancestor) return root;
    ancestor = parent;
  }
}

export async function projectDirectory(cwd) {
  const directory = resolve(cwd);
  try {
    const { stdout } = await exec('git', ['-C', directory, 'rev-parse', '--path-format=absolute', '--git-common-dir'], { timeout: 10000 });
    const common = resolve(stdout.trimEnd());
    // Git expands Windows 8.3 paths; upstream's filesystem probe keeps the host's
    // spelling. Preserve that spelling so mapPathToBank matches the live cwd.
    const root = basename(common) === '.git' ? dirname(common) : common;
    return await projectPathInWorkspace(root, directory);
  } catch (error) {
    if (error.code === 128 && /not a git repository/i.test(error.stderr ?? '')) return directory;
    if (error.code === 'ENOENT') throw new ProjectRegistrationError('Git is required to identify the project directory. Install Git, then retry.');
    throw new ProjectRegistrationError('Cannot identify the project directory: the Git probe failed. No mapping was saved.');
  }
}

function configuredPath(path) {
  if (path === '~' || path.startsWith('~/') || path.startsWith('~\\')) return resolve(homedir(), path.slice(2));
  return normalize(resolve(path));
}

// Writes only official configuration; no bank creation, memory transfer or upstream patching.
export async function registerCurrentProject(configPath, cwd, requestedBank = '') {
  const bankArgument = requestedBank.trim();
  if (bankArgument && /[\s\u0000-\u001f\u007f]/u.test(bankArgument)) {
    throw new ProjectRegistrationError('Usage: /hindsight-project [bank-id]. The bank ID cannot contain spaces or control characters.');
  }
  const root = await projectDirectory(cwd);
  const roots = [...new Set([root, await realpath(root)])];
  const file = await realpath(configPath);
  const lockPath = `${file}.companion.lock`;
  let lock;
  try {
    lock = await open(lockPath, 'wx', 0o600);
  } catch (error) {
    if (error.code === 'EEXIST') throw new ProjectRegistrationError('Another configuration update is in progress. Retry after it finishes.');
    throw error;
  }
  let temporary;
  try {
    const original = await readFile(file, 'utf8');
    let config;
    try { config = JSON.parse(original); }
    catch { throw new ProjectRegistrationError('The Hindsight configuration is not valid JSON. Fix it before registering a project.'); }
    if (!isObject(config)) throw new ProjectRegistrationError('The Hindsight configuration must be a JSON object.');
    // An explicit Pi harness map replaces the global map in upstream's config layering.
    const section = isObject(config.harnesses?.pi) && Object.hasOwn(config.harnesses.pi, 'mapPathToBank') ? config.harnesses.pi : config;
    const mappings = section.mapPathToBank ?? {};
    if (!isObject(mappings)) throw new ProjectRegistrationError('mapPathToBank must be a JSON object. No mapping was saved.');
    const existing = Object.entries(mappings).filter(([path]) => roots.some(candidate => configuredPath(path) === normalize(candidate)));
    if (new Set(existing.map(([, bank]) => bank)).size > 1) {
      throw new ProjectRegistrationError('This project has directory aliases mapped to different banks. Resolve the conflicting mapPathToBank entries before registering it.');
    }
    const bank = existing[0]?.[1] ?? (bankArgument || `coding-agent::${basename(root)}`);
    if (bankArgument && bank !== bankArgument) {
      throw new ProjectRegistrationError(`This project is already mapped to ${bank}. Edit mapPathToBank explicitly to change its destination; existing memory will not be moved.`);
    }
    const missing = roots.filter(candidate => !existing.some(([path]) => configuredPath(path) === normalize(candidate)));
    if (!missing.length) return { root, bank, changed: false, configPath: file };
    // Node can expand Windows short paths at process startup while Git worktree pointers
    // use long paths. Both spellings must route to the same bank without patching upstream.
    section.mapPathToBank = { ...mappings, ...Object.fromEntries(missing.map(path => [path.split(sep).join('/'), bank])) };
    const mode = (await stat(file)).mode & 0o777;
    temporary = `${file}.${randomUUID()}.tmp`;
    const output = await open(temporary, 'wx', mode);
    try { await output.writeFile(JSON.stringify(config, null, 2) + '\n', 'utf8'); }
    finally { await output.close(); }
    // Do not replace an external edit made while the new file was being prepared.
    if (await readFile(file, 'utf8') !== original) throw new ProjectRegistrationError('The configuration changed during registration. Retry to keep the newer changes.');
    try { await copyFile(file, `${file}.before-project-registration`, constants.COPYFILE_EXCL); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    await rename(temporary, file);
    temporary = undefined;
    return { root, bank, changed: true, configPath: file };
  } finally {
    if (temporary) await unlink(temporary).catch(() => {});
    await lock.close();
    await unlink(lockPath);
  }
}

export function registerProjectCommand(pi, configPath) {
  pi.registerCommand('hindsight-project', {
    description: 'Use a project bank for this directory: /hindsight-project [bank-id]',
    handler: async (args, ctx) => {
      let result;
      try {
        result = await registerCurrentProject(configPath, ctx.cwd, args);
      } catch (error) {
        const message = error instanceof ProjectRegistrationError ? error.message : 'Cannot save project routing. Check the configuration path and file permissions.';
        ctx.ui.notify(`Hindsight: ${message}`, 'error');
        return;
      }
      ctx.ui.notify(`Hindsight: ${result.root} → ${result.bank}. Reloading Pi to apply routing. Existing memory is not moved.`, 'info');
      try { await ctx.reload(); }
      catch { ctx.ui.notify('Hindsight: project mapping is saved, but reload failed. Restart Pi / PiWeb to apply it.', 'warning'); }
    },
  });
}
