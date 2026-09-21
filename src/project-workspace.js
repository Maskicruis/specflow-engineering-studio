'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { ensureDir, nowIso, readJson, resolveInside, safeName, writeJson } = require('./utils');

const DEFAULT_FOLDERS = Object.freeze([
  '00工作区间',
  '01初步设计',
  '02施工图设计',
  '03提资资料',
  '04收资资料',
  '05规程规范'
]);

const DEFAULT_CHECKLIST = Object.freeze([
  { key: 'approval-scope', category: '项目依据', label: '立项批复、设计范围及边界条件完整' },
  { key: 'site-boundary', category: '项目依据', label: '用地红线、规划条件及场址坐标完整' },
  { key: 'topography', category: '基础资料', label: '现状地形图、控制点及测量坐标系完整' },
  { key: 'geotechnical', category: '基础资料', label: '岩土工程勘察及地基处理建议完整' },
  { key: 'flood-level', category: '基础资料', label: '设计洪水位、内涝水位及防洪标准完整' },
  { key: 'meteorology', category: '基础资料', label: '气象、风雪、冻土和抗震参数完整' },
  { key: 'external-interface', category: '收资与接口', label: '道路、给排水、电源、通信等外部接口条件完整' },
  { key: 'process-load', category: '收资与接口', label: '工艺条件、负荷资料及设备接口参数完整' },
  { key: 'existing-facilities', category: '收资与接口', label: '现状建构筑物、地下管线及迁改条件完整' },
  { key: 'discipline-schemes', category: '初步设计', label: '各专业主要方案和设计原则已确定' },
  { key: 'fire-safety', category: '初步设计', label: '消防、安全、职业卫生和应急设计完整' },
  { key: 'road-drainage', category: '初步设计', label: '竖向、道路、场地排水和防洪方案完整' },
  { key: 'environment-energy', category: '初步设计', label: '环保、水保、节能及绿色设计内容完整' },
  { key: 'technical-economy', category: '初步设计', label: '主要技术经济指标、工程量及投资估算完整' },
  { key: 'review-comments', category: '施工图准备', label: '初设审查意见已闭环并落实到施工图条件' },
  { key: 'calculations', category: '施工图准备', label: '计算书、设备选型和专业互提资料完整' },
  { key: 'drawing-register', category: '施工图准备', label: '图纸目录、版本和会签计划明确' },
  { key: 'construction-interface', category: '施工图准备', label: '施工界面、材料表及工程量清单已核对' }
]);

