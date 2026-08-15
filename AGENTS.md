# DeepHelm Development Contract

## Product boundary

DeepHelm is the policy and control plane for DeepSeek Harness (DSH).
DSH is the execution plane. DeepHelm owns roles, categories, model
profiles, deterministic resolution, runtime capability validation,
provenance traces, and configuration/observability surfaces.

Do not reimplement sessions, generic subagents, provider transport,
durable workflows, teams, terminal infrastructure, or fallback runtimes
that DSH or an ecosystem plugin already provides.

## Integration rules

- Read `README.md` and `docs/ARCHITECTURE.md` before changing architecture.
- Use public DSH/Cordis seams; never patch the DSH core checkout.
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
- OmO is a behavioral and documentation reference only. Its SUL-1.0 source,
  schema, and implementation must not be copied into DeepHelm.

## Testing and documentation

- Public semantic changes require tests and concise documentation.
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
