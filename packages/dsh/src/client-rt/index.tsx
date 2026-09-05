/**
 * DSHelm control-plane panel — DSH client plugin (browser half).
 *
 * Consumes the canonical host projection (dshelm.controlPlane) through the
 * current session projection face (`sessions.binding(id).session.projections`).
 * No second UI-only explanation model exists: the value IS the canonical
 * ResolutionTrace-derived snapshot.
 *
 * Compatibility note: DSH 0.1.2 replaces the old `dsh-client-runtime` package
 * with the client module system and package-owned API/UI client extensions.
 * This plugin therefore types only the small structural session face it uses;
 * the package-manifest dependency/inject migration is promoted together with
 * the 0.1.2 npm graph and lockfile, never as a source-only version bump.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import type { ControlPlaneProjectionValue } from '../session-events.ts'

/** Required service: the client session domain. */
export const inject = ['sessions'] as const

type ClientSessionId = string

type ProjectionFace = {
  getSnapshot(): unknown
  subscribe(fn: () => void): () => void
}

type ClientSessionsFace = {
  readonly list: {
    getSnapshot(): { readonly current?: ClientSessionId }
    subscribe(fn: () => void): () => void
  }
  binding(id: ClientSessionId): {
    readonly session: {
      readonly projections: {
        faceOf(key: string): ProjectionFace | undefined
      }
    }
  } | undefined
}

export interface DSHelmWebClientContext {
  readonly sessions: ClientSessionsFace
  effect(cleanup: () => (() => void) | void, label?: string): void
}

function useControlPlane(sessions: ClientSessionsFace): ControlPlaneProjectionValue | undefined {
  const [value, setValue] = useState<ControlPlaneProjectionValue | undefined>(undefined)
  useEffect(() => {
    let unsubscribeProjection: (() => void) | undefined

    const rebind = (): void => {
      unsubscribeProjection?.()
      unsubscribeProjection = undefined

      const current = sessions.list.getSnapshot().current
      const binding = current === undefined ? undefined : sessions.binding(current)
      const next = binding?.session.projections.faceOf('dshelm.controlPlane')
      if (next === undefined) {
        setValue(undefined)
        return
      }

      const sync = (): void => setValue(next.getSnapshot() as ControlPlaneProjectionValue | undefined)
      sync()
      unsubscribeProjection = next.subscribe(sync)
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

const panelStyle: Record<string, string> = {
  position: 'fixed',
  right: '16px',
  bottom: '16px',
  zIndex: '2147483000',
  maxWidth: '420px',
  maxHeight: '60vh',
  overflow: 'auto',
  background: '#0f172a',
  color: '#e2e8f0',
  border: '1px solid #334155',
  borderRadius: '12px',
  padding: '14px 16px',
  font: '12px/1.5 ui-sans-serif, system-ui, sans-serif',
  boxShadow: '0 8px 30px rgb(0 0 0 / 0.35)',
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

function ControlPlanePanel({ sessions }: { sessions: ClientSessionsFace }): ReactNode {
  const snapshot = useControlPlane(sessions)
  const copy = labels()
  return (
    <aside data-dshelm-control-plane style={panelStyle}>
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

export function apply(ctx: DSHelmWebClientContext): void {
  const host = document.createElement('aside')
  document.body.appendChild(host)
  const root = createRoot(host)
  root.render(<ControlPlanePanel sessions={ctx.sessions} />)
  ctx.effect(() => () => {
    root.unmount()
    host.remove()
  })
}
