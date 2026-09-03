#!/usr/bin/env node
/**
 * Graf Deploy CLI —— 跨平台、一键式、全自动部署器（Node >= 18，macOS / Linux / Windows）
 *
 * 用法:
 *   node scripts/deploy.mjs                 # 交互问答(推荐)
 *   node scripts/deploy.mjs --yes           # 全自动，使用默认值/环境变量
 *   ADMIN_USERNAME=admin ADMIN_PASSWORD='...' node scripts/deploy.mjs
 *
 * 常用选项:
 *   --site-name <名>      站点名(默认 Graf)
 *   --no-comments         关闭评论(默认开启)
 *   --admin-user <名>     管理员用户名(替代交互/环境变量)
 *   --admin-pass <值>     管理员密码
 *   --secret <hex>        SECRET(默认自动生成)
 *   --skip-selfcheck      跳过部署前的 typecheck+tests
 *   --dry-run             只演练到 Cloudflare 操作前为止
 *   --no-color            关闭彩色输出
 *   --debug               输出调试日志(同时写日志文件)
 *   -h, --help            帮助
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import crypto from 'node:crypto';

const isWin = process.platform === 'win32';
const NO_COLOR = !!process.env.NO_COLOR;
const HAS_TTY = !!process.stdout.isTTY;
const useColor = HAS_TTY && !NO_COLOR && !process.argv.includes('--no-color');
const c = {
  bold: (s) => (useColor ? '\x1b[1m' + s + '\x1b[0m' : s),
  dim: (s) => (useColor ? '\x1b[2m' + s + '\x1b[0m' : s),
  green: (s) => (useColor ? '\x1b[32m' + s + '\x1b[0m' : s),
  yellow: (s) => (useColor ? '\x1b[33m' + s + '\x1b[0m' : s),
  red: (s) => (useColor ? '\x1b[31m' + s + '\x1b[0m' : s),
  cyan: (s) => (useColor ? '\x1b[36m' + s + '\x1b[0m' : s),
};
const LOG_FILE = path.join(getRoot(), 'graf-deploy.log');

/* ---------------- logging ---------------- */
const ts = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
function log(level, msg) {
  const line = '[' + ts() + '] ' + level + ' ' + msg;
  try { fs.appendFileSync(LOG_FILE, line + os.EOL); } catch { /* ignore */ }
  if (level === 'DEBUG' && !DEBUG) return;
  const icon = { INFO: 'ℹ', OK: '✔', WARN: '⚠', ERROR: '✖', STEP: '▶', DEBUG: '·' }[level] || '·';
  const color = { INFO: c.dim, OK: c.green, WARN: c.yellow, ERROR: c.red, STEP: c.cyan, DEBUG: c.dim }[level] || ((x) => x);
  console.log(color(icon + ' ' + msg));
}
const info = (m) => log('INFO', m);
const ok = (m) => log('OK', m);
const warn = (m) => log('WARN', m);
const step = (m) => log('STEP', m);
const fail = (m) => {
  const line = '[' + ts() + '] ERROR ' + m;
  try { fs.appendFileSync(LOG_FILE, line + os.EOL); } catch { /* ignore */ }
  console.log('');
  console.log(c.red('✖ ' + m));
  console.log(c.dim('  完整日志: ' + LOG_FILE));
  process.exit(1);
};
const DEBUG = process.argv.includes('--debug');
const debug = (m) => log('DEBUG', m);

/* ---------------- cli args / env ---------------- */
function getArgs() {
  const a = process.argv.slice(2);
  const map = { site: null, comments: true, adminUser: null, adminPass: null, secret: null };
  const flags = { yes: false, skipSelfcheck: false, dryRun: false, help: false };
  for (let i = 0; i < a.length; i++) {
    const arg = a[i];
    const next = () => a[++i];
    if (arg === '-h' || arg === '--help') flags.help = true;
    else if (arg === '--yes' || arg === '-y') flags.yes = true;
    else if (arg === '--skip-selfcheck') flags.skipSelfcheck = true;
    else if (arg === '--dry-run') flags.dryRun = true;
    else if (arg === '--site-name') map.site = next();
    else if (arg === '--no-comments') map.comments = false;
    else if (arg === '--comments') map.comments = true;
    else if (arg === '--admin-user') map.adminUser = next();
    else if (arg === '--admin-pass') map.adminPass = next();
    else if (arg === '--secret') map.secret = next();
    else if (arg.startsWith('--')) warn('未知参数: ' + arg);
  }
  return { map, flags };
}
const { map: AM, flags: FL } = getArgs();
let AUTO_PASSWORD = '';
if (FL.help) {
  console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('/**')[1].split('*/')[0]);
  process.exit(0);
}

