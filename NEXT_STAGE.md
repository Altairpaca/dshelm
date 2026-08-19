# DSHelm v0.3 Next-Stage Frozen Execution Contract

Status: VERIFY_GO_PENDING_GITHUB_CI. This file remains the source of truth for
the execution stage. A fresh independent reviewer issued `GO` after the
post-fix audit; implementation stayed within the frozen P0/P1 scope. GitHub
Actions for the pushed commit remains the final automated merge gate.

## 1. Current Merge Readiness

### Repository and CI facts (re-verified 2026-08-18)

- Repository: `Altairpaca/dshelm`, local checkout `/home/altair/projects/agent-harness-lab/deephelm`.
- Worktree: clean (`git status --short` empty).
- Branch: `feat/v0.3-auth-model-orchestration` at
  `436f570733c7349daf070e155a9fb8da88cc6bef`
  (`docs(v0.3): refresh verification counts`).
- `origin/main` and `origin/HEAD`: `5df586d3f01999773b9f54d476874f2a0f3edc54`.
- `origin/feat/v0.3-auth-model-orchestration`: the feature SHA above.
- `git rev-list --left-right --count main...HEAD`: `0 12` (ahead 12,
  behind 0).
- GitHub Actions run `32108558052` for the feature SHA is successful. The
  successful jobs are `core-unit`, `core-property`, `typecheck`, `build`,
  `dsh-contract`, `v03-auth-knowledge-cli`, and `pack-install`.
- `dsh-upstream-source-contract` was skipped because it only runs on
  `workflow_dispatch`; this is not upstream-source evidence.
- Local hermetic result: 15 Vitest files / 95 tests passed. This is useful
  regression evidence, not a release gate by itself.
- A clean `npm view dshelm` returns 404 today. The README's `npx dshelm ...`
  path is therefore not currently a published-package journey.

The feature branch is thematically coherent: auth ownership, model knowledge,
resolver/routing, DSH composition, CLI, and their docs form one vertical
distribution slice. Keep one PR for this stage. Splitting it would leave main
with partially exposed contracts (for example an auth registry without the
CLI/profile path) and would not reduce the two P0 risks below.

### DSH upstream facts (re-verified)

- Reference checkout: `/home/altair/projects/agent-harness-lab/deepseek-harness`.
- Remote `master` and tag `dsh-v0.1.0-rc.7`: `99f6f02fecdb7dff40c3fbc9470f5907c29f74ca`.
- The checkout has pre-existing dirty changes in
  `packages/interaction/user-approval/{src/index.ts,tests/approval.spec.ts}`
  and `packages/shell/tool-bash-persistent/src/index.ts`; do not modify or
  revert them.
- rc.7's official profile contract is `$DSH_HOME/profiles/<name>/package.json`
  with `dsh.profile.bundles`. In-box bundles resolve from the DSH installation;
  out-of-tree bundles are installed with
  `dsh plugin --profile <name> add <package>` (or the corresponding profile
  install command). `dsh --profile <name>` does not discover arbitrary
  project-local `.dshelm/*` directories.
- rc.7's loader supports `--dump-config`, resolves profile bundle patch layers,
  and boots the same composed tree that dump-config renders.
- Product-source references used for the auth audit: OpenAI Codex `main`
  `0acf302db5ffedea4b8ef0112f4cbcddd65cff57`, Claude Code `main`
  `354757e5b2d9aa1ebb62e5d05ecd384f0e11c0f7`, Gemini CLI `main`
  `24cc26ccb15522b55c4f8a63b2f894fb99b8e82a`, and Qwen Code `main`
  `179c8f80fd14da7e76b370ee58db1a733f9e21ae`. Registry versions observed at
  audit time were Codex `0.147.0`, Claude Code `2.1.234`, Gemini CLI `0.55.1`,
  and Qwen Code `0.21.13`; these are evidence snapshots, not automatic
  compatibility claims.

### Existing capabilities confirmed

The branch already contains the following and they must be preserved rather
than rewritten:

- `@dshelm/auth` with `CredentialRef`, ownership-neutral status vocabulary,
  `api-key`, `library-oauth`, `native-product`, `device-code`, and `gateway`
  contract kinds; pi-ai OAuth uses public `Models.checkAuth/login/logout`.
- `FileCredentialStore` uses a user-level platform config path, atomic writes,
  restrictive file/parent modes, and cross-process provider locks.
- `@dshelm/model-knowledge` has runtime/official/community/empirical evidence,
  hard capabilities, soft capabilities, adaptation hints, staleness, and
  explain output. `@dshelm/dsh` overlays data-only knowledge into the live
  resolver without importing provider SDKs into Core.
