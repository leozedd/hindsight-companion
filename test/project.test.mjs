import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, realpath, rm, stat, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, normalize } from 'node:path';
import { registerCurrentProject, projectDirectory, registerProjectCommand } from '../extension/project.js';

const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const portable = path => path.replaceAll('\\', '/');
async function fixture(fn) {
 const base = await mkdtemp(join(tmpdir(), 'companion-project-'));
 try {
  const root = join(base, 'sample-project'), configPath = join(base, 'hindsight.json');
  await mkdir(join(root, 'src'), { recursive: true });
  git(root, 'init', '-q');
  const config = { disabled: false, bankId: 'personal', dynamicBankId: false, apiToken: 'synthetic-test-value', retainSessions: false, pageRefreshEveryTurns: 10, mapPathToBank: { [portable(join(base, 'other'))]: 'other-bank' } };
  await writeFile(configPath, JSON.stringify(config) + '\n');
  await fn({ base, root, configPath, config });
 } finally { await rm(base, { recursive: true, force: true }); }
}

test('registers Git root from a child directory and preserves existing settings', () => fixture(async ({ root, configPath, config }) => {
 const result = await registerCurrentProject(configPath, join(root, 'src'));
 assert.equal(normalize(result.root), normalize(root));
 assert.equal(result.bank, 'coding-agent::sample-project');assert.equal(result.changed, true);
 const current = JSON.parse(await readFile(configPath, 'utf8'));
 const routes = Object.fromEntries([...new Set([root, await realpath(root)])].map(path => [portable(path), result.bank]));
 assert.deepEqual(current, { ...config, mapPathToBank: { ...config.mapPathToBank, ...routes } });
 assert.deepEqual(JSON.parse(await readFile(configPath + '.before-project-registration', 'utf8')), config);
 await assert.rejects(stat(configPath + '.companion.lock'), error => error.code === 'ENOENT');
 if (process.platform !== 'win32') assert.equal((await stat(configPath)).mode & 0o777, (await stat(configPath + '.before-project-registration')).mode & 0o777);
}));

test('repeat registration keeps an existing bank; conflicting explicit destination is refused', () => fixture(async ({ root, configPath }) => {
 await registerCurrentProject(configPath, root, 'team-project');
 const before = await readFile(configPath, 'utf8');
 assert.equal((await registerCurrentProject(configPath, root)).bank, 'team-project');
 assert.equal((await registerCurrentProject(configPath, root, 'team-project')).changed, false);
 await assert.rejects(registerCurrentProject(configPath, root, 'different-bank'), /already mapped/);
 assert.equal(await readFile(configPath, 'utf8'), before);
}));

test('explicit registration works outside Git and supports paths with spaces', () => fixture(async ({ base, configPath }) => {
 const folder = join(base, 'folder with spaces');await mkdir(folder);
 const result = await registerCurrentProject(configPath, folder, 'notes-workspace');
 assert.equal(result.root, folder);assert.equal(result.bank, 'notes-workspace');
}));