/* ---------------- helpers ---------------- */
function getRoot() {
  return path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
}
function dbIdPresent() {
  try {
    const toml = fs.readFileSync(path.join(ROOT, 'wrangler.toml'), 'utf8');
    const id = (toml.match(/database_id\s*=\s*"([^"]+)"/) || [])[1] || '';
    return !!id && !/REPLACE/i.test(id);
  } catch {
    return false;
  }
}
const ROOT = getRoot();

/** spawn a command; streams output; returns {code, out} */
function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const isWinCmd = isWin && !opts.noShell;
    const child = spawn(cmd, args, {
      cwd: opts.cwd || ROOT,
      shell: opts.shell ?? isWinCmd,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let out = '', err = '';
    const prefix = opts.prefix || '';
    child.stdout.on('data', (d) => { out += d; if (opts.verbose) process.stdout.write(prefix + d); });
    child.stderr.on('data', (d) => { err += d; if (opts.verbose) process.stderr.write(prefix + d); });
    if (opts.input != null) child.stdin.write(opts.input);
    child.stdin.end();
    child.on('error', (e) => resolve({ code: -1, out, err: String(e && e.message || e) }));
    child.on('close', (code) => resolve({ code, out, err }));
  });
}

async function ask(question, def) {
  if (FL.yes) return def;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((res) => rl.question(question + (def != null ? ' [' + def + '] ' : ' '), res));
  rl.close();
  const v = answer.trim();
  return v === '' && def != null ? def : v;
}
/** hidden password input with confirm; falls back to env/no-echo-free approach */
async function askPassword(label) {
  if (FL.yes) return '';
  if (!HAS_TTY) throw new Error('非交互终端需要 --yes 或 ADMIN_PASSWORD 环境变量');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const hidden = (q) => new Promise((res) => {
    process.stdout.write(q);
    process.stdin.setRawMode && process.stdin.setRawMode(true);
    process.stdin.resume();
    let buf = '';
    const onData = (ch) => {
      const s = String(ch);
      for (const ch2 of s) {
        if (ch2 === '\r' || ch2 === '\n') { finish(); return; }
        if (ch2 === '\u0003') { finish(); process.exit(130); }
        if (ch2 === '\u007f' || ch2 === '\b') buf = buf.slice(0, -1);
        else buf += ch2;
      }
    };
    const finish = () => {
      process.stdin.removeListener('data', onData);
      process.stdin.setRawMode && process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
      res(buf);
    };
    process.stdin.on('data', onData);
  });
  const p1 = await hidden(label);
  const p2 = await hidden('再次输入确认: ');
  rl.close();
  if (!p1) throw new Error('密码不能为空');
  if (p1 !== p2) throw new Error('两次输入不一致');
  return p1;
}

const retry = async (fn, times = 3, gapMs = 3000, label = '') => {
  for (let i = 1; i <= times; i++) {
    try { return await fn(); }
    catch (e) {
      if (i === times) throw e;
      warn((label || '操作') + '第 ' + i + ' 次失败，' + gapMs / 1000 + 's 后重试: ' + (e && e.message || e));
      await new Promise((r) => setTimeout(r, gapMs));
    }
  }
};

