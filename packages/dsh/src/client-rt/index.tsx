/**
 * DSHelm control-plane panel — REAL DSH client plugin (browser half).
 *
 * Consumes the canonical host projection (dshelm.controlPlane) through the
 * official client runtime: the current session's projection store
 * (sessions.binding(id).session.projections.faceOf(key) — the useProjection
 * resolution path). No second UI-only explanation model exists: the value IS
 * the canonical ResolutionTrace-derived snapshot.
 *
 * v0.2 surface: a body-mounted panel (the AgentTeams-validated pattern for
 * surfaces without a native slot seat). Conversation-slot integration is a
 * documented next increment.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { ControlPlaneProjectionValue } from '../session-events.ts'

/** Required services: the sessions domain (list + bindings). */
export const inject = ['sessions'] as const

type ProjectionFace = {
  getSnapshot(): unknown
  subscribe(fn: () => void): () => void
}

function useControlPlane(sessions: ClientContext['sessions']): ControlPlaneProjectionValue | undefined {
  const [value, setValue] = useState<ControlPlaneProjectionValue | undefined>(undefined)
  useEffect(() => {
    let face: ProjectionFace | undefined
    let unsubscribeList: (() => void) | undefined
    const rebind = (): void => {
      const current: SessionId | undefined = sessions.list.getSnapshot().current
      const binding = current === undefined ? undefined : sessions.binding(current)
      const next = binding?.session.projections.faceOf('dshelm.controlPlane')
      if (next !== undefined) {
        face = next
        const sync = (): void => setValue(next.getSnapshot() as ControlPlaneProjectionValue | undefined)
        sync()
        next.subscribe(sync)
      } else {
        face = undefined
        setValue(undefined)
      }
    }
    rebind()
    unsubscribeList = sessions.list.subscribe(rebind)
    return () => {
      unsubscribeList?.()
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

function RolesTable({ snapshot }: { snapshot: ControlPlaneProjectionValue }): ReactNode {
  if (snapshot.roles.length === 0) return <p>No delegations recorded yet.</p>
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={thStyle}>Role</th>
          <th style={thStyle}>Provider</th>
          <th style={thStyle}>Model</th>
          <th style={thStyle}>Reasoning</th>
        </tr>
      </thead>
      <tbody>
        {snapshot.roles.map((row, index) => (
          <tr key={index}>
            <td style={tdStyle}>{row.role}</td>
            <td style={tdStyle}>{row.provider}</td>
            <td style={tdStyle}><code>{row.model}</code></td>
            <td style={tdStyle}>{row.reasoning ?? 'default'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Inspector({ snapshot }: { snapshot: ControlPlaneProjectionValue }): ReactNode {
  return (
    <details open>
      <summary>Resolution Inspector · {snapshot.inspector.request}</summary>
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

function ControlPlanePanel({ sessions }: { sessions: ClientContext['sessions'] }): ReactNode {
  const snapshot = useControlPlane(sessions)
  return (
    <aside data-dshelm-control-plane style={panelStyle}>
      <h1 style={{ margin: '0 0 8px', fontSize: '13px' }}>DSHelm Control Plane</h1>
      {snapshot === undefined
        ? <p>Waiting for host projection…</p>
        : (
          <>
            <RolesTable snapshot={snapshot} />
            <Inspector snapshot={snapshot} />
          </>
        )}
    </aside>
  )
}

export function apply(ctx: ClientContext): void {
  const host = document.createElement('aside')
  document.body.appendChild(host)
  const root = createRoot(host)
  root.render(<ControlPlanePanel sessions={ctx.sessions} />)
  ctx.effect(() => () => {
    root.unmount()
    host.remove()
  })
}