test('linked worktrees use the main project mapping', () => fixture(async ({ base, root, configPath }) => {
 git(root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.com', 'commit', '--allow-empty', '-q', '-m', 'fixture');
 const worktree = join(base, 'linked-worktree');git(root, 'worktree', 'add', '--detach', '-q', worktree);
 assert.equal(normalize(await projectDirectory(worktree)), normalize(root));
 const result = await registerCurrentProject(configPath, worktree);
 assert.equal(normalize(result.root), normalize(root));assert.equal(result.bank, 'coding-agent::sample-project');
 const second = await registerCurrentProject(configPath, root);assert.equal(second.changed, false);
}));

test('directory aliases retain the host path spelling used by native routing', () => fixture(async ({ base, root, configPath }) => {
 const alias = join(base, 'project-alias');await symlink(root, alias, process.platform === 'win32' ? 'junction' : 'dir');
 const result = await registerCurrentProject(configPath, join(alias, 'src'), 'alias-project');
 assert.equal(normalize(result.root), normalize(alias));
 const saved = JSON.parse(await readFile(configPath, 'utf8')).mapPathToBank;
 assert.equal(saved[portable(alias)], 'alias-project');assert.equal(saved[portable(await realpath(root))], 'alias-project');
 assert.equal((await registerCurrentProject(configPath, root)).bank, 'alias-project');
}));

test('an explicit Pi harness map is updated without modifying the global map', () => fixture(async ({ root, configPath, config }) => {
 config.harnesses = { pi: { mapPathToBank: {} }, another: { disabled: true } };
 await writeFile(configPath, JSON.stringify(config));await registerCurrentProject(configPath, root);
 const current = JSON.parse(await readFile(configPath, 'utf8'));
 assert.deepEqual(current.mapPathToBank, config.mapPathToBank);
 assert.equal(current.harnesses.pi.mapPathToBank[portable(root)], 'coding-agent::sample-project');
 assert.deepEqual(current.harnesses.another, config.harnesses.another);
}));

test('invalid JSON never echoes its content or overwrites the configuration', () => fixture(async ({ root, configPath }) => {
 const invalid = '{"apiToken":"fixture-invalid-value"';await writeFile(configPath, invalid);
 await assert.rejects(registerCurrentProject(configPath, root), error => /not valid JSON/.test(error.message) && !error.message.includes('fixture-invalid-value'));
 assert.equal(await readFile(configPath, 'utf8'), invalid);
}));

test('invalid map and malformed bank arguments leave configuration unchanged', () => fixture(async ({ root, configPath, config }) => {
 const before = await readFile(configPath, 'utf8');
 await assert.rejects(registerCurrentProject(configPath, root, 'two words'), /Usage:/);
 assert.equal(await readFile(configPath, 'utf8'), before);
 await writeFile(configPath, JSON.stringify({ ...config, mapPathToBank: [] }));
 await assert.rejects(registerCurrentProject(configPath, root), /JSON object/);
}));

test('concurrent configuration mutation is refused rather than overwritten', () => fixture(async ({ root, configPath }) => {
 const before = await readFile(configPath, 'utf8');await writeFile(configPath + '.companion.lock', '');
 await assert.rejects(registerCurrentProject(configPath, root), /update is in progress/);
 assert.equal(await readFile(configPath, 'utf8'), before);
}));

test('command saves then reloads, and explains a failed reload without losing the mapping', () => fixture(async ({ root, configPath }) => {
 let command, reloads = 0;const notices = [];
 registerProjectCommand({ registerCommand(name, options) { assert.equal(name, 'hindsight-project');command = options; } }, configPath);
 const ctx = { cwd: join(root, 'src'), ui: { notify: (...args) => notices.push(args) }, async reload() { reloads++;assert.ok(JSON.parse(await readFile(configPath, 'utf8')).mapPathToBank[portable(root)]); } };
 await command.handler('', ctx);assert.equal(reloads, 1);assert.match(notices[0][0], /Reloading Pi/);
 ctx.reload = async () => { throw Error('fixture reload error'); };
 await command.handler('', ctx);assert.match(notices.at(-1)[0], /mapping is saved, but reload failed/);
 await command.handler('conflicting-bank', ctx);assert.equal(notices.at(-1)[1], 'error');
}));

test('official runtime routes the registered project and its worktree separately from personal', () => fixture(async ({ base, root, configPath, config }) => {
 git(root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.com', 'commit', '--allow-empty', '-q', '-m', 'fixture');
 const worktree = join(base, 'worktree');git(root, 'worktree', 'add', '--detach', '-q', worktree);
 config.serverMode = 'self-hosted';config.apiUrl = 'http://127.0.0.1:8888';
 Object.assign(config, { autoSeed: false, gitIngest: 'none', codebaseSurvey: false, manageBankConfig: false });
 await writeFile(configPath, JSON.stringify(config));await registerCurrentProject(configPath, root);
 const entry = new URL('../extension/hindsight.js', import.meta.url).href;
 const program = `import assert from 'node:assert/strict';import companion from ${JSON.stringify(entry)};const tools=[],commands=[];const pi=new Proxy({},{get:(_t,k)=>(...args)=>{if(k==='registerTool')tools.push(args[0]);if(k==='registerCommand')commands.push(args[0]);}});await companion(pi);assert.equal(tools.length,8);assert.ok(commands.includes('hindsight-project'));const result=await tools.find(t=>t.name==='hindsight_diagnose').execute('check',{},undefined,undefined,{cwd:process.cwd()});console.log(JSON.parse(result.content[0].text).bank_id);`;
 for (const [cwd, expected] of [[root, 'coding-agent::sample-project'], [join(root, 'src'), 'coding-agent::sample-project'], [worktree, 'coding-agent::sample-project'], [base, 'personal']]) {
  const env = { ...process.env, HINDSIGHT_CONFIG: configPath, HINDSIGHT_DISABLE_HOOKS: '1' };delete env.HINDSIGHT_DISABLED;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', program], { cwd, env, encoding: 'utf8' });assert.equal(output.trim(), expected, `bank for ${cwd}`);
 }
}));
