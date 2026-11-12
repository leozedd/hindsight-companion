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

// Called before importing upstream: its CONFIG_PATH is captured during module evaluation.
// Copies only the existing configuration; never logs credentials or modifies the source.
export async function configurePiConfig({ env = process.env, home = homedir() } = {}) {
  if (env.HINDSIGHT_CONFIG) return { path: env.HINDSIGHT_CONFIG, migrated: false, explicit: true };
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
    if (source !== undefined) {
      // Validate without echoing source text on parse errors.
      try { const data = JSON.parse(source); if (!data || Array.isArray(data) || typeof data !== 'object') throw Error(); }
      catch { throw Error('Cannot migrate Hindsight configuration: legacy configuration must be a JSON object.'); }
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
      return { path: target, migrated: Boolean(file), explicit: false };
    }
  }
  env.HINDSIGHT_CONFIG = target;
  return { path: target, migrated: false, explicit: false };
}
