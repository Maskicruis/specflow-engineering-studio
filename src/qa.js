'use strict';
/** 问答编排：可选 RAG 检索 -> 多轮上下文 -> LLM -> 可定位结构化引用。 */
const { getScenario } = require('./scenarios');
const { chat, chatStream, isConfigured } = require('./llm');
const { searchDetailed } = require('./rag');
const { decorateCitation } = require('./citation-links');
const { planQuery } = require('./query-planner');

const RETRIEVAL_MODES = new Set(['auto', 'knowledge', 'general']);

function normalizeRetrievalMode(value) {
  const mode = String(value || 'auto').toLowerCase();
  return RETRIEVAL_MODES.has(mode) ? mode : 'auto';
}

function normalizeHistory(history, maxMessages = 12, maxChars = 12000) {
  const output = [];
  let used = 0;
  const rows = Array.isArray(history) ? history.slice(-maxMessages) : [];
  for (const row of rows) {
    const role = row && (row.role === 'assistant' || row.role === 'user') ? row.role : '';
    const content = String(row && row.content || '').trim().slice(0, 3000);
    if (!role || !content || used + content.length > maxChars) continue;
    used += content.length;
    output.push({ role, content });
  }
  return output;
}

function buildContexts(hits, maxChars = 8000) {
  const lines = []; let used = 0; const citations = [];
  hits.forEach((hit, i) => {
    const n = i + 1;
    let text = String(hit.snippet || '');
    if (text.length > 900) text = text.slice(0, 900) + '…';
    const head = '[片段 ' + n + '] 文档《' + hit.title + '》第 ' + hit.page + ' 页' + (hit.ref ? ' 条文 ' + hit.ref : '') + (hit.type === 'table' ? '（表格）' : '');
    const block = head + '\n' + text;
    if (used + block.length > maxChars) return;
    used += block.length; lines.push(block);
    const bbox = hit.bbox || null;
    const bboxNormalized = hit.bboxNormalized || null;
    citations.push(decorateCitation({
      n, docId: hit.docId, title: hit.title, page: hit.page, itemId: hit.itemId,
      ref: hit.ref || '', type: hit.type, bbox, bboxNormalized,
      snippet: hit.snippet || '', score: hit.score, matched: hit.matched || ['bm25']
    }));
  });
  return { contextText: lines.join('\n\n'), citations };
}

function buildMessages(scenario, contextText, question, options = {}) {
  const retrievalMode = normalizeRetrievalMode(options.retrievalMode);
  const groundingRules = retrievalMode === 'knowledge'
    ? [
        '当前为“仅资料库”模式。只允许依据给定资料片段回答；资料不足时明确说明，不得用常识补齐。',
        '每个来自资料的事实、数值或结论后必须立刻标注对应引用。请严格使用 [1]、[2] 这种格式，不要输出“[片段1]”或只把引用集中到段尾。',
        '只可使用实际提供的片段编号，不得编造编号。'
      ]
    : [
        '当前为“智能问答”模式。优先使用相关资料片段；资料不相关或不足时，可以使用通用知识回答，并明确区分资料依据与通用说明。',
        '凡是来自资料的事实、数值或结论，必须在该句后立刻标注对应引用。请严格使用 [1]、[2] 这种格式，不要输出“[片段1]”；通用知识不要添加虚假引用。',
        '只可使用实际提供的片段编号，不得编造编号。'
      ];
  if (retrievalMode === 'general') {
    groundingRules.splice(0, groundingRules.length,
      '当前为“通用对话”模式。像通用大语言模型一样回答，不受资料库限制。',
      '本轮没有资料引用，不要生成 [编号] 形式的虚假引用。');
  }
  const messages = [{ role: 'system', content: [scenario.system, ...groundingRules].join('\n') }];
  messages.push(...normalizeHistory(options.history));
  const prompt = contextText
    ? '可用资料片段：\n' + contextText + '\n\n当前问题：' + question
    : '当前问题：' + question;
  messages.push({ role: 'user', content: prompt });
  return messages;
}

async function retrieve(question, payload, deps) {
  const scenario = getScenario(payload.scenarioId || payload.scenario);
  const retrievalMode = normalizeRetrievalMode(payload.retrievalMode);
  const history = normalizeHistory(payload.history);
  const planningContext = history.filter(item => item.role === 'user').slice(-1).map(item => item.content).concat(question).join('\n');
  const queryPlan = planQuery(planningContext, { currentQuery: question });
  if (retrievalMode === 'general') {
    return { hits: [], retrieval: { mode: 'disabled', embeddingModel: '', vectors: 0, fused: false }, scenario, retrievalMode, queryPlan };
  }
  if (queryPlan.needsClarification) {
    return { hits: [], retrieval: { mode: 'clarification', embeddingModel: '', vectors: 0, fused: false }, scenario, retrievalMode, queryPlan };
  }
  const topK = payload.topK || scenario.topK;
  const docIds = Array.isArray(payload.docIds) ? payload.docIds : null;
  const detailed = await searchDetailed(deps.rag, queryPlan.retrievalQuery || question, { topK, docIds }, deps);
  return { hits: detailed.hits, retrieval: detailed.retrieval, scenario, retrievalMode, queryPlan };
}

