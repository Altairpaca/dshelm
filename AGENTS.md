# DSHelm Development Contract

## Product boundary

DSHelm is the **batteries-included agent layer for DeepSeek Harness (DSH)** —
an OmO-inspired, DSH-native, ecosystem-composable agent distribution.
DSH is the execution foundation; DSHelm is the integrated agent layer on top.

**DSHelm Core** is the policy / configuration / routing kernel: roles,
categories, model profiles, deterministic resolution, runtime capability
validation, provenance traces (Resolution Trace), and
configuration/observability surfaces. It imports no DSH package.

Execution is **composed** from DSH-native primitives and mature ecosystem
capabilities wherever they exist. A user-visible DSHelm feature (teams,
workflows, fallback) does not imply DSHelm reimplements its runtime.

Do not reimplement sessions, generic subagents, provider transport, durable
workflows, team mailboxes/state, terminal infrastructure, or fallback runtimes
that DSH or an ecosystem plugin already provides.

## Community reuse rule

Before implementing any capability, ask:

1. Does DSH core already provide it?
2. Does a mature DSH plugin already provide it?
3. Do AgentTeams / workflow / fallback / router plugins already provide it?
4. Does Oh-My-DSH offer an adoptable or reference plugin?
5. Is there a real gap?

Only a real gap justifies own implementation. In particular, DSHelm does not
write a second team runtime: the direction is DSHelm policy → an AgentTeams
adapter/backend. Every third-party dependency is vetted (package.json,
license, dsh.bundle, peerDependencies, scripts, DSH compatibility, source/API,
lifecycle, test quality) before it becomes a dependency.

## OmO boundary

OmO is a **behavioral / product / UX reference** only. Its SUL-1.0 source,
schema, and implementation must not be copied into DSHelm. Port behaviors and
experiences, never source.

## Integration rules

- Read `README.md` and `docs/ARCHITECTURE.md` before changing architecture.
- Use public DSH/Cordis seams; never patch the DSH core checkout. The DSH
  mux-flood hotfix in `patches/` is a development-environment workaround, not
  a DSHelm runtime dependency.
- Verify every DSH API against the pinned reference checkout currently used
  by this repository. Do not rely on remembered interfaces.
- Keep `packages/core` independent of DSH. Keep `packages/dsh` thin.
- Resolver output must be deterministic, serializable, and explainable.
- Unknown references, cycles, disabled providers, and unavailable models fail
  loudly; never silently select a different model.
- Explicit user/project/request disables and overrides beat defaults.
- Runtime capability inventory beats static assumptions.
- Every material override records provenance and remains visible to tests and
  the control plane.
- UI state is not the source of truth; host/core policy state is.
- `listModels` is advisory catalog metadata; exact-model validity comes from
  `resolveModelInfo`-class seams at runtime.
- Reasoning efforts are adapter-owned opaque identifiers; core invents no
  `low|medium|high` vocabulary, and resolved reasoning must reach the actual
  DSH request config (never metadata-only).
- Heterogeneous model claims require request/header evidence, not just config.

## Testing and documentation

- Public semantic changes require tests and concise documentation.
- Default tests are hermetic (public npm packages); no external checkout paths
  may become implicit test dependencies. An optional `DSH_REFERENCE_DIR`
  source lane is explicit and never required by default CI.
- Prefer keyless composition tests before credentialed DSH E2E.
- Record non-trivial DSH integration decisions with the upstream commit and
  concrete source evidence.
- Never commit credentials, runtime state, agent scratch, or generated
  evidence that is not a deliberate maintainer artifact.
- Before claiming completion, run diagnostics, focused tests, build/install
  checks, and the matching real user surface.

## Git stage publishing

- Work on the requested feature branch; never modify or push `main` unless
  explicitly requested.
- A completed stage means its scoped changes are validated, committed
  atomically, and immediately pushed to that branch's upstream.
- After each stage push, verify the remote branch SHA equals local `HEAD`.
- Keep the worktree clean between stages; do not mix unrelated changes into a
  stage commit.