- Core resolver hard-filters auth/capability requirements, scores evidence,
  applies explicit policy last, and emits Resolution Trace v2.
- CLI commands exist for `auth`, `models`, `knowledge`, `explain`, `init`,
  `uninstall`, `doctor`, and `migrate omo`; login is explicit.
- OmO migration is intent-preserving and never migrates credentials.
- DeepSeek credentialed testing is gated to Asia/Shanghai 02:00-08:00 and must
  remain opt-in; this audit was outside the window and sent no request.

## 2. Audit Findings and Priority

### P0 - required before merge

#### P0.1 Credential cold-start lock failure

**Finding.** `packages/auth/src/pi-ai-store.ts` calls
`acquireFileLock(<credential-path>.<provider>.lock)` before `save()` creates the
credential parent directory. With a brand-new `$XDG_CONFIG_HOME` or
`DSHELM_CONFIG_DIR`, first `modify()`/OAuth login fails with `ENOENT`. The
failure was reproduced against the built package with a nested, absent parent;
the existing tests create their temporary parent first.

**Execute.** In `FileCredentialStore.withProviderLock()` (or a small private
helper in the same file), create the credential directory recursively with
mode `0700` and chmod it to `0700` before acquiring the lock. Keep the existing
atomic save and lock-release behavior. Do not move credentials into a project
directory or add OS-keychain scope here.

**Files.** `packages/auth/src/pi-ai-store.ts` and
`packages/auth/tests/auth.test.ts` only, plus generated build output if the
repository's normal build produces it.

**Acceptance.** Add a regression test whose credential path has a non-existent
parent and whose first `modify()` succeeds; assert directory mode `0700`,
credential file mode `0600`, lock cleanup, and a subsequent `read()` result.
Retain concurrent modify/delete and redaction tests. Run the auth test file,
full Vitest suite, typecheck, and build.

#### P0.2 Real DSH profile installation and boot

**Finding.** Current `dshelm init` writes
`<project>/.dshelm/dsh-profile/package.json`. In an isolated HOME, rc.7
`dsh --profile dshelm --dump-config` reports `profile "dshelm" does not
exist`; the generated directory is outside the official profile search path.
The current CI check only tests that two project-local files exist.

**Execute.** Refactor the CLI init path so the DSH profile is named `dshelm`
and lives at `$DSH_HOME/profiles/dshelm`, where `$DSH_HOME` follows the DSH
precedence (`DSH_HOME`, then the platform default `~/.dsh`). Preserve the
project `.dshelm/profile.json` as DSHelm discovery metadata if desired, but do
not call it a DSH profile. The generated profile manifest must list
`@deepseek-ai/dsh-base` and the version-matched `@dshelm/dsh` bundle, create
the profile patch file expected by rc.7, and install the out-of-tree bundle via
the official `dsh plugin --profile dshelm add/install` path. Use an injectable
command/installer seam in tests so a packed local `@dshelm/dsh` tarball can
stand in for a registry package; the production default must use the public
package spec and fail with an actionable message if installation fails. Keep
init idempotent and never start login implicitly.

**Files.** `packages/cli/src/user-commands.ts`,
`packages/cli/src/command-handlers.ts`, `packages/cli/src/index.ts` (only for
context/env and command wiring), `packages/cli/tests/user-commands.test.ts`,
`scripts/qa-dsh-host.sh`, `.github/workflows/ci.yml`, `README.md`, and
`README.zh-CN.md`.

**Acceptance.** In a clean temporary `HOME`, `DSH_HOME`, config directory, and
project: install/pack the CLI and local DSHelm bundles, run `dshelm init --yes`,
assert `$DSH_HOME/profiles/dshelm/package.json` and installed bundle contents,
run `dsh --profile dshelm --dump-config` and verify the `@dshelm/dsh` row,
then run `dsh --profile dshelm` under a bounded timeout and accept only the
expected long-lived boot (or a clearly documented TTY limitation, never a
loader/profile error). Run `dshelm doctor`, `dshelm explain`, and
`dshelm uninstall --yes`; verify the project metadata and DSH profile are
removed, DSHelm credentials are preserved unless `--purge-credentials` is
explicit, and unrelated `$DSH_HOME` files remain. Repeat init to prove
idempotency. This journey must replace the current file-existence-only CI
assertions.

`REQUIRES_SOL_REVIEW`: the final profile installation ownership boundary and
whether the public package spec can be resolved in the release channel must be
approved before merge. `ESCALATE_TO_TERRA_HIGH` if the executor cannot make the
official installer and packed-fixture journey agree without adding an
unreviewed package-manager abstraction.

