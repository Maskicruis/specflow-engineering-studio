'use strict';
/** 问答编排：检索（BM25 或 BM25+向量混合）→ 编号上下文 → LLM（可流式）→ 结构化引用 */
const { getScenario } = require('./scenarios');
const { chat, chatStream, isConfigured } = require('./llm');
const { searchDetailed } = require('./rag');

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
    citations.push({ n, docId: hit.docId, title: hit.title, page: hit.page, itemId: hit.itemId, ref: hit.ref || '', type: hit.type, bbox: hit.bbox || null, snippet: hit.snippet || '', score: hit.score, matched: hit.matched || ['bm25'] });
  });
  return { contextText: lines.join('\n\n'), citations };
}

function buildMessages(scenario, contextText, question) {
  return [
    { role: 'system', content: scenario.system },
    { role: 'user', content: '资料片段：\n' + contextText + '\n\n问题：' + question + '\n\n请基于以上片段作答，并在引用处标注 [编号]。' }
  ];
}

async function retrieve(question, payload, deps) {
  const scenario = getScenario(payload.scenarioId || payload.scenario);
  const topK = payload.topK || scenario.topK;
  const docIds = Array.isArray(payload.docIds) ? payload.docIds : null;
  const detailed = await searchDetailed(deps.rag, question, { topK, docIds }, deps);
  return { hits: detailed.hits, retrieval: detailed.retrieval, scenario };
}

async function ask(payload, deps) {
  const question = String(payload.question || '').trim();
  const { hits, retrieval, scenario } = await retrieve(question, payload, deps);
  const { contextText, citations } = buildContexts(hits);
  const base = { scenario: scenario.id, retrieval };
  if (!hits.length) return Object.assign({ ok: true, mode: 'empty', answer: '知识库中未检索到相关内容（可换个说法，或先导入相关 PDF）。', citations: [] }, base);
  if (!isConfigured(deps.settings.llm)) {
    return Object.assign({ ok: true, mode: 'retrieval', answer: '', citations, note: '尚未配置 LLM：以下为检索到的相关原文片段（可点击引用跳转原文核查）。配置 LLM 后即可生成综述式回答。' }, base);
  }
  const result = await chat(deps.settings.llm, buildMessages(scenario, contextText, question));
  if (!result.ok) return Object.assign({ ok: false, mode: 'llm-error', error: result.error, citations }, base);
  return Object.assign({ ok: true, mode: 'llm', answer: result.content, citations, usage: result.usage || null }, base);
}

/** 流式问答：emit({type:'citations'|'delta'|'done'|'error', ...}) */
async function askStream(payload, deps, emit) {
  try {
    const question = String(payload.question || '').trim();
    if (!question) { emit({ type: 'error', error: '问题不能为空' }); return; }
    const { hits, retrieval, scenario } = await retrieve(question, payload, deps);
    const { contextText, citations } = buildContexts(hits);
    emit({ type: 'citations', citations, retrieval, scenario: scenario.id });
    if (!hits.length) { emit({ type: 'done', mode: 'empty', answer: '知识库中未检索到相关内容。', citations: [] }); return; }
    if (!isConfigured(deps.settings.llm)) {
      emit({ type: 'done', mode: 'retrieval', answer: '', citations, note: '尚未配置 LLM：以下为检索到的相关原文片段（可点击引用跳转原文核查）。' });
      return;
    }
    const result = await chatStream(deps.settings.llm, buildMessages(scenario, contextText, question), delta => emit({ type: 'delta', text: delta }));
    if (!result.ok) { emit({ type: 'error', error: result.error, citations }); return; }
    emit({ type: 'done', mode: 'llm', answer: result.content, citations, retrieval, scenario: scenario.id });
  } catch (error) {
    emit({ type: 'error', error: String(error && error.message || error) });
  }
}

module.exports = { ask, askStream, buildContexts, buildMessages, retrieve };