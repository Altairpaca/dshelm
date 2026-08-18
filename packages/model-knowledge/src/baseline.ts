import type { CapabilityKind, KnowledgeBundle } from './contracts.ts'

const observedAt = '2026-08-18T03:00:00+08:00'
const piSource = 'earendil-works/pi-ai@0.82.1'
const piCommit = 'b4f293684bba718d59cc1157679bcf6157b3a7f5'

function claim(
  id: string,
  layer: 'runtime' | 'official' | 'community' | 'empirical',
  source: string,
  subject: string,
  claimType: CapabilityKind,
  value: string | number | boolean | string[],
  confidence: number,
  staleAfterDays: number,
  sourceUrl?: string,
) {
  return {
    id,
    layer,
    source,
    ...(sourceUrl === undefined ? {} : { sourceUrl }),
    ...(source === piSource ? { sourceCommit: piCommit } : {}),
    observedAt,
    subject,
    claimType,
    value,
    confidence,
    staleAfterDays,
  }
}

const deepseekFlash = 'deepseek/deepseek-v4-flash'
const deepseekPro = 'deepseek/deepseek-v4-pro'
const openaiMini = 'openai/gpt-5-mini'
const claudeSonnet = 'anthropic/claude-sonnet-4-5'
const qwenLocal = 'local/qwen3-30b'
const gptOssLocal = 'local/gpt-oss:20b'