#### P0.3 Truthful native-product auth descriptors

**Finding.** The current descriptor table in
`packages/cli/src/auth-discovery.ts` assumes `auth login/logout` shell
subcommands for Codex, Claude, Gemini, and Qwen. Current upstream evidence says:

- Codex has documented top-level `codex login/logout`; its richer, versioned
  app-server seam is `account/read`, `account/login/start`,
  `account/login/cancel`, and `account/logout`.
- Claude Code currently documents `claude auth login/status/logout`.
- Gemini CLI exposes an interactive `/auth` (and sign-in flow launched by
  `gemini`); there is no verified shell-level `gemini auth login/logout`.
- Qwen Code explicitly removed the legacy `qwen auth` CLI and directs users to
  interactive `/auth`; its daemon/SDK HTTP auth APIs are not the current shell
  contract.
- No stable public shell/app-server seam was verified for a native Grok/xAI
  product. pi-ai's provider-owned OAuth is a separate, supported plane.

**Execute.** Remove or downgrade Gemini and Qwen native shell descriptors to
`unsupported`/`unknown` with an explanatory detail and no executable login or
logout command. Keep Codex and Claude only behind verified descriptors. Do not
add Grok native commands. Add fixture tests asserting unsupported commands are
never invoked and unknown status is not converted to authenticated.

**Files.** `packages/cli/src/auth-discovery.ts`,
`packages/auth/src/contracts.ts`, `packages/auth/src/adapters.ts`,
`packages/auth/tests/auth.test.ts`, `packages/cli/tests/user-commands.test.ts`,
and the bilingual README/compatibility or source-ledger entries that mention
these products.

#### P0.4 Make descriptor compatibility genuinely version-gated

**Execute.** Replace the current descriptive `versionRange: "... current"`
  convention with a small, explicit compatibility gate. A descriptor must
  provide: a version probe command/parser, the verified version range or exact
  allow-list, and the source/verification timestamp. The adapter must capture
  the detected version before status/login/logout; unknown or unparsable
  versions must return `unknown`/`unsupported` and must not execute a
  version-sensitive login/logout command. A detected version outside the
  verified range must follow the same conservative fallback. Keep the system
  intentionally small; do not invent a general plugin marketplace semver
  engine. Record the observed version in diagnostics without secrets.

**Files.** `packages/auth/src/contracts.ts`,
`packages/auth/src/adapters.ts`, `packages/cli/src/auth-discovery.ts`, and
their fixture tests.

**Acceptance.** Fixtures cover verified Codex/Claude versions, unknown output,
older/newer versions, a missing status surface, and a runner spy proving no
login/logout command is called for an incompatible descriptor. The status
result must distinguish `unknown` from `action-required` and `unsupported`.

`REQUIRES_SOL_REVIEW`: approve the minimal version representation and fallback
semantics before implementation if the executor proposes a materially
different public contract.

### P1 - required in the next execution stage, but independently reviewable

#### P1.1 Evidence integrity and calibrated model knowledge

**Finding.** The schema checks that a referenced evidence id exists, but does
not check that a soft claim's `claimType` matches the capability it is used to
support, nor that its value/derivation is appropriate. The baseline currently
uses mismatches such as `planning` supported by an `agenticCoding` claim,
`fanOutSuitability` supported by a tool-reliability or pricing claim, and
`review` supported by a broad long-horizon claim. This is not evidence integrity
even when Zod validation passes.

**Execute.** Decide and document a conservative rule: a soft capability may
  reference only same-type evidence or an explicitly declared derivation with
  named inputs; heuristic scores must carry a low-confidence/heuristic marker
  and never imply runtime truth. Keep the four evidence layers distinct:
  runtime truth, official static capability, community directional evidence,
  and empirical DSHelm evaluation. Add derivation metadata only if needed to
  explain a score; do not add a global leaderboard. Correct or remove baseline
  claims that cannot meet the rule, especially planning/review/fan-out. Keep
  `runtimeReady` exact and false when no real runtime probe occurred.

**Files.** `packages/model-knowledge/src/contracts.ts`,
`packages/model-knowledge/src/baseline.ts`,
`packages/model-knowledge/src/knowledge.ts`,
`packages/model-knowledge/tests/knowledge.test.ts`, `packages/dsh/src/knowledge.ts`,
`compatibility.json`, and bilingual model/evidence documentation.

