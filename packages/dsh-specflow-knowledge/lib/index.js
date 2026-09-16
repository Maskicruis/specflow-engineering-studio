import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'tool-specflow-knowledge'
export const inject = ['tools', 'systemPrompt']

export const Config = z.object({
  baseUrl: z.string().default('http://127.0.0.1:8790'),
  timeoutMs: z.number().default(120000)
})

const DISCOVERY_FILE = path.join(os.homedir(), '.dsh', 'integrations', 'specflow.json')

function normalizeBaseUrl(value) {
  const parsed = new URL(String(value || '').trim())
  if (parsed.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(parsed.hostname)) {
    throw new Error('SpecFlow connector accepts loopback HTTP addresses only')
  }
  parsed.pathname = ''
  parsed.search = ''
  parsed.hash = ''
  return parsed.toString().replace(/\/$/, '')
}

export function resolveBaseUrl(config = {}) {
  if (process.env.SPECFLOW_KB_URL) return normalizeBaseUrl(process.env.SPECFLOW_KB_URL)
  try {
    const record = JSON.parse(fs.readFileSync(DISCOVERY_FILE, 'utf8'))
    if (record?.baseUrl) return normalizeBaseUrl(record.baseUrl)
  } catch {}
  return normalizeBaseUrl(config.baseUrl || 'http://127.0.0.1:8790')
}

function withAbsoluteSources(value, baseUrl) {
  if (!value || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(item => withAbsoluteSources(item, baseUrl))
  const copy = { ...value }
  if (typeof copy.sourceUrl === 'string' && copy.sourceUrl.startsWith('/')) copy.sourceUrl = baseUrl + copy.sourceUrl
  for (const [key, item] of Object.entries(copy)) {
    if (key !== 'sourceUrl' && item && typeof item === 'object') copy[key] = withAbsoluteSources(item, baseUrl)
  }
  return copy
}

async function requestJson(config, resource, options = {}, signal) {
  const baseUrl = resolveBaseUrl(config)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), Math.max(1000, Number(config.timeoutMs) || 120000))
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })
  try {
    const response = await fetch(baseUrl + resource, {
      ...options,
      signal: controller.signal,
      headers: { accept: 'application/json', ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.headers || {}) }
    })
    const envelope = await response.json().catch(() => ({}))
    if (!response.ok || envelope.ok === false) throw new Error(envelope?.error?.message || `SpecFlow returned HTTP ${response.status}`)
    return { baseUrl, data: withAbsoluteSources(envelope.data ?? envelope, baseUrl) }
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('SpecFlow request timed out or was cancelled')
    throw new Error(`SpecFlow is unavailable. Open SpecFlow Engineering Studio and retry. ${error.message || error}`)
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', onAbort)
  }
}

const TEXT_OUTPUT = {
  schema: { type: 'object', additionalProperties: true },
  render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }]
}

function register(ctx, options) {
  ctx.tools.register(defineTool({ ...options, output: TEXT_OUTPUT, isConcurrencySafe: () => true }))
}

export function apply(ctx, config) {
  ctx.systemPrompt.section({
    name: 'tool:specflow-knowledge',
    order: 111,
    text: 'Use specflow_search for questions about the user\'s imported engineering standards, specifications, drawings, clauses, tables, and design parameters. Call specflow_list_groups when the user names a project or discipline. Preserve each returned document title, page, clause reference, sourceUrl, and locate data; never invent citations. Prefer specflow_search and synthesize the answer yourself. Use specflow_ask only when the user explicitly wants the standalone SpecFlow model to answer.'
  })

  register(ctx, {
    name: 'specflow_status',
    description: 'Check whether SpecFlow Engineering Studio is running and whether its standalone LLM is configured.',
    parameters: {},
    async execute(_args, exec) {
      const health = await requestJson(config, '/api/v1/health', {}, exec.signal)
      const llm = await requestJson(config, '/api/v1/llm', {}, exec.signal)
      return { baseUrl: health.baseUrl, health: health.data, llm: llm.data }
    },
    presentCall: () => ({ card: 'generic', title: 'Check SpecFlow connection', kind: 'read' })
  })

  register(ctx, {
    name: 'specflow_list_groups',
    description: 'List SpecFlow document groups and their document counts before narrowing an engineering-document search.',
    parameters: {},
    async execute(_args, exec) {
      const result = await requestJson(config, '/api/v1/groups', {}, exec.signal)
      return { baseUrl: result.baseUrl, ...result.data }
    },
    presentCall: () => ({ card: 'generic', title: 'List SpecFlow document groups', kind: 'read' })
  })

  register(ctx, {
    name: 'specflow_search',
    description: 'Search the local SpecFlow engineering document database. Returns grounded excerpts with PDF page, clause, coordinates, and clickable source URLs.',
    parameters: {
      query: { type: 'string', required: true, description: 'Engineering question, clause, parameter, or keyword to search for.' },
      top_k: { type: 'number', description: 'Number of results, 1-20. Defaults to 8.' },
      group_id: { type: 'string', description: 'Optional exact group id returned by specflow_list_groups.' },
      document_id: { type: 'string', description: 'Optional exact document id.' }
    },
    async execute(args, exec) {
      const query = String(args.query || '').trim()
      if (!query) throw new Error('query must not be empty')
      const topK = Math.max(1, Math.min(20, Number(args.top_k) || 8))
      const search = new URLSearchParams({ q: query, topK: String(topK) })
      if (args.group_id !== undefined) search.set('group', String(args.group_id))
      if (args.document_id) search.set('doc', String(args.document_id))
      const result = await requestJson(config, `/api/v1/search?${search}`, {}, exec.signal)
      return { baseUrl: result.baseUrl, ...result.data }
    },
    presentCall: args => ({ card: 'generic', title: `Search SpecFlow: ${args.query}`, kind: 'read' })
  })

  register(ctx, {
    name: 'specflow_ask',
    description: 'Ask the standalone SpecFlow LLM for a knowledge-grounded answer. Use only when the user explicitly wants SpecFlow to generate the answer rather than Harness.',
    parameters: {
      question: { type: 'string', required: true, description: 'Question for the standalone SpecFlow model.' },
      group_id: { type: 'string', description: 'Optional exact group id.' },
      document_id: { type: 'string', description: 'Optional exact document id.' },
      conversation_id: { type: 'string', description: 'Optional SpecFlow conversation id for follow-up questions.' },
      top_k: { type: 'number', description: 'Number of retrieved passages, 1-20. Defaults to 8.' }
    },
    async execute(args, exec) {
      const question = String(args.question || '').trim()
      if (!question) throw new Error('question must not be empty')
      const payload = { question, retrievalMode: 'knowledge', topK: Math.max(1, Math.min(20, Number(args.top_k) || 8)) }
      if (args.group_id !== undefined) payload.groupId = String(args.group_id)
      if (args.document_id) payload.docIds = [String(args.document_id)]
      if (args.conversation_id) payload.conversationId = String(args.conversation_id)
      const result = await requestJson(config, '/api/v1/ask', { method: 'POST', body: JSON.stringify(payload) }, exec.signal)
      return { baseUrl: result.baseUrl, ...result.data }
    },
    presentCall: args => ({ card: 'generic', title: `Ask SpecFlow: ${args.question}`, kind: 'read' })
  })
}
