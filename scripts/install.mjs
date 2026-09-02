#!/usr/bin/env node
/**
 * Graf 一键安装引导 (跨平台 Node 脚本)
 *
 * 在尚未克隆仓库的机器上使用; 它会 clone 仓库并转交 scripts/deploy.mjs 完成全自动部署。
 *
 *   macOS / Linux / WSL:
 *     curl -fsSL https://raw.githubusercontent.com/redtidev1918/graf/master/scripts/install.mjs -o /tmp/graf-install.mjs
 *     node /tmp/graf-install.mjs
 *
 *   Windows (PowerShell):
 *     curl.exe -fsSL https://raw.githubusercontent.com/redtidev1918/graf/master/scripts/install.mjs -o "$env:TEMP\graf-install.mjs"
 *     node "$env:TEMP\graf-install.mjs"
 *
 * 参数会原样传给 deploy.mjs, 例如:
 *     node /tmp/graf-install.mjs --yes --site-name MySite
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const REPO = 'https://github.com/redtidev1918/graf.git';
const DIR = process.argv[2] && !process.argv[2].startsWith('-') ? process.argv[2] : 'graf';
const deployArgs = process.argv.slice(2).filter((a) => a !== DIR);

const c = {
  green: (s) => (process.stdout.isTTY ? '\x1b[32m' + s + '\x1b[0m' : s),
  red: (s) => (process.stdout.isTTY ? '\x1b[31m' + s + '\x1b[0m' : s),
  dim: (s) => (process.stdout.isTTY ? '\x1b[2m' + s + '\x1b[0m' : s),
};
const log = (m) => console.log(c.green('==>') + ' ' + m);
const fail = (m) => { console.error(c.red('✖ ' + m)); process.exit(1); };

function run(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'], shell: process.platform === 'win32', windowsHide: true });
    child.on('error', (e) => resolve({ code: -1, msg: String(e && e.message || e) }));
    child.on('close', (code) => resolve({ code }));
  });
}

if (Number(process.versions.node.split('.')[0]) < 18) fail('需要 Node.js >= 18，当前 ' + process.version);
const git = await run(process.platform === 'win32' ? 'git' : 'git', ['--version']);
if (git.code !== 0) fail('未检测到 git。请安装 https://git-scm.com 后重试');

if (fs.existsSync(DIR)) {
  log('目录 ' + DIR + ' 已存在，拉取最新代码 ...');
  const pull = await run('git', ['-C', DIR, 'pull', '--ff-only']);
  if (pull.code !== 0) log('拉取失败(忽略, 继续使用本地代码): ' + JSON.stringify(pull));
} else {
  log('克隆仓库 ...');
  const clone = await run('git', ['clone', '--depth', '1', REPO, DIR]);
  if (clone.code !== 0) fail('克隆失败: ' + JSON.stringify(clone));
  log('仓库已就绪');
}

const deploy = path.resolve(DIR, 'scripts', 'deploy.mjs');
if (!fs.existsSync(deploy)) fail('未找到 ' + deploy + '，请确认克隆的是完整仓库');
log('启动一键部署 ...');
console.log(c.dim('------------------------------------------------------------'));
process.exitCode = await new Promise((resolve) => {
  const child = spawn(process.execPath, [deploy, ...deployArgs], { stdio: 'inherit', windowsHide: true });
  child.on('error', (e) => { console.error(e); resolve(1); });
  child.on('close', (code) => resolve(code === null ? 1 : code));
});