export const BASELINE_KNOWLEDGE_BUNDLE = {
  schemaVersion: 1,
  bundleId: 'dshelm-v0.3-baseline-2026-08-18',
  generatedAt: observedAt,
  records: [
    {
      id: deepseekFlash,
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      displayName: 'DeepSeek V4 Flash',
      hard: {
        protocol: 'deepseek-chat',
        reasoningEfforts: ['off', 'high', 'max'],
        streaming: true,
        authMethods: ['api-key'],
      },
      soft: [
        { capability: 'planning', score: 0.76, confidence: 0.58, evidenceIds: ['deepseek-flash-agentic'] },
        { capability: 'agenticCoding', score: 0.78, confidence: 0.58, evidenceIds: ['deepseek-flash-agentic'] },
        { capability: 'fanOutSuitability', score: 0.88, confidence: 0.62, evidenceIds: ['deepseek-flash-cost-latency'] },
      ],
      adaptationHints: [{ id: 'deepseek-flash-parallel', hint: 'Prefer bounded parallel workers and explicit tool result summaries.', evidenceIds: ['deepseek-flash-cost-latency'] }],
      evidence: [
        claim('deepseek-flash-runtime-unverified', 'runtime', 'DSHelm exact-model fixture contract; real provider discovery not performed', deepseekFlash, 'runtimeReady', false, 0.95, 14),
        claim('deepseek-flash-protocol', 'official', 'DeepSeek API documentation', deepseekFlash, 'protocol', 'deepseek-chat', 0.85, 30, 'https://api-docs.deepseek.com/'),
        claim('deepseek-flash-reasoning', 'official', 'DeepSeek API documentation', deepseekFlash, 'reasoningEfforts', ['off', 'high', 'max'], 0.6, 14, 'https://api-docs.deepseek.com/'),
        claim('deepseek-flash-streaming', 'official', 'DeepSeek API documentation', deepseekFlash, 'streaming', true, 0.85, 30, 'https://api-docs.deepseek.com/'),
        claim('deepseek-flash-auth', 'official', 'DeepSeek API documentation', deepseekFlash, 'authMethods', ['api-key'], 0.95, 30, 'https://api-docs.deepseek.com/'),
        claim('deepseek-flash-agentic', 'community', 'DSH and agent harness usage reports; directional only', deepseekFlash, 'agenticCoding', 0.78, 0.58, 60, 'https://github.com/deepseek-ai/deepseek-harness/discussions'),
        claim('deepseek-flash-cost-latency', 'official', 'DeepSeek pricing and API documentation', deepseekFlash, 'fanOutSuitability', 0.88, 0.62, 14, 'https://api-docs.deepseek.com/quick_start/pricing'),
      ],
    },
    {
      id: deepseekPro,
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      displayName: 'DeepSeek V4 Pro',
      hard: {
        protocol: 'deepseek-chat',
        reasoningEfforts: ['off', 'high', 'max'],
        streaming: true,
        authMethods: ['api-key'],
      },
      soft: [
        { capability: 'planning', score: 0.86, confidence: 0.58, evidenceIds: ['deepseek-pro-agentic'] },
        { capability: 'longHorizonCoding', score: 0.82, confidence: 0.52, evidenceIds: ['deepseek-pro-agentic'] },
        { capability: 'review', score: 0.8, confidence: 0.5, evidenceIds: ['deepseek-pro-agentic'] },
      ],
      adaptationHints: [{ id: 'deepseek-pro-reasoning', hint: 'Use high reasoning effort for planning and verification lanes; reserve max for hard debugging.', evidenceIds: ['deepseek-pro-reasoning'] }],
      evidence: [
        claim('deepseek-pro-runtime-unverified', 'runtime', 'DSHelm exact-model fixture contract; real provider discovery not performed', deepseekPro, 'runtimeReady', false, 0.95, 14),
        claim('deepseek-pro-protocol', 'official', 'DeepSeek API documentation', deepseekPro, 'protocol', 'deepseek-chat', 0.85, 30, 'https://api-docs.deepseek.com/'),
        claim('deepseek-pro-reasoning', 'official', 'DeepSeek API documentation', deepseekPro, 'reasoningEfforts', ['off', 'high', 'max'], 0.6, 14, 'https://api-docs.deepseek.com/'),
        claim('deepseek-pro-streaming', 'official', 'DeepSeek API documentation', deepseekPro, 'streaming', true, 0.85, 30, 'https://api-docs.deepseek.com/'),
        claim('deepseek-pro-auth', 'official', 'DeepSeek API documentation', deepseekPro, 'authMethods', ['api-key'], 0.95, 30, 'https://api-docs.deepseek.com/'),
        claim('deepseek-pro-agentic', 'community', 'DSH and agent harness usage reports; directional only', deepseekPro, 'longHorizonCoding', 0.82, 0.52, 60, 'https://github.com/deepseek-ai/deepseek-harness/discussions'),
      ],
    },
    {
      id: openaiMini,
      provider: 'openai',
      model: 'gpt-5-mini',
      displayName: 'GPT-5 mini',
      hard: { protocol: 'openai-responses', streaming: true, authMethods: ['api-key'] },
      soft: [
        { capability: 'fanOutSuitability', score: 0.84, confidence: 0.55, evidenceIds: ['openai-mini-official'] },
        { capability: 'toolReliability', score: 0.8, confidence: 0.5, evidenceIds: ['openai-mini-official'] },
      ],
      adaptationHints: [{ id: 'openai-mini-tools', hint: 'Prefer compact structured tool schemas and bounded output budgets.', evidenceIds: ['openai-mini-official'] }],
      evidence: [
        claim('openai-mini-protocol', 'official', 'OpenAI model documentation', openaiMini, 'protocol', 'openai-responses', 0.9, 30, 'https://platform.openai.com/docs/models'),
        claim('openai-mini-streaming', 'official', 'OpenAI Responses API documentation', openaiMini, 'streaming', true, 0.9, 30, 'https://platform.openai.com/docs/api-reference/responses'),
        claim('openai-mini-auth', 'official', 'OpenAI API documentation', openaiMini, 'authMethods', ['api-key'], 0.95, 30, 'https://platform.openai.com/docs/api-reference/authentication'),
        claim('openai-mini-official', 'official', 'OpenAI model documentation; capability scores are conditional heuristics', openaiMini, 'toolReliability', 0.8, 0.5, 60, 'https://platform.openai.com/docs/models'),
      ],
    },
    {
      id: claudeSonnet,
      provider: 'anthropic',
      model: 'claude-sonnet-4-5',
      displayName: 'Claude Sonnet 4.5',
      hard: { protocol: 'anthropic-messages', streaming: true, authMethods: ['api-key', 'library-oauth'] },
      soft: [
        { capability: 'agenticCoding', score: 0.84, confidence: 0.62, evidenceIds: ['claude-sonnet-community'] },
        { capability: 'planning', score: 0.82, confidence: 0.6, evidenceIds: ['claude-sonnet-community'] },
        { capability: 'review', score: 0.83, confidence: 0.56, evidenceIds: ['claude-sonnet-community'] },
      ],
      adaptationHints: [{ id: 'claude-sonnet-review', hint: 'Use explicit acceptance criteria and independent review prompts for long coding tasks.', evidenceIds: ['claude-sonnet-community'] }],
      evidence: [
        claim('claude-sonnet-protocol', 'official', 'Anthropic Messages API documentation', claudeSonnet, 'protocol', 'anthropic-messages', 0.9, 30, 'https://docs.anthropic.com/en/api/messages'),
        claim('claude-sonnet-streaming', 'official', 'Anthropic Messages API documentation', claudeSonnet, 'streaming', true, 0.9, 30, 'https://docs.anthropic.com/en/api/messages-streaming'),
        claim('claude-sonnet-auth', 'official', 'Anthropic API documentation plus pi-ai provider implementation', claudeSonnet, 'authMethods', ['api-key', 'library-oauth'], 0.62, 30, 'https://docs.anthropic.com/en/api/getting-started'),
        claim('claude-sonnet-community', 'community', 'Claude Code and agent harness issue reports; harness-dependent', claudeSonnet, 'agenticCoding', 0.84, 0.62, 60, 'https://github.com/anthropics/claude-code/issues'),
      ],
    },
    {
      id: qwenLocal,
      provider: 'local',
      model: 'qwen3-30b',
      displayName: 'Qwen3 30B (local example)',
      hard: { protocol: 'openai-completions', localDeployment: true, openWeights: true, authMethods: ['local'] },
      soft: [{ capability: 'fanOutSuitability', score: 0.76, confidence: 0.48, evidenceIds: ['qwen-local-card'] }],
      adaptationHints: [{ id: 'qwen-local-concurrency', hint: 'Keep concurrency bounded by local VRAM and inference backend throughput.', evidenceIds: ['qwen-local-card'] }],
      evidence: [
        claim('qwen-local-protocol', 'official', 'Qwen model card; protocol depends on serving backend', qwenLocal, 'protocol', 'openai-completions', 0.55, 90, 'https://huggingface.co/Qwen'),
        claim('qwen-local-deployment', 'official', 'Qwen model card', qwenLocal, 'localDeployment', true, 0.9, 90, 'https://huggingface.co/Qwen'),
        claim('qwen-local-weights', 'official', 'Qwen model card', qwenLocal, 'openWeights', true, 0.9, 90, 'https://huggingface.co/Qwen'),
        claim('qwen-local-auth', 'community', 'Local inference backend configuration', qwenLocal, 'authMethods', ['local'], 0.8, 90, 'https://github.com/QwenLM/Qwen3'),
        claim('qwen-local-card', 'community', 'Local Qwen coding-agent reports; hardware-dependent', qwenLocal, 'fanOutSuitability', 0.76, 0.48, 60, 'https://github.com/QwenLM/Qwen3'),
      ],
    },
    {
      id: gptOssLocal,
      provider: 'local',
      model: 'gpt-oss:20b',
      displayName: 'gpt-oss 20B (local example)',
      hard: { protocol: 'openai-completions', localDeployment: true, openWeights: true, authMethods: ['local'] },
      soft: [{ capability: 'fanOutSuitability', score: 0.74, confidence: 0.45, evidenceIds: ['gpt-oss-card'] }],
      adaptationHints: [{ id: 'gpt-oss-local-budget', hint: 'Use small parallel batches and verify tool outputs independently on local serving.', evidenceIds: ['gpt-oss-card'] }],
      evidence: [
        claim('gpt-oss-local-protocol', 'community', 'OpenAI-compatible local serving configuration', gptOssLocal, 'protocol', 'openai-completions', 0.55, 90, 'https://github.com/openai/gpt-oss'),
        claim('gpt-oss-local-deployment', 'official', 'gpt-oss model repository', gptOssLocal, 'localDeployment', true, 0.9, 90, 'https://github.com/openai/gpt-oss'),
        claim('gpt-oss-local-weights', 'official', 'gpt-oss model repository', gptOssLocal, 'openWeights', true, 0.9, 90, 'https://github.com/openai/gpt-oss'),
        claim('gpt-oss-local-auth', 'community', 'Local inference backend configuration', gptOssLocal, 'authMethods', ['local'], 0.8, 90, 'https://github.com/openai/gpt-oss'),
        claim('gpt-oss-card', 'community', 'Open-weight coding-agent reports; hardware-dependent', gptOssLocal, 'fanOutSuitability', 0.74, 0.45, 60, 'https://github.com/openai/gpt-oss'),
      ],
    },
  ],
} satisfies KnowledgeBundle
