# OmO Feature Matrix — DSH ecosystem capability map

> Status legend: NATIVE (DSH core) · MATURE_PLUGIN · PARTIAL · EXPERIMENTAL ·
> MISSING. Only MISSING rows justify a DSHelm-native implementation;
> everything else is composed, adapted, or documented.
> Sources: OmO `dev` AGENTS.md (SUL-1.0, reference only — no code copied),
> dsh-agent-teams 0.1.5 (MIT), dsh-sisyphus-presets (SUL-1.0, reference),
> oh-my-dsh GAP-LEDGER (no license, reference), DSHelm v0.1 baseline.

| OmO capability | DSH native | AgentTeams | Oh-My-DSH | Sisyphus port | DSHelm |
|---|---|---|---|---|---|
| Agents (named roles) | PARTIAL (presets) | NATIVE (members) | MATURE_PLUGIN (agent-directory/profiles) | PARTIAL (lanes) | NATIVE (AgentSpec) |
| Categories (task routing) | PARTIAL (presets) | — | MATURE_PLUGIN (task-categories) | NATIVE (category-router.js) | NATIVE (CategorySpec + resolver) |
| Model routing (role→model) | NATIVE (model-selection) | PARTIAL (per-member override, needs request/header verification) | MATURE_PLUGIN (provider-router, model-routing-policy) | NATIVE (lane-models.js) | NATIVE (ModelProfile + candidates) |
| Fallback (model chains) | NATIVE (fallback in resolver? adapter-owned) | — | MATURE_PLUGIN (provider-fallback) | PARTIAL | NATIVE (ordered candidates) |
| Reasoning effort policy | NATIVE (adapter-owned ids) | PARTIAL (member reasoningEffort) | PARTIAL | — | NATIVE (opaque efforts + validation) |
| Skills | NATIVE (skill provider registry) | — | MATURE_PLUGIN (skill loader/mcp) | — | PARTIAL (metadata-only v0.1) |
| Background tasks | NATIVE (jobs) | PARTIAL (mailbox turns) | MATURE_PLUGIN | — | PARTIAL (slice runners) |
| Continuable agents | NATIVE (subagent continuable) | NATIVE (durable members) | PARTIAL | NATIVE (continuable lanes) | PARTIAL (provider maps to driver) |
| Parallel exploration | NATIVE (subagents) | NATIVE (parallel members) | MATURE_PLUGIN | NATIVE (2–5 lanes) | NATIVE (bounded parallel workers) |
| Librarian lane | — | — | PARTIAL | NATIVE (subagent_librarian) | PARTIAL (role + tools policy) |
| Oracle lane (read-only) | — | — | PARTIAL | NATIVE (sisyphus-oracle + restrict.js) | PARTIAL (read-only tool policy; registry-level masking = Sisyphus) |
| Metis lane (pre-planning) | — | — | PARTIAL | NATIVE | PARTIAL (role) |
| Momus lane (adversarial review) | — | — | PARTIAL | NATIVE (PASS/PASS-WITH-FIXES/FAIL) | PARTIAL (reviewer role + REVISE) |
| Vision lane (multimodal) | NATIVE (read_image) | — | PARTIAL | NATIVE (subagent_vision) | PARTIAL (read_image via tools policy) |
| Sisyphus workflow | — | — | PARTIAL (orchestrator-prompt) | NATIVE | PARTIAL (slice: planner→workers→reviewer) |
| ULW / ULW-loop | — | — | PARTIAL | — | MISSING (reference; goal-style tooling is DSH-native direction) |
| Research mode | NATIVE (web search tools) | — | MATURE_PLUGIN | NATIVE (librarian) | PARTIAL |
| Planning (plan mode) | NATIVE (plan mode) | — | PARTIAL | NATIVE (METIS→plan→MOMUS) | PARTIAL (plan artifact in slice) |
| Review | PARTIAL | PARTIAL | PARTIAL | NATIVE (momus) | NATIVE (structured verdict + bounded revision) |
| Session continuity | NATIVE (persistence) | NATIVE (durable members) | MATURE_PLUGIN (session-share/archive) | — | PARTIAL |
| Memory | NATIVE (dsh-mneme/dsh-context ecosystem) | — | MATURE_PLUGIN (memory-writeback) | — | PARTIAL (via ecosystem) |
| Tool restrictions | NATIVE (toolFilter/restrict) | NATIVE (member deny list) | MATURE_PLUGIN | NATIVE (restrict.js registry-level) | NATIVE (ToolPolicy → toolFilter) |
| Prompt injection (persona) | NATIVE (system-prompt sections) | NATIVE (member persona) | PARTIAL | NATIVE | NATIVE (persona → systemPrompt) |
| Long-running tasks | NATIVE (jobs/goals) | NATIVE (durable teams) | PARTIAL | NATIVE (background lanes) | PARTIAL (slice) |
| Compaction | NATIVE | — | MATURE_PLUGIN (checkpoint) | — | PARTIAL |
| Web observability | NATIVE (Web shell) | NATIVE (tree monitor panel) | PARTIAL (trace viewer) | — | PARTIAL (host projection; client slot blocked→resolved, build pending) |
| Configuration UX | NATIVE (settings) | PARTIAL | MATURE_PLUGIN (jsonc-config) | PARTIAL | NATIVE (.dshelm/config.jsonc precedence) |
| Session import | — | — | PARTIAL | — | PARTIAL (ADR; no importer yet) |
| Doctor / diagnostics | PARTIAL | — | MATURE_PLUGIN (doctor) | — | MISSING → **dshelm doctor (v0.2 deliverable)** |
| Team orchestration UX | — | NATIVE (captain/members/tasks) | PARTIAL (agent-teams plugin dir) | — | PARTIAL (adapter direction) |
| Goal tracking | NATIVE (goal plugin) | — | PARTIAL | NATIVE | PARTIAL |

## DSHelm conclusions

1. DSHelm's differentiator is NOT implementing the MISSING rows — it is the
   **verified composition** of NATIVE + MATURE_PLUGIN + DSHelm policy.
2. Real gaps worth DSHelm-native work: doctor/diagnostics surface,
   OmO migration tooling, AgentTeams adapter, Web control plane on the
   canonical Resolution Trace.
3. Everything else is composed through the ecosystem (memory, research,
   teams, workflows, skills execution).