**Acceptance.** Tests reject mismatched claim references, missing derivations,
out-of-range confidence/score, and stale evidence as appropriate; an explain
output identifies layer, claim type, confidence, and derivation/heuristic
status. A fixture demonstrates that soft evidence cannot bypass a hard runtime
failure. Do not claim `model x harness x task family x version` support until
the schema actually carries those dimensions; otherwise label the baseline
model-global and harness-conditional.

`ESCALATE_TO_TERRA_HIGH` for schema changes that require migration of the
public bundle format. `REQUIRES_SOL_REVIEW` for changing routing semantics or
introducing a new score derivation language.

#### P1.2 Honest public positioning and bilingual synchronization

**Finding.** README currently claims `npx dshelm` installation, subscription
discovery, local-runtime discovery, a built execution topology, and
harness-aware soft scores. The package is not published (`npm view dshelm`
returns 404), init's topology currently repeats authenticated resources across
all lanes, and knowledge is model-global rather than keyed by harness/task/
version. These claims exceed executable evidence.

**Execute.** Update `README.md`, `README.zh-CN.md`, `compatibility.json`, and
the relevant ecosystem/decision docs together. Keep the vision explicit, but
label current behavior precisely: keyless/fixture discovery, provider/product
status limits, DSH profile installation status, explainable resolver traces,
and known product-managed observability. Replace or qualify “one command
install”, “discovers subscriptions”, “builds topology”, and “composes
AgentTeams” unless the P0 journey proves them. Every English change must have a
Simplified Chinese counterpart in the same commit.

**Acceptance.** A fresh reader can distinguish `verified now`, `manual opt-in`,
`research`, and `deferred`; no public sentence promises a command or provider
seam that the tests and upstream ledger do not prove. `npx dshelm` may only be
shown as a release-channel command after package publication is verified; the
local development path must be executable.

#### P1.3 CI and journey coverage

**Execute.** Keep ordinary CI keyless. Add a deterministic clean-HOME/profile
  job that uses packed local artifacts and the real rc.7 `dsh` binary for
  `init -> profile install -> dump-config -> bounded boot -> doctor -> explain
  -> uninstall`. Make the upstream source lane either run with an explicit
  `DSH_REFERENCE_DIR` fixture or clearly report why it is unavailable; never
  count a skipped lane as contract verification. Add assertions for secret
  redaction, unknown product versions, unsupported auth commands, credential
  modes, and preservation of unrelated user DSH files.

**Files.** `.github/workflows/ci.yml`, `scripts/qa-dsh-host.sh`, a focused
`scripts/qa-clean-install.sh` if needed, and the affected package fixtures.

**Acceptance.** CI reports the real journey separately from hermetic unit
tests. The journey is reproducible locally with temporary HOME/DSH_HOME and
does not contact `api.deepseek.com`. The live DeepSeek lane remains gated and
reports `SKIPPED` outside the allowed window.

#### P1.4 Product-auth research ledger

Record source URLs, repository SHAs, observed commands/seams, and disposition:
Codex app-server account APIs (candidate future adapter), Claude CLI (current
candidate), Gemini slash/TUI auth (unsupported shell descriptor), Qwen slash or
daemon/SDK auth (research only), and xAI/Grok (no verified native seam; use
pi-ai provider-owned OAuth when available). Keep this ledger bilingual when it
is user-facing. Do not ship speculative commands.

### P2 / explicitly deferred after v0.3 merge

- AgentTeams rc.7 heterogeneous effective-route and request/header verification.
  It must not be labeled VERIFIED until each member's effective model is
  observed in a real request.
- Real browser OAuth login in ordinary CI. Keep manual opt-in E2E only.
- OS keychain credential backend. Current `0700` directory / `0600` file
  boundary and ownership documentation remain the v0.3 guarantee.
- Full Web control plane, subscription billing/account scraping, and broad
  model benchmark programs.
- DeepSeek live benchmark. Only the existing Asia/Shanghai 02:00-08:00 gate
  with explicit confirmation may send a request.
- A model-global leaderboard or invented `model x harness x task` scores. Add
  those dimensions only with real evidence and an intentional schema revision.

## 3. Plan -> Execute -> Verify

### Plan (this Sol/High context)

- Freeze the facts and priorities in this document.
- Preserve Plan/Execute separation: no product implementation is part of this
  stage.
- Resolve the profile ownership/install boundary and the descriptor compatibility
  contract before Terra starts.

### Execute (Terra/Medium default)

1. Implement P0.1 and its regression test; run auth tests, then full hermetic
   tests/typecheck/build.
2. Implement P0.3/P0.4 descriptor truth and version gate with fixture runners;
   update the research ledger.
3. Implement P0.2 official DSH profile installation and replace file-only CI
   checks with the real clean journey.
