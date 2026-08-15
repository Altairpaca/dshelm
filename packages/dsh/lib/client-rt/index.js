import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
/** Required services: the sessions domain (list + bindings). */
export const inject = ['sessions'];
function useControlPlane(sessions) {
    const [value, setValue] = useState(undefined);
    useEffect(() => {
        let face;
        let unsubscribeList;
        const rebind = () => {
            const current = sessions.list.getSnapshot().current;
            const binding = current === undefined ? undefined : sessions.binding(current);
            const next = binding?.session.projections.faceOf('dshelm.controlPlane');
            if (next !== undefined) {
                face = next;
                const sync = () => setValue(next.getSnapshot());
                sync();
                next.subscribe(sync);
            }
            else {
                face = undefined;
                setValue(undefined);
            }
        };
        rebind();
        unsubscribeList = sessions.list.subscribe(rebind);
        return () => {
            unsubscribeList?.();
        };
    }, [sessions]);
    return value;
}
const panelStyle = {
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
};
const thStyle = {
    textAlign: 'left',
    padding: '4px 6px',
    color: '#94a3b8',
    fontSize: '10px',
    textTransform: 'uppercase',
};
const tdStyle = { borderTop: '1px solid #1e293b', padding: '5px 6px' };
function RolesTable({ snapshot }) {
    if (snapshot.roles.length === 0)
        return _jsx("p", { children: "No delegations recorded yet." });
    return (_jsxs("table", { style: { width: '100%', borderCollapse: 'collapse' }, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: thStyle, children: "Role" }), _jsx("th", { style: thStyle, children: "Provider" }), _jsx("th", { style: thStyle, children: "Model" }), _jsx("th", { style: thStyle, children: "Reasoning" })] }) }), _jsx("tbody", { children: snapshot.roles.map((row, index) => (_jsxs("tr", { children: [_jsx("td", { style: tdStyle, children: row.role }), _jsx("td", { style: tdStyle, children: row.provider }), _jsx("td", { style: tdStyle, children: _jsx("code", { children: row.model }) }), _jsx("td", { style: tdStyle, children: row.reasoning ?? 'default' })] }, index))) })] }));
}
function Inspector({ snapshot }) {
    return (_jsxs("details", { open: true, children: [_jsxs("summary", { children: ["Resolution Inspector \u00B7 ", snapshot.inspector.request] }), _jsx("ol", { style: { margin: '8px 0 0', paddingLeft: '18px', color: '#94a3b8' }, children: snapshot.inspector.trace.fields.map((field, index) => (_jsxs("li", { children: [_jsx("strong", { style: { color: '#e2e8f0' }, children: field.field }), " = ", _jsx("code", { children: field.value }), " (", field.source, ")"] }, index))) })] }));
}
function ControlPlanePanel({ sessions }) {
    const snapshot = useControlPlane(sessions);
    return (_jsxs("aside", { "data-dshelm-control-plane": true, style: panelStyle, children: [_jsx("h1", { style: { margin: '0 0 8px', fontSize: '13px' }, children: "DSHelm Control Plane" }), snapshot === undefined
                ? _jsx("p", { children: "Waiting for host projection\u2026" })
                : (_jsxs(_Fragment, { children: [_jsx(RolesTable, { snapshot: snapshot }), _jsx(Inspector, { snapshot: snapshot })] }))] }));
}
export function apply(ctx) {
    const host = document.createElement('aside');
    document.body.appendChild(host);
    const root = createRoot(host);
    root.render(_jsx(ControlPlanePanel, { sessions: ctx.sessions }));
    ctx.effect(() => () => {
        root.unmount();
        host.remove();
    });
}
//# sourceMappingURL=index.js.map