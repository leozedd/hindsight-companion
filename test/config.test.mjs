import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {agentDirectory,configurePiConfig} from '../extension/config.js';

async function fixture(fn){
 const home=await mkdtemp(join(tmpdir(),'companion-config-'));
 try{await fn(home);}finally{await rm(home,{recursive:true,force:true});}
}
test('default config belongs to Pi; supports custom Pi agent directory',async()=>fixture(async home=>{
 const env={};const result=await configurePiConfig({env,home});
 assert.equal(result.path,join(home,'.pi','agent','hindsight.json'));assert.equal(env.HINDSIGHT_CONFIG,result.path);
 assert.equal(result.created,true);assert.equal(result.migrated,false);
 const template=JSON.parse(await readFile(result.path,'utf8'));
 assert.deepEqual(template,{disabled:true,serverMode:'self-hosted',apiUrl:'http://127.0.0.1:8888',apiToken:'',bankId:'my-bank',dynamicBankId:false});
 for(const file of ['CONFIGURATION.md','CONFIGURATION.zh-CN.md']){
  const guide=await readFile(new URL('../docs/'+file,import.meta.url),'utf8');
  assert.deepEqual(JSON.parse(guide.match(/```json\n([\s\S]*?)\n```/)[1]),template);
 }
 if(process.platform!=='win32')assert.equal((await stat(result.path)).mode&0o777,0o600);
 assert.equal(agentDirectory({PI_CODING_AGENT_DIR:'~/custom-pi'},home),join(home,'custom-pi'));
 const custom={PI_CODING_AGENT_DIR:join(home,'agent')};
 const customResult=await configurePiConfig({env:custom,home});
 assert.equal(customResult.path,join(home,'agent','hindsight.json'));assert.equal(customResult.created,true);
 assert.deepEqual(JSON.parse(await readFile(customResult.path,'utf8')),template);
 await writeFile(result.path,'{"disabled":false,"bankId":"keep-existing"}\n');
 const again=await configurePiConfig({env:{},home});assert.equal(again.created,false);
 assert.equal(await readFile(result.path,'utf8'),'{"disabled":false,"bankId":"keep-existing"}\n');
}));
test('explicit HINDSIGHT_CONFIG is preserved with no migration',async()=>fixture(async home=>{
 const env={HINDSIGHT_CONFIG:join(home,'chosen.json')};const result=await configurePiConfig({env,home});
 assert.equal(result.path,env.HINDSIGHT_CONFIG);assert.equal(result.explicit,true);
 await assert.rejects(stat(join(home,'.pi')),error=>error.code==='ENOENT');
}));
test('first load copies legacy config byte-for-byte, retains source, never overwrites target',async()=>fixture(async home=>{
 const legacy=join(home,'.hindsight','coding-agent.json');await mkdir(join(home,'.hindsight'));
 const original='{"apiToken":"synthetic-test-value","bankId":"test-bank"}\n';await writeFile(legacy,original);
 const first=await configurePiConfig({env:{},home});assert.equal(first.migrated,true);
 assert.equal(await readFile(first.path,'utf8'),original);assert.equal(await readFile(legacy,'utf8'),original);
 if(process.platform!=='win32')assert.equal((await stat(first.path)).mode&0o777,0o600);
 const changed='{"bankId":"new-target"}\n';await writeFile(first.path,changed);
 const second=await configurePiConfig({env:{},home});assert.equal(second.migrated,false);assert.equal(await readFile(first.path,'utf8'),changed);
}));
test('concurrent migration does not overwrite target',async()=>fixture(async home=>{
 await mkdir(join(home,'.hindsight'));await writeFile(join(home,'.hindsight','coding-agent.json'),'{"bankId":"test"}');
 const results=await Promise.all([configurePiConfig({env:{},home}),configurePiConfig({env:{},home})]);
 assert.equal(results.filter(r=>r.migrated).length,1);assert.deepEqual(JSON.parse(await readFile(results[0].path,'utf8')),{bankId:'test'});
}));
test('invalid legacy JSON stops migration without echoing sensitive text',async()=>fixture(async home=>{
 await mkdir(join(home,'.hindsight'));await writeFile(join(home,'.hindsight','coding-agent.json'),'sensitive-invalid-value');
 await assert.rejects(configurePiConfig({env:{},home}),error=>error.message.includes('JSON object')&&!error.message.includes('sensitive-invalid-value'));
 await assert.rejects(stat(join(home,'.pi','agent','hindsight.json')),error=>error.code==='ENOENT');
}));
test('concurrent fresh installs create one disabled template',async()=>fixture(async home=>{
 const results=await Promise.all([configurePiConfig({env:{},home}),configurePiConfig({env:{},home})]);
 assert.equal(results.filter(r=>r.created).length,1);assert.equal(results.filter(r=>r.migrated).length,0);
 assert.equal(JSON.parse(await readFile(results[0].path,'utf8')).disabled,true);
}));
test('fresh extension load creates template and gives setup notice; configured reload enables official tools',async()=>fixture(async home=>{
 const agent=join(home,'new-agent'),entry=new URL('../extension/hindsight.js',import.meta.url).href;
 const program=`import assert from 'node:assert/strict';import {join} from 'node:path';import {readFile,writeFile} from 'node:fs/promises';import companion from ${JSON.stringify(entry)};
let tools=[],events=[];const pi=new Proxy({},{get:(_t,k)=>(...args)=>{if(k==='registerTool')tools.push(args[0]);if(k==='on')events.push(args);}});
await companion(pi);const path=join(process.env.PI_CODING_AGENT_DIR,'hindsight.json');const cfg=JSON.parse(await readFile(path,'utf8'));assert.equal(cfg.disabled,true);assert.equal(tools.length,0);
const notices=[];for(const [name,handler]of events)if(name==='session_start')await handler({}, {hasUI:true,cwd:process.cwd(),ui:{notify:(...args)=>notices.push(args)}});
assert.equal(notices.length,1);assert.ok(notices[0][0].includes(path));assert.match(notices[0][0],/disabled to false/);
for(const [name,handler]of events)if(name==='session_start')await handler({}, {hasUI:false,cwd:process.cwd()});assert.equal(notices.length,1);
Object.assign(cfg,{disabled:false,apiToken:'synthetic',bankId:'fresh-bank',autoSeed:false,retainSessions:false,gitIngest:'none',codebaseSurvey:false,manageBankConfig:false});await writeFile(path,JSON.stringify(cfg));
tools=[];events=[];await companion(pi);assert.equal(tools.length,8);const tool=tools.find(t=>t.name==='hindsight_diagnose');const result=await tool.execute('check',{},undefined,undefined,{cwd:process.cwd()});const diag=JSON.parse(result.content[0].text);assert.equal(diag.bank_id,'fresh-bank');assert.equal(diag.config.path,path);assert.equal(diag.config.disabled,false);console.log('Fresh install and configured reload verified');`;
 const env={...process.env,HOME:home,USERPROFILE:home,PI_CODING_AGENT_DIR:agent,HINDSIGHT_DISABLE_HOOKS:'1'};
 delete env.HINDSIGHT_CONFIG;delete env.HINDSIGHT_DISABLED;
 assert.match(execFileSync(process.execPath,['--input-type=module','-e',program],{env,cwd:home,encoding:'utf8'}),/Fresh install and configured reload verified/);
}));
test('actual official runtime reads Pi config before its module initializes',async()=>fixture(async home=>{
 const agent=join(home,'pi-agent');await mkdir(agent);
 await writeFile(join(agent,'hindsight.json'),JSON.stringify({serverMode:'self-hosted',apiUrl:'http://127.0.0.1:8888',apiToken:'synthetic',bankId:'pi-config-test',dynamicBankId:false,retainSessions:false,autoSeed:false,gitIngest:'none',codebaseSurvey:false,manageBankConfig:false,autoUpdate:false,disabled:false}));
 const entry=new URL('../extension/hindsight.js',import.meta.url).href;
 const program=`import assert from 'node:assert/strict';import {join} from 'node:path';import companion from ${JSON.stringify(entry)};
const tools=[],events=[];const pi=new Proxy({},{get:(_t,k)=>(...args)=>{if(k==='registerTool')tools.push(args[0]);if(k==='on')events.push(args);}});
await companion(pi);assert.equal(tools.length,8);const tool=tools.find(t=>t.name==='hindsight_diagnose');const result=await tool.execute('test',{},undefined,undefined,{cwd:process.cwd()});
const diag=JSON.parse(result.content[0].text);assert.equal(diag.bank_id,'pi-config-test');assert.equal(diag.config.path,join(process.env.PI_CODING_AGENT_DIR,'hindsight.json'));assert.equal(diag.credential.api_token_matches_config,true);assert.equal(diag.config.exists,true);
assert.ok(events.some(e=>e[0]==='resources_discover'));console.log('Official runtime uses Pi config; 8 tools registered');`;
 const env={...process.env,PI_CODING_AGENT_DIR:agent,HINDSIGHT_DISABLE_HOOKS:'1'};
 delete env.HINDSIGHT_CONFIG;delete env.HINDSIGHT_DISABLED;
 const output=execFileSync(process.execPath,['--input-type=module','-e',program],{env,cwd:home,encoding:'utf8'});
 assert.match(output,/Official runtime uses Pi config/);
}));
