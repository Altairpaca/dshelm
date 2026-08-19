# DSHelm Source & License Ledger

> Every third-party absorption, reference, or dependency is recorded here.
> Classification: REFERENCE_ONLY | BEHAVIOR_PORT | DEPENDENCY | VENDORED |
> DERIVATIVE | UPSTREAM_PATCH.
>
> Hard rule: SUL / source-available / unclear-license material NEVER enters
> the Apache-2.0 DSHelm tree as code. Behavioral compatibility only.

## 1. DeepSeek Harness (official)

| Field | Value |
|---|---|
| Repo | github.com/deepseek-ai/deepseek-harness |
| Commit (reference) | `99f6f02fecdb7dff40c3fbc9470f5907c29f74ca` (tag `dsh-v0.1.0-rc.7`; local research checkout remains at `47f943859bef60e4160492346772ded9b24f765a`) |
| License | MIT (public repo, vendored Cordis per repo policy) |
| Classification | DEPENDENCY (published `@deepseek-ai/dsh-*` rc.7 packages; transitive rc.6 support packages remain npm-resolved) + REFERENCE (pinned checkout for seam evidence) |
| Purpose | runtime/kernel/plugin substrate; official seams (llm, agent, subagent, session, projection, settings) |
| Files used | none copied; API contracts quoted in master contracts |
| Modification | none |
| Attribution | not required (MIT) but credited in README |

## 2. dsh-agent-teams (NanmiCoder)

| Field | Value |
|---|---|
| Repo | github.com/NanmiCoder/dsh-agent-teams |
| Commit | `2b114124` (0.1.5, 2026-08-15) |
| License | MIT |
| Classification | BEHAVIOR_PORT / DEPENDENCY (adapter direction; no code copied yet) |
| Purpose | durable team execution backend (captain/members/mailbox/task DAG); DSHelm policy → AgentTeams adapter |
| Notes | no test suite upstream (gap); manifest carries legacy `dshClient` key alongside `dsh.client` (minor); per-member model selection uses `startContinuable` + `withPending` — re-verify effective model via request/header |
| Upstream | open issues/PRs preferred (MIT allows) |

## 3. DSH Sisyphus Presets (hnlg-coder)

| Field | Value |
|---|---|
| Repo | github.com/hnlg-coder/dsh-sisyphus-presets |
| License | SUL-1.0 (derivative of oh-my-opencode; non-commercial) |
| Classification | REFERENCE_ONLY |
| Purpose | behavioral reference: six-lane orchestration (explore/oracle/vision/librarian/metis/momus), intent gate, METIS→plan→MOMUS loop, restrict.js read-only enforcement, lane model routing |
| Files used | none |
| DSHelm relation | compatible preset backend candidate; DSHelm may detect/support/integrate it, never copy its SUL-1.0 persona text into Apache-2.0 code |

## 4. oh-my-openagent / OmO (code-yeongyu)

| Field | Value |
|---|---|
| Repo | github.com/code-yeongyu/oh-my-openagent (default branch `dev`) |
| License | SUL-1.0 |
| Classification | REFERENCE_ONLY (behavioral/product/UX reference) |
| Purpose | feature inventory for the OmO compatibility matrix: agents/categories/model routing/team mode/background tasks/goal/fallback/doctor |
| Files used | none (API-level research only; clone blocked by network, researched via GitHub API) |
| DSHelm relation | `dshelm migrate omo` reads ~/.omo config read-only; behavioral port only |

## 5. oh-my-dsh (LaplaceYoung)

| Field | Value |
|---|---|
| Repo | github.com/LaplaceYoung/oh-my-dsh |
| License | **none recognized** (no LICENSE file) |
| Classification | REFERENCE_ONLY |
| Purpose | capability library research (GAP-LEDGER, 530 plugin dirs / 444 kept); behavior/architecture study |
| Files used | none |
| Notes | cannot absorb source until a license appears; DSHelm links optional external capabilities instead |

## 6. Oh-My-DSH catalog (like-study1)

| Field | Value |
|---|---|
| Repo | github.com/like-study1/Oh-My-DSH |
| License | MIT |
| Classification | REFERENCE_ONLY (directory) |
| Purpose | ecosystem discovery/monitoring; never a DSHelm core value |

## 7. Published npm dependencies (DSHelm packages)

All directly used `@deepseek-ai/dsh-*` rc.7, `@deepseek-ai/cordis` 4.0.1, zod 4, jsonc-parser,
fast-check, vitest, tsx, playwright — per-package licenses are MIT (DSH
family) / MIT (zod, fast-check, vitest, tsx, playwright) / MIT (jsonc-parser).
See each package.json.

## 8. Auth and model evidence inputs

| Source | Version / commit | License | Classification | Scope |
|---|---|---|---|---|
| github.com/earendil-works/pi | `v0.82.1` / `b4f293684bba718d59cc1157679bcf6157b3a7f5` | MIT | DEPENDENCY + REFERENCE | provider-owned OAuth, `CredentialStore`, `Models.login/checkAuth/logout`; DSHelm uses the published package, no source copied |
| DSHelm `@dshelm/auth` | local package `0.3.0-alpha.0` | Apache-2.0 | DEPENDENCY (internal) | opaque credential refs and ownership-neutral auth adapters |
| DSHelm `@dshelm/model-knowledge` | local package `0.3.0-alpha.0` | Apache-2.0 | DEPENDENCY (internal) | Zod-validated runtime/official/community/empirical evidence bundle |

## 9. Native product auth audit (2026-08-18)

| Product | Observed public seam | Verified snapshot | DSHelm disposition |
|---|---|---|---|
| OpenAI Codex | top-level `codex login` / `codex logout`; app-server account APIs include `account/read`, `account/login/start`, `account/login/cancel`, `account/logout` | CLI `0.147.0`; source `0acf302db5ffedea4b8ef0112f4cbcddd65cff57` | current version-gated descriptor; app-server is future candidate |
| Claude Code | `claude auth login/status/logout` | `2.1.234`; source `354757e5b2d9aa1ebb62e5d05ecd384f0e11c0f7` | current version-gated descriptor |
| Gemini CLI | interactive `/auth` flow; no verified shell `auth login/logout` | `0.55.1`; source `24cc26ccb15522b55c4f8a63b2f894fb99b8e82a` | unsupported shell descriptor; no guessed command |
| Qwen Code | interactive `/auth`; legacy `qwen auth` removed; daemon/SDK seam is not a shell contract | `0.21.13`; source `179c8f80fd14da7e76b370ee58db1a733f9e21ae` | unsupported shell descriptor; daemon/SDK remains research |
| xAI/Grok native product | no stable public native CLI/app-server auth seam verified | audit snapshot | no native descriptor; provider-owned pi-ai OAuth remains separate |

Descriptor versions are compatibility evidence, not a promise that future
versions work. Unknown or out-of-range versions must not execute sensitive
login/logout commands.

## 10. Unresolved / watch items

- oh-my-dsh (LaplaceYoung) license: re-check monthly; if a permissive
  license appears, reassess absorption candidates individually.
- AgentTeams per-member effective-model verification: pending reproducible
  request/header test (see v0.2 contract §5.2).
- OS keychain backend for DSHelm-managed pi-ai credentials: pending; current
  bridge is the documented `0600` file fallback only.
