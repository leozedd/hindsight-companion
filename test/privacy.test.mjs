import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectText} from '../scripts/privacy-audit.mjs';
import {basename} from 'node:path';
import {homedir} from 'node:os';

test('privacy gate rejects common credentials without printing values',()=>{
 for(const token of ['ghp_'+'a'.repeat(30),'sk-'+'b'.repeat(30),'npm_'+'c'.repeat(30)]) {
  assert.ok(inspectText(token).includes('credential token'));
 }
});
test('privacy gate rejects user paths, LAN addresses and personal identifiers',()=>{
 assert.ok(inspectText(['C:','Users','someone','secrets'].join('/')).includes('private user path'));
 assert.ok(inspectText([192,168,1,2].join('.')).includes('private LAN address'));
 assert.ok(inspectText('private-marker',['private-marker']).includes('local/private identifier'));
});
test('hosted CI account name is permitted; explicit private markers still blocked',()=>{
 const old=process.env.GITHUB_ACTIONS;process.env.GITHUB_ACTIONS='true';
 try {
  assert.deepEqual(inspectText(basename(homedir())),[]);
  assert.ok(inspectText('private-marker',['private-marker']).includes('local/private identifier'));
 } finally {if(old===undefined)delete process.env.GITHUB_ACTIONS;else process.env.GITHUB_ACTIONS=old;}
});
test('empty configuration and loopback are permitted',()=>{
 assert.deepEqual(inspectText('{"apiToken":"","apiUrl":"http://127.0.0.1:8888"}'),[]);
});
