# ADR: Rename DeepHelm → DSHelm

> Status: ACCEPTED (Round 3, interrupted-recovery round) · Branch `work/deephelm-bootstrap`
> Applies to: product identity, package scope, plugin id, service names, config paths,
> UI selectors, documentation, repository/branch naming (phased).

## Context

The project was bootstrapped as "DeepHelm" with a deliberately narrow framing:
*"a policy/control plane for DeepSeek Harness"*. The external audit and the
interrupted hardening round exposed two problems:

1. The product boundary was over-narrowed: users were told DSHelm-like scope ended at
   policy/control, while the actual goal is a batteries-included agent distribution
   whose deterministic policy kernel sits inside a complete user experience
   (agents, roles, model profiles, skills, teams/workflows, observability, Web
   control surfaces, conversation interop).
2. The name "DeepHelm" read as a generic "universal harness" claim, which the project
   is not — it is a DeepSeek Harness ecosystem distribution.

## Decision

Rename the product from **DeepHelm** to **DSHelm**.

- **DSHelm** — The batteries-included agent layer for DeepSeek Harness.
- Secondary positioning: *OmO-inspired. DSH-native. Ecosystem-composable.*

Rationale:

- **Helm** is kept: steering / cockpit / orchestration meaning is retained.
- **DSHelm** embeds directly in the DSH mental model (like `dsh-*` package families)
  while remaining distinguishable as a third-party distribution.
- The project unambiguously belongs to the DeepSeek Harness ecosystem today; the name
  must not pretend to be a harness-independent universal platform.
- If the project ever genuinely spans harnesses, an umbrella brand can be discussed
  then; that is explicitly out of scope now.
- The current goal is to be the most complete, most usable third-party agent
  distribution in the DSH ecosystem.

## Canonical naming (authority table)

| Thing | Old | New |
|---|---|---|
| Product name | DeepHelm | **DSHelm** |
| Repository | `Altairpaca/deephelm` | `Altairpaca/dshelm` (GitHub rename, phased) |
| Package scope | `@deephelm/*` | `@dshelm/*` |
| Initial packages | `@deephelm/core`, `@deephelm/dsh` | `@dshelm/core`, `@dshelm/dsh` |
| Project config dir | `.deephelm/` | `.dshelm/` |
| Project config file | `.deephelm/config.jsonc` | `.dshelm/config.jsonc` |
| Local-only state | `.deephelm/local/` | `.dshelm/local/` (gitignored) |
| Plugin id | `deephelm` | `dshelm` |
| Host policy service | `deephelm.policy` | `dshelm.policy` (Cordis service) |
| Service class | `DeepHelmPolicyService` | `DSHelmPolicyService` |
| Client context | `DeepHelmClientContext` | `DSHelmClientContext` |
| Constants | `DEEPHELM_*` | `DSHELM_*` |
| Event type | `deephelm/control-plane` | `dshelm/control-plane` |
| Projection key | `deephelm.controlPlane` | `dshelm.controlPlane` |
| Subagent provider | `deephelm` / `deephelm:` role labels | `dshelm` / `dshelm:` |
| UI selectors | `data-deephelm-*` | `data-dshelm-*` |
| Settings namespace | `deephelm` | `dshelm` |
| QA profile | `deephelm-v01` | `dshelm-v01` |

## Rename method (NOT blind global replacement)

Occurrences are classified and handled per class:

- **A — Product identifiers** (must change): all rows of the authority table above,
  test names, example profile names, issue/PR templates, README/docs.
- **B — Historical references** (keep old name intentionally): this ADR's own text,
  the recovery section of the master contract, any "formerly DeepHelm" migration
  note, git history. Never rewrite history.
- **C — Local/scratch paths** (do NOT mechanically rename): the local directory
  names `deephelm-worktrees` and the main repo dir stay as-is (Git worktree
  metadata records absolute paths; renaming the dir would corrupt metadata without
  `git worktree repair`). The hermetic-test dependency
  `../../deephelm-community/deepseek-harness` is REMOVED, not renamed
  (external-path test dependency is banned by the master contract §24).
- **D — External/environment artifacts** (inspect before touching): DSH hotfix
  backups, old session paths, `.agent-teams`, `.omo` — left untouched.

## Phasing

1. Recovery snapshot + this ADR + master contract update (Stage 0 commit).
2. Code/package/docs/config rename on `work/deephelm-bootstrap` (Stage 1 commit) —
   disk paths unchanged.
3. Verify typecheck/tests green after rename; only then branch rename to
   `work/dshelm-bootstrap` and push; verify remote SHA == local HEAD.
4. Keep the old remote branch until the new one is verified; then remove old.
5. GitHub repo rename `Altairpaca/deephelm` → `Altairpaca/dshelm` (if token/gh
   permits; otherwise record explicit maintainer instructions — engineering work is
   never blocked on it). Update `git remote -v` origin URL after rename.
6. npm `@dshelm` scope availability checked before any publish (Stage 6).
   If unavailable: record blocker; product name stays DSHelm; package scope gets its
   own decision — never fall back to DeepHelm/Cordhelm.

## Consequences

- All public identifiers migrate to DSHelm; no active identifier may retain
  `@deephelm`, `.deephelm`, `deephelmPolicy`, `DeepHelmPolicy*`,
  `data-deephelm`, or plugin id `deephelm` after Stage 1 (exceptions: category B
  historical references).
- Existing DSH installation artifacts (bundles installed under the old id in
  profiles) need reinstall under `dshelm`; v0.1-alpha has no upgrade contract.
- The mux-flood hotfix (main repo `patches/`) is a development-environment
  workaround, NOT a DSHelm runtime dependency; it is unaffected by this rename.

## References

- `docs/decisions/v0.1-alpha-hardening.md` (master contract, §0/§1.1)
- README positioning section (§11 of the rename brief)
