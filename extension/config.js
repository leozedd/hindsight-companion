import { mkdir, readFile, open, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

export function agentDirectory(env = process.env, home = homedir()) {
  const custom = env.PI_CODING_AGENT_DIR;
  if (!custom) return join(home, '.pi', 'agent');
  if (custom === '~') return home;
  if (custom.startsWith('~/') || custom.startsWith('~\\')) return resolve(home, custom.slice(2));
  return resolve(custom);
}

// Select the path before upstream captures CONFIG_PATH during module evaluation.
// New installs start disabled; existing user configuration is never overwritten.
export async function configurePiConfig({ env = process.env, home = homedir() } = {}) {
  if (env.HINDSIGHT_CONFIG) return { path: env.HINDSIGHT_CONFIG, migrated: false, created: false, explicit: true };
  const directory = agentDirectory(env, home);
  const target = join(directory, 'hindsight.json');
  try {
    await stat(target);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const legacy = join(home, '.hindsight', 'coding-agent.json');
    let source;
    try {
      source = await readFile(legacy, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const hasLegacy = source !== undefined;
    if (hasLegacy) {
      // Validate without echoing source text on parse errors.
      try { const data = JSON.parse(source); if (!data || Array.isArray(data) || typeof data !== 'object') throw Error(); }
      catch { throw Error('Cannot migrate Hindsight configuration: legacy configuration must be a JSON object.'); }
    } else {
      source = JSON.stringify({
        disabled: true,
        serverMode: 'self-hosted',
        apiUrl: 'http://127.0.0.1:8888',
        apiToken: '',
        bankId: 'my-bank',
        dynamicBankId: false,
      }, null, 2) + '\n';
    }
    await mkdir(directory, { recursive: true, mode: 0o700 });
    let file;
    try {
      file = await open(target, 'wx', 0o600);
      await file.writeFile(source, 'utf8');
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    } finally {
      await file?.close();
    }
    env.HINDSIGHT_CONFIG = target;
    return { path: target, migrated: Boolean(file) && hasLegacy, created: Boolean(file) && !hasLegacy, explicit: false };
  }
  env.HINDSIGHT_CONFIG = target;
  return { path: target, migrated: false, created: false, explicit: false };
}
