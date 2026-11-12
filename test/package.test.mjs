import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import companion,{officialSkillPath} from '../extension/hindsight.js';

function recorder(){
 const calls=[];
 const pi=new Proxy({}, {get:(_target,name)=>(...args)=>{calls.push({name,args});}});
 return {pi,calls};
}
test('wrapper delegates upstream registrations and adds only Skill discovery',async()=>{
 const upstream=recorder(),wrapped=recorder();
 const before={config:process.env.HINDSIGHT_CONFIG,disabled:process.env.HINDSIGHT_DISABLED};
 process.env.HINDSIGHT_CONFIG=new URL('../.release/test-config.json',import.meta.url).pathname;
 process.env.HINDSIGHT_DISABLED='true';
 try {
  await companion(wrapped.pi);
  const {default:official}=await import('@vectorize-io/hindsight-coding-agents/dist/pi.js');
  await official(upstream.pi);
 } finally {
  if(before.config===undefined)delete process.env.HINDSIGHT_CONFIG;else process.env.HINDSIGHT_CONFIG=before.config;
  if(before.disabled===undefined)delete process.env.HINDSIGHT_DISABLED;else process.env.HINDSIGHT_DISABLED=before.disabled;
 }
 const shape=calls=>calls.map(({name,args})=>[name,typeof args[0]==='string'?args[0]:args[0]?.name]);
 assert.deepEqual(shape(wrapped.calls.slice(0,-1)),shape(upstream.calls));
 const extra=wrapped.calls.at(-1);assert.equal(extra.name,'on');assert.equal(extra.args[0],'resources_discover');
 assert.deepEqual(extra.args[1](),{skillPaths:[officialSkillPath]});
});
test('one extension and runtime-resolved official Skill work across package layouts',async()=>{
 const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
 assert.deepEqual(pkg.pi.extensions,['./extension/hindsight.js']);assert.deepEqual(pkg.pi.skills,[]);
 assert.deepEqual(pkg.pi.prompts,[]);assert.deepEqual(pkg.pi.themes,[]);
 assert.ok(pkg.keywords.includes('pi-package'));assert.ok(!pkg.scripts.postinstall);
 assert.match(await readFile(join(officialSkillPath,'SKILL.md'),'utf8'),/hindsight/i);
 assert.equal(Object.keys(pkg.dependencies).length,1);
 assert.match(pkg.dependencies['@vectorize-io/hindsight-coding-agents'],/^\d+\.\d+\.\d+$/);
});
