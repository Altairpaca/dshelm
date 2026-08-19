import { request } from 'node:https'

type GateResult =
  | { readonly allowed: false; readonly detail: string }
  | { readonly allowed: true; readonly detail: string }

export function deepSeekLiveGate(now: Date, apiKey: string | undefined, confirmation: string | undefined): GateResult {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const hourPart = parts.find((part) => part.type === 'hour')?.value
  const hour = hourPart === undefined ? -1 : Number(hourPart)
  if (!Number.isInteger(hour) || hour < 2 || hour >= 8) return { allowed: false, detail: 'SKIPPED: outside DSHelm live-test window' }
  if (apiKey === undefined || apiKey.trim().length === 0) return { allowed: false, detail: 'SKIPPED: DEEPSEEK_API_KEY not configured' }
  if (confirmation !== '1') return { allowed: false, detail: 'SKIPPED: set DSHELM_LIVE_DEEPSEEK_CONFIRM=1 for an explicit live run' }
  return { allowed: true, detail: 'ALLOWED: DeepSeek live-test gate passed; caller owns request limits' }
}

type LiveResponse = { readonly model: string; readonly usage?: { readonly total_tokens?: number } }

async function requestModel(apiKey: string, model: string): Promise<LiveResponse> {
  const body = JSON.stringify({ model, messages: [{ role: 'user', content: 'Reply with OK.' }], max_tokens: 16, stream: false })
  return new Promise((resolve, reject) => {
    const clientRequest = request({
      hostname: 'api.deepseek.com',
      path: '/chat/completions',
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 30_000,
    }, (response) => {
      const chunks: Buffer[] = []
      response.on('data', (chunk: Buffer) => chunks.push(chunk))
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        if (response.statusCode !== 200) {
          reject(new Error(`DeepSeek ${model} request failed with HTTP ${response.statusCode ?? 0}`))
          return
        }
        try {
          const parsed: unknown = JSON.parse(text)
          if (!isLiveResponse(parsed, model)) {
            reject(new Error(`DeepSeek ${model} response did not contain the requested model`))
            return
          }
          resolve(parsed)
        } catch (error) {
          reject(error instanceof Error ? error : new Error('DeepSeek response was not valid JSON'))
        }
      })
      response.on('error', reject)
    })
    clientRequest.on('timeout', () => clientRequest.destroy(new Error('DeepSeek request timed out')))
    clientRequest.on('error', reject)
    clientRequest.write(body)
    clientRequest.end()
  })
}

function isLiveResponse(value: unknown, model: string): value is LiveResponse {
  if (typeof value !== 'object' || value === null || !('model' in value) || typeof value.model !== 'string' || value.model !== model) return false
  if (!('usage' in value) || value.usage === undefined) return true
  if (typeof value.usage !== 'object' || value.usage === null || !('total_tokens' in value.usage)) return false
  return value.usage.total_tokens === undefined || typeof value.usage.total_tokens === 'number'
}

async function runLiveAcceptance(apiKey: string): Promise<void> {
  const models = ['deepseek-v4-flash', 'deepseek-v4-pro'] as const
  const responses: LiveResponse[] = []
  for (const model of models) responses.push(await requestModel(apiKey, model))
  const totalTokens = responses.reduce((sum, response) => sum + (response.usage?.total_tokens ?? 0), 0)
  if (totalTokens > 128) throw new Error(`DeepSeek live acceptance exceeded token budget (${totalTokens} > 128)`)
  console.log(`VERIFIED: DeepSeek heterogeneous route contract (${models.join(' + ')}), total_tokens=${totalTokens}`)
}

const apiKey = process.env.DEEPSEEK_API_KEY
const result = deepSeekLiveGate(new Date(), apiKey, process.env.DSHELM_LIVE_DEEPSEEK_CONFIRM)
console.log(result.detail)
if (result.allowed) {
  if (apiKey === undefined) throw new Error('DeepSeek gate allowed without an API key')
  await runLiveAcceptance(apiKey)
}
