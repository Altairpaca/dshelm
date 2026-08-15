window.__ModuleLoader__.load({
	id: "@dshelm/dsh",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let react_dom_client = require("react-dom/client");
		//#region lib/client-rt/index.js
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
		/** Required services: the sessions domain (list + bindings). */
		const inject = ["sessions"];
		function useControlPlane(sessions) {
			const [value, setValue] = (0, react.useState)(void 0);
			(0, react.useEffect)(() => {
				let unsubscribeList;
				const rebind = () => {
					const current = sessions.list.getSnapshot().current;
					const next = (current === void 0 ? void 0 : sessions.binding(current))?.session.projections.faceOf("dshelm.controlPlane");
					if (next !== void 0) {
						const sync = () => setValue(next.getSnapshot());
						sync();
						next.subscribe(sync);
					} else setValue(void 0);
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
			position: "fixed",
			right: "16px",
			bottom: "16px",
			zIndex: "2147483000",
			maxWidth: "420px",
			maxHeight: "60vh",
			overflow: "auto",
			background: "#0f172a",
			color: "#e2e8f0",
			border: "1px solid #334155",
			borderRadius: "12px",
			padding: "14px 16px",
			font: "12px/1.5 ui-sans-serif, system-ui, sans-serif",
			boxShadow: "0 8px 30px rgb(0 0 0 / 0.35)"
		};
		const thStyle = {
			textAlign: "left",
			padding: "4px 6px",
			color: "#94a3b8",
			fontSize: "10px",
			textTransform: "uppercase"
		};
		const tdStyle = {
			borderTop: "1px solid #1e293b",
			padding: "5px 6px"
		};
		function RolesTable({ snapshot }) {
			if (snapshot.roles.length === 0) return (0, react_jsx_runtime.jsx)("p", { children: "No delegations recorded yet." });
			return (0, react_jsx_runtime.jsxs)("table", {
				style: {
					width: "100%",
					borderCollapse: "collapse"
				},
				children: [(0, react_jsx_runtime.jsx)("thead", { children: (0, react_jsx_runtime.jsxs)("tr", { children: [
					(0, react_jsx_runtime.jsx)("th", {
						style: thStyle,
						children: "Role"
					}),
					(0, react_jsx_runtime.jsx)("th", {
						style: thStyle,
						children: "Provider"
					}),
					(0, react_jsx_runtime.jsx)("th", {
						style: thStyle,
						children: "Model"
					}),
					(0, react_jsx_runtime.jsx)("th", {
						style: thStyle,
						children: "Reasoning"
					})
				] }) }), (0, react_jsx_runtime.jsx)("tbody", { children: snapshot.roles.map((row, index) => (0, react_jsx_runtime.jsxs)("tr", { children: [
					(0, react_jsx_runtime.jsx)("td", {
						style: tdStyle,
						children: row.role
					}),
					(0, react_jsx_runtime.jsx)("td", {
						style: tdStyle,
						children: row.provider
					}),
					(0, react_jsx_runtime.jsx)("td", {
						style: tdStyle,
						children: (0, react_jsx_runtime.jsx)("code", { children: row.model })
					}),
					(0, react_jsx_runtime.jsx)("td", {
						style: tdStyle,
						children: row.reasoning ?? "default"
					})
				] }, index)) })]
			});
		}
		function Inspector({ snapshot }) {
			return (0, react_jsx_runtime.jsxs)("details", {
				open: true,
				children: [(0, react_jsx_runtime.jsxs)("summary", { children: ["Resolution Inspector · ", snapshot.inspector.request] }), (0, react_jsx_runtime.jsx)("ol", {
					style: {
						margin: "8px 0 0",
						paddingLeft: "18px",
						color: "#94a3b8"
					},
					children: snapshot.inspector.trace.fields.map((field, index) => (0, react_jsx_runtime.jsxs)("li", { children: [
						(0, react_jsx_runtime.jsx)("strong", {
							style: { color: "#e2e8f0" },
							children: field.field
						}),
						" = ",
						(0, react_jsx_runtime.jsx)("code", { children: field.value }),
						" (",
						field.source,
						")"
					] }, index))
				})]
			});
		}
		function ControlPlanePanel({ sessions }) {
			const snapshot = useControlPlane(sessions);
			return (0, react_jsx_runtime.jsxs)("aside", {
				"data-dshelm-control-plane": true,
				style: panelStyle,
				children: [(0, react_jsx_runtime.jsx)("h1", {
					style: {
						margin: "0 0 8px",
						fontSize: "13px"
					},
					children: "DSHelm Control Plane"
				}), snapshot === void 0 ? (0, react_jsx_runtime.jsx)("p", { children: "Waiting for host projection…" }) : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(RolesTable, { snapshot }), (0, react_jsx_runtime.jsx)(Inspector, { snapshot })] })]
			});
		}
		function apply(ctx) {
			const host = document.createElement("aside");
			document.body.appendChild(host);
			const root = (0, react_dom_client.createRoot)(host);
			root.render((0, react_jsx_runtime.jsx)(ControlPlanePanel, { sessions: ctx.sessions }));
			ctx.effect(() => () => {
				root.unmount();
				host.remove();
			});
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map