/* ---------------- main flow ---------------- */
async function main() {
  const banner = [
    '',
    c.bold('  Graf 一键部署 (Cloudflare Workers + D1)'),
    c.dim('  Node ' + process.version + ' · ' + process.platform + ' · 自动完成: 检查→建库→密钥→建表→部署→自检'),
    '',
  ].join('\n');
  console.log(banner);
  info('开始执行, 日志文件: ' + LOG_FILE);
  fs.appendFileSync(LOG_FILE, '\n' + '='.repeat(60) + '\n');

  /* 1. 前置检查 */
  step('前置检查');
  if (Number(process.versions.node.split('.')[0]) < 18) fail('Node.js >= 18 是必需的, 当前 ' + process.version);
  if (!fs.existsSync(path.join(ROOT, 'wrangler.toml'))) fail('未找到 wrangler.toml, 请在仓库根目录运行本脚本');
  ok('仓库目录: ' + ROOT);

  /* 1b. dry-run: offline rehearsal only (no Cloudflare interaction needed) */
  if (FL.dryRun) {
    console.log('');
    console.log(c.cyan('  [dry-run] 演练计划（不会触碰 Cloudflare）'));
    console.log('    · 前置检查 ............ 通过');
    console.log('    · D1 数据库 ........... ' + (dbIdPresent() ? '已配置' : '将自动创建并回填 wrangler.toml'));
    console.log('    · Secret .............. 将写入 SECRET / ADMIN_USERNAME / ADMIN_PASSWORD');
    console.log('    · 迁移 ................ npx wrangler d1 migrations apply --remote');
    console.log('    · 自检 ................ typecheck + tests');
    console.log('    · 部署 ................ npx wrangler deploy');
    console.log('');
    console.log(c.dim('  完整执行时仍需一次性 Cloudflare 登录: npx wrangler login'));
    info('(--dry-run) 演练结束');
    process.exit(0);
  }

  /* 2. Cloudflare 登录 */
  step('Cloudflare 登录检查');
  const who = await run('npx', ['wrangler', 'whoami'], { verbose: DEBUG });
  const whoText = who.out + who.err;
  const authed = who.code === 0 && !/not authenticated/i.test(whoText) &&
    (/associated with the email/i.test(whoText) || /successfully authenticated/i.test(whoText) || /account id/i.test(whoText));
  if (!authed) {
    console.log('');
    console.log('  需要先登录 Cloudflare（一次性）。两种方式任选:');
    console.log('    macOS/Linux : npx wrangler login   (浏览器授权)');
    console.log('    Windows     : npx.cmd wrangler login');
    console.log('    或设置环境变量 CLOUDFLARE_API_TOKEN 后重试');
    console.log('');
    fail('未检测到 Cloudflare 登录态');
  }
  const email = whoText.match(/associated with the email ([^\s]+)/i)?.[1] || '';
  ok('Cloudflare 已登录' + (email ? ' (' + email + ')' : ''));

  /* 3. 收集配置 */
  step('收集部署配置');
  const SITE_NAME = AM.site || process.env.SITE_NAME || (FL.yes ? 'Graf' : await ask('站点名', 'Graf'));
  const COMMENTS = process.env.ENABLE_COMMENTS ? !['0', 'false', 'no', 'off'].includes(String(process.env.ENABLE_COMMENTS).toLowerCase()) : AM.comments;
  let adminUser = AM.adminUser || process.env.ADMIN_USERNAME || null;
  let adminPass = AM.adminPass || process.env.ADMIN_PASSWORD || null;
  if (!adminUser) {
    if (FL.yes) adminUser = 'admin';
    else if (HAS_TTY) adminUser = await ask('管理员用户名 (用于 /admin 登录)', 'admin');
    else fail('非交互环境: 请提供 ADMIN_USERNAME / ADMIN_PASSWORD 环境变量, 或加 --yes 自动生成');
  }
  if (!adminPass) {
    if (FL.yes || !HAS_TTY) {
      adminPass = crypto.randomBytes(8).toString('hex');
      AUTO_PASSWORD = adminPass;
    } else {
      adminPass = await askPassword('管理员密码 (输入不可见): ');
    }
  }
  if (!adminUser || !adminPass) fail('需要管理员用户名与密码');
  if (/[\s/]/.test(adminUser)) fail('管理员用户名不能包含空格或斜杠');
  const SECRET = AM.secret || process.env.SECRET || crypto.randomBytes(32).toString('hex');
  info('站点名=' + SITE_NAME + '  评论=' + (COMMENTS ? '开' : '关') + '  管理员=' + adminUser);
  debug('SECRET 已生成/提供 (' + SECRET.length + ' hex)');

  /* 4. D1 数据库 */
  step('D1 数据库');
  const tomlPath = path.join(ROOT, 'wrangler.toml');
  let toml = fs.readFileSync(tomlPath, 'utf8');
  const dbName = (toml.match(/database_name\s*=\s*"([^"]+)"/) || [])[1] || 'graf';
  let dbId = (toml.match(/database_id\s*=\s*"([^"]+)"/) || [])[1] || '';
  if (!dbId || /REPLACE/i.test(dbId)) {
    info('创建 D1 数据库: ' + dbName + ' ...');
    let res;
    try {
      res = await retry(async () => {
        const r = await run('npx', ['wrangler', 'd1', 'create', dbName], { verbose: DEBUG });
        if (r.code !== 0) throw new Error(r.err || r.out || ('exit ' + r.code));
        return r;
      }, 3, 3000, '创建 D1 数据库');
    } catch (e) {
      const msg = String(e && e.message || e);
      if (/already exists/i.test(msg)) {
        warn('数据库 ' + dbName + ' 已存在: 请手动把 database_id 填入 wrangler.toml 后重试');
        fail('需要真实的 database_id');
      }
      fail('创建数据库失败: ' + msg);
    }
    const id = (res.out + res.err).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)?.[0];
    if (!id) { console.log(res.out + res.err); fail('无法从 wrangler 输出解析 database_id'); }
    dbId = id;
    toml = toml.replace(/database_id\s*=\s*"[^"]*"/, 'database_id = "' + id + '"');
    fs.writeFileSync(tomlPath, toml);
    ok('D1 库已创建并回填 wrangler.toml (database_id=' + id.slice(0, 8) + '…)');
  } else {
    ok('D1 数据库配置就绪 (' + dbId.slice(0, 8) + '…)');
  }

  if (FL.dryRun) { info('(--dry-run) 演练至此结束，未写入任何 Cloudflare 配置'); process.exit(0); }

  /* 5. 站点配置与密钥 */
  step('写入站点配置与 Secret');
  toml = fs.readFileSync(tomlPath, 'utf8');
  toml = toml.replace(/SITE_NAME\s*=\s*"[^"]*"/, 'SITE_NAME = "' + SITE_NAME.replace(/"/g, '') + '"');
  toml = toml.replace(/ENABLE_COMMENTS\s*=\s*"[^"]*"/, 'ENABLE_COMMENTS = "' + String(COMMENTS) + '"');
  fs.writeFileSync(tomlPath, toml);
  await retry(async () => {
    for (const [k, v] of [['SECRET', SECRET], ['ADMIN_USERNAME', adminUser], ['ADMIN_PASSWORD', adminPass]]) {
      const r = await run('npx', ['wrangler', 'secret', 'put', k], { input: v + '\n', verbose: DEBUG });
      if (r.code !== 0) throw new Error('secret put ' + k + ' 失败: ' + (r.err || r.out));
    }
  }, 3, 3000, '写入 Secret');
  ok('SECRET / ADMIN_USERNAME / ADMIN_PASSWORD 已写入 Cloudflare');

  /* 6. 迁移 */
  step('D1 迁移 (建表)');
  {
    const r = await run('npx', ['wrangler', 'd1', 'migrations', 'apply', dbName, '--remote'], { verbose: DEBUG });
    if (r.code !== 0) fail('迁移失败: ' + (r.err || r.out));
  }
  ok('表结构就绪');

  /* 7. 自检 */
  if (!FL.skipSelfcheck) {
    step('代码自检 (typecheck + tests)');
    const t1 = await run('npx', ['tsc', '--noEmit']);
    const t2 = await run('npx', ['vitest', 'run']);
    if (t1.code === 0 && t2.code === 0) ok('typecheck 与测试全部通过');
    else warn('自检未通过(typecheck=' + t1.code + ', tests=' + t2.code + ')，可加 --skip-selfcheck 跳过（仍继续部署）');
  }

  /* 8. 部署 */
  step('部署到 Cloudflare ...');
  const dep = await run('npx', ['wrangler', 'deploy'], { verbose: DEBUG });
  if (dep.code !== 0) { console.log(dep.err || dep.out); fail('wrangler deploy 失败'); }
  const url = (dep.out + dep.err).match(/https:\/\/[a-z0-9.-]+\.workers\.dev/)?.[0] || '';

  /* 9. 线上自检 */
  step('线上自检');
  if (url) {
    try {
      const r = await fetch(url + '/');
      if (r.ok) ok('首页可访问 (HTTP ' + r.status + ')');
      else warn('首页 HTTP ' + r.status);
    } catch { warn('自检请求失败（可能网络原因，稍后手动打开确认）'); }
  }

  /* 10. 汇总 */
  console.log('');
  console.log(c.green('  ═══════════════════ 部署完成 ═══════════════════'));
  console.log('   站点地址 : ' + (url ? c.bold(url) : c.yellow('(未能解析 workers.dev 地址，见上方输出)')));
  if (url) {
    console.log('   后台地址 : ' + c.bold(url + '/admin'));
    console.log('   管理员   : ' + adminUser);
    if (AUTO_PASSWORD) {
      console.log(c.yellow('   密码     : ' + AUTO_PASSWORD + '   ← 自动生成，请立即保存!'));
      console.log(c.yellow('             登录后建议尽快在 Cloudflare Secret 中更换 ADMIN_PASSWORD'));
    }
    console.log('');
    console.log('   后续建议:');
    console.log(c.dim('     · 绑定自定义域名后, 把 BASE_URL 加到 wrangler.toml [vars] 并重跑本脚本'));
    console.log(c.dim('     · 数据备份/恢复: ' + url + '/admin (Export/Import)'));
    console.log(c.dim('     · 再次部署: node scripts/deploy.mjs'));
  }
  console.log(c.green('  ═════════════════════════════════════════════════'));
  info('完成, 日志见 ' + LOG_FILE);
}

main().catch((e) => { fail(e && e.stack || String(e)); });

