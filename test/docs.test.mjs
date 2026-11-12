import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {dirname,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const pairs=[
 ['README.md','docs/README.zh-CN.md'],
 ['docs/CONFIGURATION.md','docs/CONFIGURATION.zh-CN.md'],
 ['docs/RELEASING.md','docs/RELEASING.zh-CN.md'],
 ['windows/README.md','windows/README.zh-CN.md'],
 ['SECURITY.md','SECURITY.zh-CN.md'],
 ['CHANGELOG.md','CHANGELOG.zh-CN.md'],
];
const markdown=[...pairs.flat(),'docs/NOTICE.zh-CN.md'];
const links=text=>[...text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)].map(x=>x[1]);

test('documentation links resolve and ship in the npm package',async()=>{
 const pkg=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));
 const payload=new Set(['package.json',...pkg.files]);
 for(const file of markdown){
  const body=await readFile(resolve(root,file),'utf8');
  assert.ok(payload.has(file),`${file} missing from npm payload`);
  for(const link of links(body)){
   if(/^[a-z]+:|^#/.test(link))continue;
   const path=resolve(root,dirname(file),decodeURIComponent(link.split('#')[0]));
   assert.ok((await stat(path)).isFile(),`${file} -> ${link}`);
   assert.ok(payload.has(relative(root,path).replaceAll('\\','/')),`${file} links outside npm payload: ${link}`);
  }
 }
});
test('Chinese guides link to Chinese project guides',async()=>{
 const untranslated=new Set(pairs.map(x=>x[0]));
 for(const [,file]of pairs){
  const text=await readFile(resolve(root,file),'utf8');
  for(const link of links(text)){
   if(/^[a-z]+:|^#/.test(link))continue;
   const target=relative(root,resolve(root,dirname(file),link.split('#')[0])).replaceAll('\\','/');
   if(untranslated.has(target))assert.match(link,/\.md$/, 'language links must be explicit files');
   if(untranslated.has(target))assert.ok(text.includes(`[English](${link})`),`${file} has a non-language link to English guide ${link}`);
  }
 }
});
test('README stays focused on product use',async()=>{
 for(const file of pairs[0]){
  const text=await readFile(resolve(root,file),'utf8');
  assert.doesNotMatch(text,/privacy and costs|隐私与费用|第二个\s*MCP|另一条注册|privacy confirmation|源码白名单|predecessor local tray/i);
 }
});