async function ask(payload, deps) {
  const question = String(payload.question || '').trim();
  const { hits, retrieval, scenario, retrievalMode, queryPlan } = await retrieve(question, payload, deps);
  const { contextText, citations } = buildContexts(hits);
  const base = { scenario: scenario.id, retrieval, retrievalMode, queryPlan };
  if (queryPlan.needsClarification) {
    return Object.assign({ ok: true, mode: 'clarification', grounding: 'none', answer: queryPlan.clarification.prompt, citations: [], needsClarification: true, clarification: queryPlan.clarification }, base);
  }
  const configured = isConfigured(deps.settings.llm);
  if (!configured) {
    if (hits.length) return Object.assign({ ok: true, mode: 'retrieval', grounding: 'knowledge', answer: '', citations, note: '尚未配置 LLM：以下为检索到的原文片段。配置模型后可生成完整回答。' }, base);
    if (retrievalMode === 'general') return Object.assign({ ok: true, mode: 'unavailable', grounding: 'general', answer: '', citations: [], note: '通用对话需要先在设置中配置 LLM。' }, base);
    return Object.assign({ ok: true, mode: 'empty', grounding: 'knowledge', answer: '资料库中未检索到相关内容。可切换“通用对话”，或配置 LLM 后使用“智能问答”。', citations: [] }, base);
  }
  if (retrievalMode === 'knowledge' && !hits.length) {
    return Object.assign({ ok: true, mode: 'empty', grounding: 'knowledge', answer: '资料库中未检索到足以回答此问题的内容。', citations: [] }, base);
  }
  const grounding = hits.length && retrievalMode !== 'general' ? 'knowledge' : 'general';
  const result = await chat(deps.settings.llm, buildMessages(scenario, contextText, question, { retrievalMode, history: payload.history }));
  if (!result.ok) return Object.assign({ ok: false, mode: 'llm-error', grounding, error: result.error, citations }, base);
  return Object.assign({ ok: true, mode: 'llm', grounding, answer: result.content, citations: grounding === 'general' ? [] : citations, usage: result.usage || null }, base);
}

/** 流式问答：emit({type:'citations'|'delta'|'done'|'error', ...}) */
async function askStream(payload, deps, emit) {
  try {
    const question = String(payload.question || '').trim();
    if (!question) { emit({ type: 'error', error: '问题不能为空' }); return; }
    const { hits, retrieval, scenario, retrievalMode, queryPlan } = await retrieve(question, payload, deps);
    const { contextText, citations } = buildContexts(hits);
    const configured = isConfigured(deps.settings.llm);
    const grounding = hits.length && retrievalMode !== 'general' ? 'knowledge' : 'general';
    emit({ type: 'citations', citations: grounding === 'general' ? [] : citations, retrieval, retrievalMode, grounding, scenario: scenario.id, queryPlan });
    if (queryPlan.needsClarification) {
      emit({ type: 'done', mode: 'clarification', grounding: 'none', answer: queryPlan.clarification.prompt, citations: [], needsClarification: true, clarification: queryPlan.clarification, queryPlan });
      return;
    }
    if (!configured) {
      if (hits.length) emit({ type: 'done', mode: 'retrieval', grounding: 'knowledge', answer: '', citations, note: '尚未配置 LLM：以下为检索到的相关原文片段。' });
      else emit({ type: 'done', mode: retrievalMode === 'general' ? 'unavailable' : 'empty', grounding, answer: '', citations: [], note: retrievalMode === 'general' ? '通用对话需要先配置 LLM。' : '资料库中未检索到相关内容。' });
      return;
    }
    if (retrievalMode === 'knowledge' && !hits.length) {
      emit({ type: 'done', mode: 'empty', grounding: 'knowledge', answer: '资料库中未检索到足以回答此问题的内容。', citations: [] });
      return;
    }
    const result = await chatStream(deps.settings.llm, buildMessages(scenario, contextText, question, { retrievalMode, history: payload.history }), delta => emit({ type: 'delta', text: delta }));
    if (!result.ok) { emit({ type: 'error', error: result.error, citations: grounding === 'general' ? [] : citations }); return; }
    emit({ type: 'done', mode: 'llm', grounding, answer: result.content, citations: grounding === 'general' ? [] : citations, retrieval, retrievalMode, scenario: scenario.id, queryPlan });
  } catch (error) {
    emit({ type: 'error', error: String(error && error.message || error) });
  }
}

module.exports = { ask, askStream, buildContexts, buildMessages, normalizeHistory, normalizeRetrievalMode, retrieve };
