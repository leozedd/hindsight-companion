// Delegate memory behavior to upstream; resolve its Skill independently of npm layout.
import official from '@vectorize-io/hindsight-coding-agents/dist/pi.js';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

export const officialSkillPath = join(dirname(createRequire(import.meta.url).resolve('@vectorize-io/hindsight-coding-agents/package.json')), 'skill');

export default async function hindsightCompanion(pi) {
  await official(pi);
  pi.on('resources_discover', () => ({ skillPaths: [officialSkillPath] }));
}
