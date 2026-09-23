'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const CALCULATOR_ID = 'calculator';
const DEFAULT_CALCULATOR = 'C:\\Users\\Administrator\\Desktop\\工作任务\\个人工具箱\\设计工具\\多功能计算器.exe';

function readJson(file, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

function normalizeExecutable(value) {
  const target = path.resolve(String(value || '').trim());
  if (!/\.(?:exe|cmd|bat)$/i.test(target)) throw new Error('设计工具必须是 exe、cmd 或 bat 文件');
  return target;
}

class DesignToolRegistry {
  constructor({ dataDir, calculatorPath = process.env.SPECFLOW_CALCULATOR || DEFAULT_CALCULATOR, spawnImpl = spawn } = {}) {
    this.file = path.join(path.resolve(dataDir), 'design-tools.json');
    this.spawnImpl = spawnImpl;
    const stored = readJson(this.file, {});
    this.tools = {
      [CALCULATOR_ID]: {
        id: CALCULATOR_ID,
        name: '多功能计算器',
        description: '调用已配置的本地工程计算程序，适合常用公式与数值计算',
        category: 'general',
        discipline: '通用计算',
        icon: '∑',
        launchMode: 'external',
        path: String(stored?.tools?.[CALCULATOR_ID]?.path || calculatorPath),
        hotkey: 'Ctrl+Alt+C',
        kind: 'executable'
      }
    };
    this.persist();
  }

  persist() { writeJsonAtomic(this.file, { schemaVersion: 1, tools: this.tools }); }

  publicTool(tool) { return { ...tool, available: Boolean(tool.path && fs.existsSync(tool.path)) }; }

  list() {
    return {
      items: [this.publicTool(this.tools[CALCULATOR_ID]), {
        id: 'road-slope', name: '道路排水坡度设计', description: '根据实际距离、坡向和控制标高计算逐节点排水网络', category: 'site', discipline: '总图与道路', icon: '↘', launchMode: 'window', route: '/tools/road-slope', hotkey: 'Ctrl+Alt+R', kind: 'built-in', available: true
      }]
    };
  }

  update(id, patch = {}) {
    const tool = this.tools[String(id || '')];
    if (!tool) throw new Error('设计工具不存在');
    if (patch.path !== undefined) tool.path = normalizeExecutable(patch.path);
    this.persist();
    return this.publicTool(tool);
  }

  launch(id) {
    const tool = this.tools[String(id || '')];
    if (!tool) throw new Error('设计工具不存在');
    const executable = normalizeExecutable(tool.path);
    if (!fs.existsSync(executable) || !fs.statSync(executable).isFile()) throw new Error('未找到多功能计算器，请在设置中选择程序文件');
    const child = this.spawnImpl(executable, [], { detached: true, stdio: 'ignore', windowsHide: false });
    if (child && typeof child.unref === 'function') child.unref();
    return { launched: true, id: tool.id, name: tool.name, path: executable };
  }
}

module.exports = { CALCULATOR_ID, DEFAULT_CALCULATOR, DesignToolRegistry, normalizeExecutable };
