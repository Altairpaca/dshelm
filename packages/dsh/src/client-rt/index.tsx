/**
 * DSHelm control-plane panel — DSH Web client plugin.
 *
 * Consumes the canonical host projection (dshelm.controlPlane) through the
 * session projection face. On current DSH hosts it registers a root-level
 * `main` panel plus the matching `sidebar.panellist` entry. Older verified
 * hosts retain the body overlay as a compatibility fallback until the package
 * graph itself is promoted.
 *
 * The client source intentionally depends only on Cordis plus a narrow local
 * structural face for sessions/slots. The removed 0.1.5
 * `@deepseek-ai/dsh-client-runtime/client` package is not a source dependency.
 */
import type { Context } from '@deepseek-ai/cordis'
import { useEffect, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import type { ControlPlaneProjectionValue } from '../session-events.ts'

/** Required baseline service. Native slot registration is feature-detected. */
export const inject = ['sessions'] as const

const PANEL_ID = 'dshelm-control-plane'

type ProjectionFace = {
  getSnapshot(): unknown
  subscribe(fn: () => void): () => void
}

type SessionsFace = {
  readonly list: {
    getSnapshot(): { readonly current?: unknown }
    subscribe(fn: () => void): () => void
  }
  binding(id: unknown): {
    readonly session: {
      readonly projections: {
        faceOf(key: string): ProjectionFace | undefined
      }
    }
  } | undefined
}

type SlotRegistryFace = {
  inject(name: string, register: () => unknown): unknown
  register(options: Readonly<Record<string, unknown>>, component: (props?: unknown) => ReactNode): unknown
}

type ClientContext = Context & {
  readonly sessions: SessionsFace
  readonly slots?: SlotRegistryFace
}

function useControlPlane(sessions: SessionsFace): ControlPlaneProjectionValue | undefined {
  const [value, setValue] = useState<ControlPlaneProjectionValue | undefined>(undefined)
  useEffect(() => {
    let unsubscribeProjection: (() => void) | undefined
    const rebind = (): void => {
      unsubscribeProjection?.()
      unsubscribeProjection = undefined
      const current = sessions.list.getSnapshot().current
      const binding = current === undefined ? undefined : sessions.binding(current)
      const next = binding?.session.projections.faceOf('dshelm.controlPlane')
      if (next !== undefined) {
        const sync = (): void => setValue(next.getSnapshot() as ControlPlaneProjectionValue | undefined)
        sync()
        unsubscribeProjection = next.subscribe(sync)
      } else {
        setValue(undefined)
      }
    }
    rebind()
    const unsubscribeList = sessions.list.subscribe(rebind)
    return () => {
      unsubscribeProjection?.()
      unsubscribeList()
    }
  }, [sessions])
  return value
}

const basePanelStyle: Record<string, string> = {
  overflow: 'auto',
  background: '#0f172a',
  color: '#e2e8f0',
  padding: '14px 16px',
  font: '12px/1.5 ui-sans-serif, system-ui, sans-serif',
  boxSizing: 'border-box',
}

const overlayPanelStyle: Record<string, string> = {
  ...basePanelStyle,
  position: 'fixed',
  right: '16px',
  bottom: '16px',
  zIndex: '2147483000',
  maxWidth: '420px',
  maxHeight: '60vh',
  border: '1px solid #334155',
  borderRadius: '12px',
  boxShadow: '0 8px 30px rgb(0 0 0 / 0.35)',
}

const nativePanelStyle: Record<string, string> = {
  ...basePanelStyle,
  width: '100%',
  minHeight: '100%',
}

const thStyle: Record<string, string> = {
  textAlign: 'left',
  padding: '4px 6px',
  color: '#94a3b8',
  fontSize: '10px',
  textTransform: 'uppercase',
}
const tdStyle: Record<string, string> = { borderTop: '1px solid #1e293b', padding: '5px 6px' }

type Labels = {
  readonly title: string
  readonly waiting: string
  readonly empty: string
  readonly role: string
  readonly provider: string
  readonly model: string
  readonly reasoning: string
  readonly inspector: string
  readonly knownRoles: Readonly<Record<string, string>>
}

function labels(): Labels {
  const language = document.documentElement.lang || navigator.language
  if (language.toLowerCase().startsWith('zh')) {
    return {
      title: 'DSHelm 调度面板',
      waiting: '正在等待运行时数据...',
      empty: '当前会话还没有调度记录。',
      role: '角色',
      provider: '服务商',
      model: '模型',
      reasoning: '推理等级',
      inspector: '决策解释',
      knownRoles: { planner: '规划', worker: '执行', reviewer: '审核' },
    }
  }
  return {
    title: 'DSHelm Control Plane',
    waiting: 'Waiting for host projection...',
    empty: 'No delegations recorded yet.',
    role: 'Role',
    provider: 'Provider',
    model: 'Model',
    reasoning: 'Reasoning',
    inspector: 'Resolution Inspector',
    knownRoles: {},
  }
}

function RolesTable({ snapshot, copy }: { snapshot: ControlPlaneProjectionValue; copy: Labels }): ReactNode {
  if (snapshot.roles.length === 0) return <p>{copy.empty}</p>
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={thStyle}>{copy.role}</th>
          <th style={thStyle}>{copy.provider}</th>
          <th style={thStyle}>{copy.model}</th>
          <th style={thStyle}>{copy.reasoning}</th>
        </tr>
      </thead>
      <tbody>
        {snapshot.roles.map((row, index) => (
          <tr key={index}>
            <td style={tdStyle}>{copy.knownRoles[row.role] === undefined ? row.role : `${copy.knownRoles[row.role]} · ${row.role}`}</td>
            <td style={tdStyle}>{row.provider}</td>
            <td style={tdStyle}><code>{row.model}</code></td>
            <td style={tdStyle}>{row.reasoning ?? 'default'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Inspector({ snapshot, copy }: { snapshot: ControlPlaneProjectionValue; copy: Labels }): ReactNode {
  return (
    <details open>
      <summary>{copy.inspector} · {snapshot.inspector.request}</summary>
      <ol style={{ margin: '8px 0 0', paddingLeft: '18px', color: '#94a3b8' }}>
        {snapshot.inspector.trace.fields.map((field, index) => (
          <li key={index}>
            <strong style={{ color: '#e2e8f0' }}>{field.field}</strong> = <code>{field.value}</code> ({field.source})
          </li>
        ))}
      </ol>
    </details>
  )
}

function ControlPlanePanel({ sessions, native = false }: { sessions: SessionsFace; native?: boolean }): ReactNode {
  const snapshot = useControlPlane(sessions)
  const copy = labels()
  return (
    <aside data-dshelm-control-plane data-dshelm-panel-mode={native ? 'native' : 'overlay'} style={native ? nativePanelStyle : overlayPanelStyle}>
      <h1 style={{ margin: '0 0 8px', fontSize: '13px' }}>{copy.title}</h1>
      {snapshot === undefined
        ? <p>{copy.waiting}</p>
        : (
          <>
            <RolesTable snapshot={snapshot} copy={copy} />
            <Inspector snapshot={snapshot} copy={copy} />
          </>
        )}
    </aside>
  )
}

function NativePanelIcon(): ReactNode {
  return <span aria-hidden="true" style={{ fontSize: '10px', fontWeight: '700' }}>DS</span>
}

/** Register the 0.1.5 root-level panel contract when the slot service exists. */
export function registerNativeControlPlanePanel(ctx: ClientContext): boolean {
  const slots = ctx.slots
  if (slots === undefined || typeof slots.inject !== 'function' || typeof slots.register !== 'function') return false
  slots.inject('main', () => slots.register(
    { name: 'main', key: PANEL_ID },
    () => <ControlPlanePanel sessions={ctx.sessions} native />,
  ))
  slots.inject('sidebar.panellist', () => slots.register(
    { name: 'sidebar.panellist', id: PANEL_ID, order: 70, label: 'DSHelm' },
    NativePanelIcon,
  ))
  return true
}

function mountOverlay(ctx: ClientContext): (() => void) | undefined {
  if (typeof document === 'undefined') return undefined
  const host = document.createElement('aside')
  document.body.appendChild(host)
  const root = createRoot(host)
  root.render(<ControlPlanePanel sessions={ctx.sessions} />)
  return () => {
    root.unmount()
    host.remove()
  }
}

export function apply(ctx: ClientContext): void {
  if (registerNativeControlPlanePanel(ctx)) return

  // Preserve the verified-host UI while waiting for a slot service that may
  // be composed later. Once current slots appear, remove the compatibility
  // overlay and hand ownership to DSH's native main/sidebar panel system.
  let disposeOverlay = mountOverlay(ctx)
  ctx.effect(() => () => {
    disposeOverlay?.()
    disposeOverlay = undefined
  })

  ctx.inject(['slots'], (injected) => {
    const current = injected as ClientContext
    if (!registerNativeControlPlanePanel(current)) return
    disposeOverlay?.()
    disposeOverlay = undefined
  })
}
