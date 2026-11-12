// Configuration belongs to Pi. Memory behavior remains in the official runtime.
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { configurePiConfig } from './config.js';

const require = createRequire(import.meta.url);
export const officialSkillPath = join(dirname(require.resolve('@vectorize-io/hindsight-coding-agents/package.json')), 'skill');
const officialEntry = pathToFileURL(require.resolve('@vectorize-io/hindsight-coding-agents/dist/pi.js')).href;

export default async function hindsightCompanion(pi) {
  await configurePiConfig();
  const { default: official } = await import(officialEntry);
  await official(pi);
  pi.on('resources_discover', () => ({ skillPaths: [officialSkillPath] }));
}
