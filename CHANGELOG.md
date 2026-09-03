# Changelog

DSHelm is still in alpha. Entries before the first public npm publication are **source milestones**, not registry releases. A version is considered publicly released only when the corresponding npm packages and GitHub prerelease both exist and the clean-install evidence is recorded.

## Unreleased

### Community and release readiness

- Clarified the public project positioning and September maintenance status.
- Added contributor/support governance and evidence-driven contribution rules.
- Added a credential-free offline planner → workers → reviewer routing fixture with Resolution Trace output.
- Added a credential-free execution fixture that carries DSHelm resolutions through the real DSH agent factory and AgentLoop, with actual request routes checked against Resolution Trace.
- Prepared consistent npm metadata and package-level documentation for the six publishable packages.
- Added a CI gate for publishable package metadata and reduced duplicate/stale branch runs.
- Kept `dshelm init`'s default `@dshelm/dsh` bundle version aligned with the installed CLI package version.
- Added a machine-readable publishable package graph and version-independent pack/install verification, removing release-version literals from CI and reading the verified DSH package baseline from `compatibility.json`.
- Audited DeepSeek Harness `0.1.2-rc.1` as the current source target and added forward-compatible bridges for the new Session snapshot API plus subagent `agentOptions` / `reasoningEffort` semantics, while keeping `0.1.0-rc.7` as the verified install baseline until the full npm graph and clean-profile journey pass.
- Rebuilt the bilingual README landing experience around a visual routing flow, explicit compatibility/evidence cards, a real control-plane screenshot, and clearer separation between demonstrated contracts and unverified provider/runtime claims.

## 0.3.0-alpha.0 — 2026-08-19 — source milestone

- Added provider-neutral authentication/account capability discovery.
- Added evidence-backed model capability knowledge and routing overlays.
- Updated the DSH profile installation path for the verified rc.7 stack.
- Extended clean-HOME verification for init, profile discovery, diagnostics, explanation, and uninstall.
- Kept product-owned credentials outside DSHelm policy/configuration state.

Primary implementation: [PR #4](https://github.com/Altairpaca/dshelm/pull/4). Community documentation follow-up: [PR #5](https://github.com/Altairpaca/dshelm/pull/5).

## 0.2 — 2026-08-15 — source milestone

- Added `dshelm doctor` and ecosystem diagnostics.
- Added the projection-fed DSH Web client bundle and execution backend contract.
- Added read-only OmO migration with explicit supported/mapped/lossy/unsupported reporting.
- Added pack/install verification against a fresh environment.

Primary implementation: [PR #2](https://github.com/Altairpaca/dshelm/pull/2).

## 0.1-alpha — 2026-08-15 — source milestone

- Established the runtime-validated policy kernel and deterministic resolver.
- Added Resolution Trace and DSH host/service integration.
- Added request/header model-selection proof, keyless vertical-slice coverage, CI, packaging, and the DSHelm rename contract.

Baseline: [PR #1](https://github.com/Altairpaca/dshelm/pull/1).

## Release policy

Release preparation and evidence requirements are documented in [`docs/RELEASING.md`](docs/RELEASING.md). The current public-alpha gate is tracked in [issue #7](https://github.com/Altairpaca/dshelm/issues/7).
