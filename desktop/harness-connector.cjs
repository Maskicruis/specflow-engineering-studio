'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PACKAGE_NAME = '@specflow/dsh-knowledge-tools';

function firstExisting(candidates) {
  return candidates.find(candidate => candidate && fs.existsSync(candidate)) || '';
}

function dshHome() {
  return path.resolve(process.env.DSH_HOME || path.join(os.homedir(), '.dsh'));
}

function pluginSource() {
  return path.resolve(__dirname, '..', 'packages', 'dsh-specflow-knowledge');
}

function resolveDshCli(root = dshHome()) {
  return firstExisting([
    process.env.DSH_CLI,
    path.join(root, 'profiles', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
  ]);
}

function resolveNodeExecutable() {
  return firstExisting([
    process.env.SPECFLOW_NODE,
    process.resourcesPath && path.join(process.resourcesPath, 'runtime', process.platform === 'win32' ? 'node.exe' : 'node'),
    path.resolve(__dirname, '..', 'assets', 'runtime', process.platform === 'win32' ? 'node.exe' : 'node'),
    process.platform === 'win32' && process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'nodejs', 'node.exe') : '',
    process.platform === 'win32' ? 'C:\\Program Files\\nodejs\\node.exe' : process.execPath
  ]);
}

function readJson(file, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function connectorStatus(options = {}) {
  const root = path.resolve(options.dshHome || dshHome());
  const profile = path.join(root, 'profiles', 'web');
  const manifest = readJson(path.join(profile, 'package.json'));
  const declared = Boolean(manifest.dependencies && manifest.dependencies[PACKAGE_NAME]);
  const enabled = Array.isArray(manifest?.dsh?.profile?.bundles) && manifest.dsh.profile.bundles.includes(PACKAGE_NAME);
  const installedManifest = readJson(path.join(profile, 'node_modules', '@specflow', 'dsh-knowledge-tools', 'package.json'));
  return {
    available: Boolean(manifest.name),
    installed: Boolean(declared && enabled && installedManifest.version),
    declared,
    enabled,
    version: installedManifest.version || '',
    profile,
    pluginSource: pluginSource(),
    message: declared && enabled && installedManifest.version
      ? `连接工具已安装（${installedManifest.version}）`
      : manifest.name ? '尚未安装 SpecFlow 连接工具' : '未检测到 DeepSeek Harness Studio 配置'
  };
}

function writeJsonAtomic(file, value) {
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

async function installConnector(options = {}) {
  const root = path.resolve(options.dshHome || dshHome());
  const source = pluginSource();
  if (!fs.existsSync(path.join(source, 'package.json'))) throw new Error('安装包中缺少 SpecFlow Harness 连接工具。');
  const profile = path.join(root, 'profiles', 'web');
  const manifestPath = path.join(profile, 'package.json');
  const manifest = readJson(manifestPath, null);
  if (!manifest || !manifest.name) throw new Error('未检测到 DeepSeek Harness Studio。请先启动一次 DeepSeek Harness Studio，再重试。');
  const target = path.join(profile, 'node_modules', '@specflow', 'dsh-knowledge-tools');
  fs.mkdirSync(target, { recursive: true });
  fs.cpSync(source, target, { recursive: true, force: true, dereference: true });
  manifest.dependencies = { ...(manifest.dependencies || {}), [PACKAGE_NAME]: `file:${source.replace(/\\/g, '/')}` };
  manifest.dsh = manifest.dsh && typeof manifest.dsh === 'object' ? manifest.dsh : {};
  manifest.dsh.profile = manifest.dsh.profile && typeof manifest.dsh.profile === 'object' ? manifest.dsh.profile : {};
  const bundles = Array.isArray(manifest.dsh.profile.bundles) ? manifest.dsh.profile.bundles.slice() : [];
  if (!bundles.includes(PACKAGE_NAME)) bundles.push(PACKAGE_NAME);
  manifest.dsh.profile.bundles = bundles;
  writeJsonAtomic(manifestPath, manifest);
  const status = connectorStatus({ dshHome: root });
  if (!status.installed) throw new Error('连接工具命令已完成，但 Harness profile 未启用该插件。请在 DeepSeek Harness Studio 插件页检查安装日志。');
  return { ...status, restartRequired: true, message: `连接工具 ${status.version} 已安装。请重启 DeepSeek Harness Studio 后使用。` };
}

function discoveryPath(root = dshHome()) {
  return path.join(root, 'integrations', 'specflow.json');
}

function writeDiscovery(record, options = {}) {
  const target = discoveryPath(options.dshHome || dshHome());
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify({ version: 1, ...record }, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, target);
  return target;
}

module.exports = {
  PACKAGE_NAME,
  connectorStatus,
  discoveryPath,
  firstExisting,
  installConnector,
  pluginSource,
  resolveDshCli,
  resolveNodeExecutable,
  writeDiscovery
};