4. Implement P1.1 evidence calibration and update both language docs in the
   same commits.
5. Implement P1.2/P1.3 documentation and CI claim alignment.

Do not touch DSH upstream files, AgentTeams routing, OS keychain, live OAuth,
or DeepSeek network behavior in this execution stage. Mechanical doc sync,
fixtures, grep-based checks, and version updates stay Terra/Medium. Mark a
task `ESCALATE_TO_TERRA_HIGH` if its public schema or package-manager seam is
not mechanically determined by this contract; stop and request
`REQUIRES_SOL_REVIEW` for credential ownership, security boundaries, or an
upstream contract change.

### Verify (fresh Sol/High context, not the executor)

The verifier must start from a fresh context and independently attack:

- absent credential parents, lock races, file/dir modes, token leakage in
  errors/traces/profiles, and uninstall preservation of unrelated config;
- unknown/new product versions, missing status, and unsupported Gemini/Qwen
  shell commands (prove no command was executed);
- `$DSH_HOME/profiles/dshelm` resolution, bundle installation, real rc.7
  `dump-config`, and bounded boot in a clean HOME;
- evidence claim-type/value/derivation integrity, stale evidence, and soft
  scores overriding hard failures;
- README claims versus executable tests and the bilingual source ledger;
- CI jobs that are skipped or only test generated files.

The verifier must run the full test suite, typecheck, build, clean-install
journey, and relevant upstream-source checks. A green “95 tests” count alone
is insufficient. The verifier writes a review result with `GO` or `NO-GO` and
lists residual risks; the Terra executor's self-assessment is not evidence.

## 4. Acceptance and Merge Gate

The v0.3 PR may open/merge only when all are true:

1. P0.1-P0.4 are implemented and covered by focused regression fixtures.
2. The clean journey proves `init -> actual DSH profile -> install ->
   dump-config -> boot -> doctor/explain -> uninstall` with clean HOME and no
   credential leakage.
3. README, README.zh-CN, compatibility, and any public evidence ledger make no
   claim beyond the verified journey; English and Simplified Chinese changes
   are synchronized.
4. GitHub Actions is green for unit/property/typecheck/build/dsh-contract,
   auth-knowledge-cli, pack-install, and the new clean journey. A skipped
   upstream lane is explicitly reported as skipped, never treated as proof.
5. The fresh Sol/High verifier returns `GO`, with no unresolved
   `REQUIRES_SOL_REVIEW` item.
6. The live DeepSeek gate is either a permitted, explicitly confirmed
   `VERIFIED` run or a policy-compliant `SKIPPED`; it never sends a request
   outside the window.

Residual P2 work is recorded as deferred and must not be smuggled into the
merge claim. DSHelm remains a resource discovery, evidence, routing, and DSH
composition layer; it must not become a second task runtime or a static
Codex/Claude launcher.

## 5. Execution Log (2026-08-18)

- Completed P0.1: cold-start credential directory creation and regression test;
  directory/file modes remain `0700`/`0600`.
- Completed P0.3/P0.4: Codex and Claude native descriptors are version-gated;
  Gemini and Qwen shell auth is unsupported; unknown/out-of-range versions do
  not execute login/logout commands.
- Completed P0.2: `init` installs `$DSH_HOME/profiles/dshelm` through the
  official plugin path. `scripts/qa-clean-install.sh` verified packed local
  bundles, rc.7 `dump-config`, bounded boot, doctor/explain, idempotent init,
  uninstall, and preservation of unrelated DSH files in a clean HOME.
- Completed P1.1: soft claims require matching evidence claim types unless an
  explicit derivation is declared; baseline unsupported planning/review/fan-out
  claims were removed; hard claim values are checked against evidence; static
  hard context/local fields are not projected into exact runtime; explain
  output includes claim type, layer, confidence, and score basis.
- Completed verifier follow-up fixes: purge removes both the DSHelm store and
  legacy project credential file; the clean journey proves preserve-unless-purge
  and rejects DSH loader errors for either bounded timeout or clean non-TTY exit.
- Completed P1.2/P1.4 documentation alignment: README files, compatibility,
  and the bilingual product-auth source ledger now distinguish verified,
  unsupported, manual/research, and deferred behavior. The npm package remains
  unpublished, so README uses the verified source-checkout installation path.
- Remaining before merge: run the full suite and CI-equivalent checks, inspect
  the final diff for unrelated changes, and obtain GitHub Actions success for
  the pushed commit. The fresh Sol/High Verify gate returned `GO`; do not treat
  the executor's self-assessment as that review result.
