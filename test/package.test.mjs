import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import official from '@vectorize-io/hindsight-coding-agents/dist/pi.js';
import companion from '../extension/hindsight.js';

test('entry is exactly the official factory, not a fork',()=>{
 assert.equal(typeof companion,'function');assert.equal(companion,official);
});
test('one extension, explicit skill, native package discovery and no lifecycle installers',async()=>{
 const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
 assert.deepEqual(pkg.pi.extensions,['./extension/hindsight.js']);
 assert.deepEqual(pkg.pi.prompts,[]);assert.deepEqual(pkg.pi.themes,[]);
 assert.ok(pkg.keywords.includes('pi-package'));assert.ok(!pkg.scripts.postinstall);
 const skill=new URL('../node_modules/@vectorize-io/hindsight-coding-agents/skill/SKILL.md',import.meta.url);
 assert.match(await readFile(skill,'utf8'),/hindsight/i);
 assert.equal(Object.keys(pkg.dependencies).length,1);
 assert.match(pkg.dependencies['@vectorize-io/hindsight-coding-agents'],/^\d+\.\d+\.\d+$/);
});
