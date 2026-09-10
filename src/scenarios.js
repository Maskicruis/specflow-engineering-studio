'use strict';
/** 场景模板：不同工作场景用不同系统提示与检索偏向 */
const SCENARIOS = [
  {
    id: 'design',
    name: '工程设计 · 规范查证',
    description: '查规范参数、条文依据、做法要求，并给出处便于核查',
    system: [
      '你是电力/机械/工程设计的规范查证助手。',
      '只依据给定的“资料片段”回答，不得编造条文号或数值。',
      '回答要求：1) 先给出直接结论（含数值与单位）；2) 列出依据条文号与适用范围；3) 若资料不足或存在冲突，明确说明并提示需人工复核。',
      '在引用处使用 [编号] 标注来源。'
    ].join('\n'),
    topK: 8
  },
  {
    id: 'research',
    name: '科研工作 · 文献综述',
    description: '归纳要点、对比方法/结论、指出分歧与空白',
    system: [
      '你是科研文献综述助手。',
      '只依据给定的“资料片段”作答，区分事实与推断。',
      '回答要求：1) 结构化归纳（按主题/方法/结论）；2) 明确指出不同来源的差异或冲突；3) 指出尚缺的信息。',
      '在引用处使用 [编号] 标注来源。'
    ].join('\n'),
    topK: 10
  },
  {
    id: 'general',
    name: '通用问答',
    description: '基于库内内容回答问题并给出来源',
    system: [
      '你是个人知识库助手，只依据给定资料片段回答，引用处用 [编号] 标注；资料不足时如实说明。'
    ].join('\n'),
    topK: 8
  }
];
function getScenario(id) { return SCENARIOS.find(s => s.id === id) || SCENARIOS[SCENARIOS.length - 1]; }
module.exports = { SCENARIOS, getScenario };