export interface ControlPlaneTraceEntry {
  readonly field: string
  readonly source: string
  readonly value: string
}

export interface ControlPlaneRole {
  readonly role: string
  readonly provider: string
  readonly model: string
  readonly reasoning?: string
}

export interface ControlPlaneSnapshot {
  readonly roles: readonly ControlPlaneRole[]
  readonly inspector: {
    readonly request: string
    readonly category: string
    readonly role: string
    readonly provider: string
    readonly model: string
    readonly reasoning?: string
    readonly trace: readonly ControlPlaneTraceEntry[]
  }
}

export interface DSHelmPolicyClientService {
  readonly snapshot: () => ControlPlaneSnapshot
  readonly subscribe?: (listener: () => void) => () => void
}

export interface DSHelmClientContext {
  readonly dshelmPolicy: DSHelmPolicyClientService
  readonly effect?: (cleanup: () => void, label?: string) => void
}

export const inject = ['dshelmPolicy'] as const

function isChineseDocument(): boolean {
  return (document.documentElement.lang || navigator.language).toLowerCase().startsWith('zh')
}

const styleText = `
  [data-dshelm-control-plane] {
    --dh-bg: #0b1020;
    --dh-panel: #121a2b;
    --dh-panel-2: #172239;
    --dh-line: #2b3a57;
    --dh-text: #eff4ff;
    --dh-muted: #9aa9c4;
    --dh-accent: #7dd3fc;
    color: var(--dh-text);
    background: radial-gradient(circle at 80% 0%, #17365c 0, transparent 42%), var(--dh-bg);
    border: 1px solid var(--dh-line);
    border-radius: 16px;
    font: 14px/1.45 ui-sans-serif, system-ui, sans-serif;
    margin: 24px auto;
    max-width: 1080px;
    padding: 24px;
  }
  [data-dshelm-control-plane] h1,
  [data-dshelm-control-plane] h2,
  [data-dshelm-control-plane] p { margin: 0; }
  [data-dshelm-control-plane] header { margin-bottom: 20px; }
  [data-dshelm-control-plane] header p { color: var(--dh-muted); margin-top: 5px; }
  [data-dshelm-control-plane] table { border-collapse: collapse; width: 100%; }
  [data-dshelm-control-plane] th {
    color: var(--dh-muted);
    font-size: 11px;
    letter-spacing: .08em;
    padding: 9px 10px;
    text-align: left;
    text-transform: uppercase;
  }
  [data-dshelm-control-plane] td {
    border-top: 1px solid var(--dh-line);
    padding: 12px 10px;
  }
  [data-dshelm-control-plane] code {
    background: var(--dh-panel-2);
    border-radius: 5px;
    color: var(--dh-accent);
    padding: 3px 6px;
  }
  [data-dshelm-control-plane] details {
    background: color-mix(in srgb, var(--dh-panel) 92%, white);
    border: 1px solid var(--dh-line);
    border-radius: 10px;
    margin-top: 20px;
    padding: 15px;
  }
  [data-dshelm-control-plane] summary { cursor: pointer; font-weight: 650; }
  [data-dshelm-control-plane] ol { color: var(--dh-muted); margin-bottom: 0; }
  [data-dshelm-control-plane] li { padding: 4px 0; }
  [data-dshelm-control-plane] li strong { color: var(--dh-text); }
  @media (max-width: 640px) {
    [data-dshelm-control-plane] { border-radius: 0; margin: 0; padding: 16px; }
    [data-dshelm-control-plane] table { font-size: 12px; }
    [data-dshelm-control-plane] th, [data-dshelm-control-plane] td { padding: 8px 5px; }
  }
`

export function renderControlPlane(
  root: HTMLElement,
  snapshot: ControlPlaneSnapshot,
): void {
  root.replaceChildren()
  root.dataset.dshelmControlPlane = ''
  const style = document.createElement('style')
  style.textContent = styleText
  root.append(style)

  const header = document.createElement('header')
  const zh = isChineseDocument()
  const title = document.createElement('h1')
  title.textContent = zh ? 'DSHelm 调度面板' : 'DSHelm Control Plane'
  const subtitle = document.createElement('p')
  subtitle.textContent = zh ? '可解释的运行时模型调度与来源追踪' : 'Runtime-aware policy resolution and provenance'
  header.append(title, subtitle)

  const heading = document.createElement('h2')
  heading.textContent = zh ? '角色 × 模型' : 'Roles × Models'
  const table = document.createElement('table')
  table.dataset.dshelmMatrix = ''
  table.innerHTML = zh
    ? '<thead><tr><th>角色</th><th>服务商</th><th>模型</th><th>推理等级</th></tr></thead>'
    : '<thead><tr><th>Role</th><th>Provider</th><th>Model</th><th>Reasoning</th></tr></thead>'
  const body = document.createElement('tbody')
  for (const role of snapshot.roles) {
    const row = document.createElement('tr')
    row.dataset.role = role.role
    row.dataset.provider = role.provider
    row.dataset.model = role.model
    const localizedRole = zh ? ({ planner: '规划', worker: '执行', reviewer: '审核' } as Record<string, string>)[role.role] : undefined
    appendCell(row, localizedRole === undefined ? role.role : `${localizedRole} · ${role.role}`)
    appendCell(row, role.provider)
    appendCell(row, role.model, true)
    appendCell(row, role.reasoning ?? 'default')
    body.append(row)
  }
  table.append(body)

  const inspector = document.createElement('details')
  inspector.dataset.dshelmInspector = ''
  inspector.open = true
  const summary = document.createElement('summary')
  summary.textContent = `${zh ? '决策解释' : 'Resolution Inspector'} · ${snapshot.inspector.request}`
  const details = document.createElement('ol')
  for (const entry of snapshot.inspector.trace) {
    const item = document.createElement('li')
    item.dataset.field = entry.field
    const field = document.createElement('strong')
    field.textContent = entry.field
    const value = document.createElement('code')
    value.textContent = entry.value
    const source = document.createElement('span')
    source.textContent = ` (${entry.source})`
    item.append(field, ' = ', value, source)
    details.append(item)
  }
  inspector.append(summary, details)
  root.append(header, heading, table, inspector)
}

export function apply(ctx: DSHelmClientContext): () => void {
  const host = document.createElement('section')
  document.body.append(host)
  const render = (): void => renderControlPlane(host, ctx.dshelmPolicy.snapshot())
  render()
  const unsubscribe = ctx.dshelmPolicy.subscribe?.(render)
  const cleanup = (): void => {
    unsubscribe?.()
    host.remove()
  }
  ctx.effect?.(cleanup, 'dshelm: control plane')
  return cleanup
}

function appendCell(row: HTMLTableRowElement, value: string, code = false): void {
  const cell = document.createElement('td')
  if (code) {
    const content = document.createElement('code')
    content.textContent = value
    cell.append(content)
  } else {
    cell.textContent = value
  }
  row.append(cell)
}
