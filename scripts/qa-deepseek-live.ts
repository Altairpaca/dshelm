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

const result = deepSeekLiveGate(new Date(), process.env.DEEPSEEK_API_KEY, process.env.DSHELM_LIVE_DEEPSEEK_CONFIRM)
console.log(result.detail)
