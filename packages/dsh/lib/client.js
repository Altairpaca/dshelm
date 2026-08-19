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
		function labels() {
			if ((document.documentElement.lang || navigator.language).toLowerCase().startsWith("zh")) return {
				title: "DSHelm 调度面板",
				waiting: "正在等待运行时数据...",
				empty: "当前会话还没有调度记录。",
				role: "角色",
				provider: "服务商",
				model: "模型",
				reasoning: "推理等级",
				inspector: "决策解释",
				knownRoles: {
					planner: "规划",
					worker: "执行",
					reviewer: "审核"
				}
			};
			return {
				title: "DSHelm Control Plane",
				waiting: "Waiting for host projection...",
				empty: "No delegations recorded yet.",
				role: "Role",
				provider: "Provider",
				model: "Model",
				reasoning: "Reasoning",
				inspector: "Resolution Inspector",
				knownRoles: {}
			};
		}
		function RolesTable({ snapshot, copy }) {
			if (snapshot.roles.length === 0) return (0, react_jsx_runtime.jsx)("p", { children: copy.empty });
			return (0, react_jsx_runtime.jsxs)("table", {
				style: {
					width: "100%",
					borderCollapse: "collapse"
				},
				children: [(0, react_jsx_runtime.jsx)("thead", { children: (0, react_jsx_runtime.jsxs)("tr", { children: [
					(0, react_jsx_runtime.jsx)("th", {
						style: thStyle,
						children: copy.role
					}),
					(0, react_jsx_runtime.jsx)("th", {
						style: thStyle,
						children: copy.provider
					}),
					(0, react_jsx_runtime.jsx)("th", {
						style: thStyle,
						children: copy.model
					}),
					(0, react_jsx_runtime.jsx)("th", {
						style: thStyle,
						children: copy.reasoning
					})
				] }) }), (0, react_jsx_runtime.jsx)("tbody", { children: snapshot.roles.map((row, index) => (0, react_jsx_runtime.jsxs)("tr", { children: [
					(0, react_jsx_runtime.jsx)("td", {
						style: tdStyle,
						children: copy.knownRoles[row.role] === void 0 ? row.role : `${copy.knownRoles[row.role]} · ${row.role}`
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
		function Inspector({ snapshot, copy }) {
			return (0, react_jsx_runtime.jsxs)("details", {
				open: true,
				children: [(0, react_jsx_runtime.jsxs)("summary", { children: [
					copy.inspector,
					" · ",
					snapshot.inspector.request
				] }), (0, react_jsx_runtime.jsx)("ol", {
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
			const copy = labels();
			return (0, react_jsx_runtime.jsxs)("aside", {
				"data-dshelm-control-plane": true,
				style: panelStyle,
				children: [(0, react_jsx_runtime.jsx)("h1", {
					style: {
						margin: "0 0 8px",
						fontSize: "13px"
					},
					children: copy.title
				}), snapshot === void 0 ? (0, react_jsx_runtime.jsx)("p", { children: copy.waiting }) : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(RolesTable, {
					snapshot,
					copy
				}), (0, react_jsx_runtime.jsx)(Inspector, {
					snapshot,
					copy
				})] })]
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