function normalizeFolderName(value) {
  const name = String(value || '').trim();
  if (!name) throw new Error('目录名称不能为空');
  if (name.length > 80) throw new Error('目录名称不能超过 80 个字符');
  if (/[\\/:*?"<>|\u0000-\u001f]/.test(name) || name === '.' || name === '..') throw new Error('目录名称包含无效字符');
  return name;
}

function normalizeFolders(values) {
  const source = Array.isArray(values) ? values : DEFAULT_FOLDERS;
  const result = [];
  const seen = new Set();
  for (const value of source) {
    const name = normalizeFolderName(value);
    const key = name.toLowerCase();
    if (!seen.has(key)) { seen.add(key); result.push(name); }
  }
  if (!result.length) throw new Error('至少需要一个项目目录');
  if (result.length > 50) throw new Error('项目目录不能超过 50 个');
  return result;
}

function defaultChecklistItems() {
  return DEFAULT_CHECKLIST.map(item => ({
    id: 'check_' + item.key,
    category: item.category,
    label: item.label,
    required: true,
    status: 'missing',
    note: '',
    updatedAt: ''
  }));
}

function checklistProgress(items = []) {
  const applicable = items.filter(item => item.status !== 'na');
  const ready = applicable.filter(item => item.status === 'ready').length;
  return { ready, applicable: applicable.length, total: items.length, percent: applicable.length ? Math.round(ready * 100 / applicable.length) : 100 };
}

class ProjectWorkspace {
  constructor({ dataDir }) {
    this.file = path.join(ensureDir(dataDir), 'engineering-projects.json');
    const stored = readJson(this.file, {});
    this.settings = { defaultFolders: normalizeFolders(stored?.settings?.defaultFolders || DEFAULT_FOLDERS) };
    this.projects = Array.isArray(stored.projects) ? stored.projects : [];
    this.persist();
  }

  persist() {
    writeJson(this.file, { schemaVersion: 1, settings: this.settings, projects: this.projects });
  }

  publicProject(project, detail = false) {
    const value = {
      id: project.id,
      name: project.name,
      baseDirectory: project.baseDirectory,
      projectDirectory: project.projectDirectory,
      folders: project.folders.slice(),
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      checklistProgress: checklistProgress(project.checklist)
    };
    if (detail) value.checklist = project.checklist.map(item => ({ ...item }));
    return value;
  }

  snapshot() {
    return {
      settings: { defaultFolders: this.settings.defaultFolders.slice() },
      projects: this.projects.map(project => this.publicProject(project))
    };
  }

  updateSettings(patch = {}) {
    if (patch.defaultFolders) this.settings.defaultFolders = normalizeFolders(patch.defaultFolders);
    this.persist();
    return { defaultFolders: this.settings.defaultFolders.slice() };
  }

  getProject(id) {
    const project = this.projects.find(item => item.id === String(id || ''));
    if (!project) throw new Error('工程项目不存在');
    return project;
  }

  project(id) {
    return this.publicProject(this.getProject(id), true);
  }

  createProject(payload = {}) {
    const name = String(payload.name || '').trim();
    if (!name) throw new Error('项目名称不能为空');
    if (name.length > 120) throw new Error('项目名称不能超过 120 个字符');
    const baseValue = String(payload.baseDirectory || '').trim();
    if (!baseValue) throw new Error('请选择项目保存目录');
    const baseDirectory = path.resolve(baseValue);
    if (!path.isAbsolute(baseDirectory)) throw new Error('请选择项目保存目录');
    ensureDir(baseDirectory);
    const projectName = safeName(name);
    const projectDirectory = resolveInside(baseDirectory, projectName);
    const folders = normalizeFolders(payload.folders || this.settings.defaultFolders);
    ensureDir(projectDirectory);
    for (const folder of folders) ensureDir(resolveInside(projectDirectory, folder));
    const now = nowIso();
    const project = {
      id: 'prj_' + crypto.randomUUID(),
      name,
      baseDirectory,
      projectDirectory,
      folders,
      checklist: defaultChecklistItems(),
      createdAt: now,
      updatedAt: now
    };
    this.projects.unshift(project);
    this.persist();
    return this.publicProject(project, true);
  }

  syncFolders(id) {
    const project = this.getProject(id);
    const folders = normalizeFolders(this.settings.defaultFolders);
    for (const folder of folders) ensureDir(resolveInside(project.projectDirectory, folder));
    project.folders = Array.from(new Set(project.folders.concat(folders)));
    project.updatedAt = nowIso();
    this.persist();
    return this.publicProject(project, true);
  }

  updateChecklist(id, itemId, patch = {}) {
    const project = this.getProject(id);
    const item = project.checklist.find(entry => entry.id === String(itemId || ''));
    if (!item) throw new Error('检查项不存在');
    if (patch.status !== undefined) {
      const status = String(patch.status);
      if (!['missing', 'ready', 'na'].includes(status)) throw new Error('检查项状态无效');
      item.status = status;
    }
    if (patch.note !== undefined) item.note = String(patch.note || '').slice(0, 1000);
    item.updatedAt = nowIso();
    project.updatedAt = item.updatedAt;
    this.persist();
    return this.publicProject(project, true);
  }

  addChecklistItem(id, payload = {}) {
    const project = this.getProject(id);
    const label = String(payload.label || '').trim();
    if (!label) throw new Error('检查项内容不能为空');
    if (label.length > 160) throw new Error('检查项内容不能超过 160 个字符');
    const item = {
      id: 'check_' + crypto.randomUUID(),
      category: String(payload.category || '自定义').trim().slice(0, 40) || '自定义',
      label,
      required: payload.required !== false,
      status: 'missing',
      note: '',
      updatedAt: nowIso()
    };
    project.checklist.push(item);
    project.updatedAt = item.updatedAt;
    this.persist();
    return this.publicProject(project, true);
  }
}

module.exports = {
  DEFAULT_CHECKLIST,
  DEFAULT_FOLDERS,
  ProjectWorkspace,
  checklistProgress,
  normalizeFolders
};
