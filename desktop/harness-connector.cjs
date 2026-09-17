'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PACKAGE_NAME = '@specflow/dsh-knowledge-tools';
const SKILL_NAME = 'specflow-design-review';

function firstExisting(candidates) {
  return candidates.find(candidate => candidate && fs.existsSync(candidate)) || '';
}

function dshHome() {
  return path.resolve(process.env.DSH_HOME || path.join(os.homedir(), '.dsh'));
}

function pluginSource() {
  return path.resolve(__dirname, '..', 'packages', 'dsh-specflow-knowledge');
}

function skillSource() {
  return path.resolve(__dirname, '..', 'packages', 'dsh-specflow-review-skill');
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

function readSkillVersion(file) {
  try {
    const source = fs.readFileSync(file, 'utf8');
    return source.match(/^version:\s*['"]?([^'"\r\n]+)['"]?\s*$/m)?.[1]?.trim() || '';
  } catch { return ''; }
}

function replaceDirectory(source, root, name) {
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, name);
  if (path.dirname(target) !== resolvedRoot) throw new Error('连接组件安装路径越界。');
  const suffix = `${process.pid}-${Date.now()}`;
  const staging = path.join(resolvedRoot, `.${name}.staging-${suffix}`);
  const backup = path.join(resolvedRoot, `.${name}.backup-${suffix}`);
  fs.mkdirSync(resolvedRoot, { recursive: true });
  try {
    fs.cpSync(source, staging, { recursive: true, force: true, dereference: true });
    if (fs.existsSync(target)) fs.renameSync(target, backup);
    fs.renameSync(staging, target);
    if (fs.existsSync(backup)) fs.rmSync(backup, { recursive: true, force: true });
  } catch (error) {
    if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true, force: true });
    if (!fs.existsSync(target) && fs.existsSync(backup)) fs.renameSync(backup, target);
    throw error;
  }
  return target;
}

function connectorStatus(options = {}) {
  const root = path.resolve(options.dshHome || dshHome());
  const profile = path.join(root, 'profiles', 'web');
  const manifest = readJson(path.join(profile, 'package.json'));
  const declared = Boolean(manifest.dependencies && manifest.dependencies[PACKAGE_NAME]);
  const enabled = Array.isArray(manifest?.dsh?.profile?.bundles) && manifest.dsh.profile.bundles.includes(PACKAGE_NAME);
  const installedManifest = readJson(path.join(profile, 'node_modules', '@specflow', 'dsh-knowledge-tools', 'package.json'));
  const pluginInstalled = Boolean(declared && enabled && installedManifest.version);
  const skillPath = path.join(root, 'skills', SKILL_NAME);
  const skillDocument = path.join(skillPath, 'SKILL.md');
  const skillVersion = readSkillVersion(skillDocument);
  const skillInstalled = Boolean(skillVersion);
  return {
    available: Boolean(manifest.name),
    installed: Boolean(pluginInstalled && skillInstalled),
    pluginInstalled,
    skillInstalled,
    declared,
    enabled,
    version: installedManifest.version || '',
    skillVersion,
    skillName: SKILL_NAME,
    skillPath,
    profile,
    pluginSource: pluginSource(),
    skillSource: skillSource(),
    message: pluginInstalled && skillInstalled
      ? `连接工具 ${installedManifest.version} 与 /${SKILL_NAME} 工作流已安装`
      : pluginInstalled
        ? `知识工具已安装，尚缺 /${SKILL_NAME} 工作流`
        : manifest.name ? '尚未安装 SpecFlow Harness 集成组件' : '未检测到 DeepSeek Harness Studio 配置'
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
  const reviewSkillSource = skillSource();
  if (!fs.existsSync(path.join(source, 'package.json'))) throw new Error('安装包中缺少 SpecFlow Harness 连接工具。');
  if (!fs.existsSync(path.join(reviewSkillSource, 'SKILL.md'))) throw new Error('安装包中缺少 SpecFlow 工程规范审查工作流。');
  const profile = path.join(root, 'profiles', 'web');
  const manifestPath = path.join(profile, 'package.json');
  const manifest = readJson(manifestPath, null);
  if (!manifest || !manifest.name) throw new Error('未检测到 DeepSeek Harness Studio。请先启动一次 DeepSeek Harness Studio，再重试。');
  replaceDirectory(source, path.join(profile, 'node_modules', '@specflow'), 'dsh-knowledge-tools');
  replaceDirectory(reviewSkillSource, path.join(root, 'skills'), SKILL_NAME);
  manifest.dependencies = { ...(manifest.dependencies || {}), [PACKAGE_NAME]: `file:${source.replace(/\\/g, '/')}` };
  manifest.dsh = manifest.dsh && typeof manifest.dsh === 'object' ? manifest.dsh : {};
  manifest.dsh.profile = manifest.dsh.profile && typeof manifest.dsh.profile === 'object' ? manifest.dsh.profile : {};
  const bundles = Array.isArray(manifest.dsh.profile.bundles) ? manifest.dsh.profile.bundles.slice() : [];
  if (!bundles.includes(PACKAGE_NAME)) bundles.push(PACKAGE_NAME);
  manifest.dsh.profile.bundles = bundles;
  writeJsonAtomic(manifestPath, manifest);
  const status = connectorStatus({ dshHome: root });
  if (!status.installed) throw new Error('集成组件写入完成，但 Harness 未同时识别工具插件和审查工作流。请检查 Harness profile 与 Skills 目录。');
  return { ...status, restartRequired: true, message: `集成组件 ${status.version} 已安装。重启 Harness 后可输入 /${SKILL_NAME}。` };
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
  SKILL_NAME,
  connectorStatus,
  discoveryPath,
  firstExisting,
  installConnector,
  pluginSource,
  skillSource,
  resolveDshCli,
  resolveNodeExecutable,
  writeDiscovery
};
