# DSHelm Community Roadmap

Updated: 2026-09-10

This roadmap tracks outcomes users can verify. Merged code, test counts, README copy, and architectural completeness are engineering evidence, but they do not automatically mean that a community release is usable or adopted.

## Product direction

DSHelm no longer treats "supporting multiple models" as the primary differentiator. The DeepSeek Harness ecosystem can already distribute models through Agent/Subagent configuration, provider plugins, and call-site `agentOptions`. The scarcer infrastructure is visibility into runtime truth and compatibility truth.

The product thesis is:

> **Effective Route Truth + Compatibility + Explainability**

DSHelm should answer two practical questions:

1. **Which provider / model / reasoning effort actually executed this task?**
2. **Which compatibility layers have actually been verified for this DSH/plugin combination?**

For routing, distinguish:

`requested → resolved → effective`

`effective` must come from runtime request/session evidence, not from Root Agent UI state, inheritance assumptions, or a pre-execution policy object.

For compatibility, distinguish:

`source/API → package graph → packed install → clean profile → session lifecycle → web client → runtime journey`

A PASS at one layer never implies full compatibility.

## Why this direction now

Current DSH community discussions independently expose the same problems DSHelm is designed to make observable:

- SubAgent routes may differ from Root/displayed routes with real cost consequences: <https://github.com/deepseek-ai/deepseek-harness/discussions/5973>
- DSHelm and other third-party plugin authors independently use actual `request/header` / session request records to verify effective routes: <https://github.com/deepseek-ai/deepseek-harness/discussions/2053>
- Plugin migrations repeatedly show that green typechecks/tests do not prove a new DSH cohort will boot and behave correctly; validation spans package, Cordis, Host/Client, Slot, runtime, and distribution surfaces: <https://github.com/deepseek-ai/deepseek-harness/discussions/5120>

DSHelm should therefore solve these infrastructure problems rather than compete on plugin count or duplicate a general-purpose migration bot.

## Current engineering state

As of 2026-09-10:

- the verified DSH baseline remains `0.1.0-rc.7`;
- the forward candidate is `0.1.5-rc.1`;
- major source-level Session, Agent/Subagent, and Web-panel compatibility bridges are in place;
- current DeepSeek V4/V4.1 and pi-ai 0.85.1 provenance has been refreshed;
- #45 provides an isolated candidate-source CI lane so candidate qualification does not rewrite the verified baseline first;
- the candidate lane is not yet passing, so DSHelm must not claim verified `0.1.5-rc.1` support.

Qualification evidence lives in #34/#45.

## P0-A: qualify the current DSH candidate

Goal: turn compatibility from "we think it compiles" into machine-tracked, layered evidence.

- [x] Establish the `compatibility-candidates.json` / `compatibility-evidence.json` promotion contract.
- [x] Adapt the major 0.1.5 source/API seams.
- [x] Add an isolated candidate-source lane without changing the verified manifest first.
- [ ] Repair and pass the #45 candidate package/source graph.
- [ ] Record a coherent 0.1.5 package cohort with no mixed prerelease graph.
- [ ] Run workspace typecheck/build/tests against the candidate graph.
- [ ] Fresh pack/install all DSHelm release artifacts.
- [ ] In isolated HOME/DSH_HOME, complete init → boot → doctor → explain → first-run → uninstall.
- [ ] Verify Session V3 lifecycle/persistence.
- [ ] Verify current Web client discovery/materialization of `@dshelm/dsh/client`.
- [ ] Move `compatibility.json.tested` only after every required check passes.

Owners: #34, #45.

## P0-B: make Effective Route Inspector the first strong product proof

Goal: users should see what actually executed instead of trusting configuration or display state.

#46 owns:

- [ ] a stable effective-route observation contract;
- [ ] provider/model/reasoning effort, role/child identity, evidence source, and observation time;
- [ ] requested / resolved / effective layers in Resolution Trace;
- [ ] divergence classes: same route, explicit override, fallback, provider change, model change, reasoning change, unknown;
- [ ] a warning when a child route moves to a higher known cost/model tier;
- [ ] `unknown` when price/tier evidence is missing instead of fabricated cost numbers;
- [ ] historical effective observations that survive reconnect/replay without being re-inferred;
- [ ] a Flash → Pro-style divergence fixture as the canonical 30-second demo.

The first increment observes and warns; it does not automatically block every escalation.

## P0-C: make Compatibility Radar the second strong product proof

Goal: turn DSHelm's strict compatibility maintenance from an internal CI convention into a public interface users and ecosystem tools can consume.

#47 owns the shared projection; #41 `doctor` is a consumer.

- [ ] Export stable JSON from the existing compatibility candidate/evidence contract.
- [ ] Support verified / candidate / blocked / newer-unknown / mixed-cohort states.
- [ ] Show source/API, package graph, packed install, clean profile, Session, Web, and runtime status separately.
- [ ] Make evidence stale/reset explicitly when the candidate changes; never carry an old PASS forward silently.
- [ ] Make `doctor` use the same projection instead of maintaining a second compatibility state machine.
- [ ] Render a compact Compatibility Card for README/releases.
- [ ] Keep the schema consumable by plugin indexes/marketplaces later.

Target presentation:

```text
DSH 0.1.0-rc.7   VERIFIED
DSH 0.1.5-rc.1   CANDIDATE

source/API        PASS
package graph     FAIL|PASS|PENDING
packed install    PASS|PENDING
clean profile     PASS|PENDING
session lifecycle PASS|PENDING
web client        PASS|PENDING
runtime journey   PASS|PENDING
```

## P1: publish an alpha users can reproduce

Before broad launch:

- [ ] #7 publishes a public npm alpha.
- [ ] Install/uninstall is reproducible from a clean HOME.
- [ ] At least one real supported-environment install report exists under #8.
- [ ] #46 has a reproducible requested → resolved → effective demo.
- [ ] #47 accurately shows the verified baseline and current candidate.
- [ ] Credential-free resolver and real DSH execution fixtures remain green.
- [ ] `doctor` / first-run provides an actionable next command.
- [ ] Release notes name exact DSH versions and limitations instead of saying "0.1.x compatible".

A DSH user who does not know DSHelm's source layout should be able to:

1. install;
2. run `doctor`;
3. run first-run;
4. inspect requested/resolved/effective route truth;
5. inspect the Compatibility Card;
6. uninstall safely.

## P1.5: enter the community through real problems

The first public technical content should consist of two evidence-led artifacts.

### A. Why green TypeScript tests are not enough for a DSH plugin upgrade

Use the real DSHelm `rc.7 → 0.1.5` migration as the case study and cover only reproducible/citable surfaces:

- package cohort;
- Session/Agent/Subagent API drift;
- Cordis inject/service drift;
- Web slot/client materialization;
- hidden browser/host type coupling;
- packed install;
- clean-profile/runtime acceptance.

End with a small validation matrix, not a request for stars. Contribute the evidence back to DSH Discussion #5120 first.

### B. Your root model is not necessarily your subagent model

Publish after #46 has a reproducible demo. Explain:

- requested / resolved / effective route state;
- why root UI and inheritance are not sufficient evidence of actual calls;
- how session/request records provide durable runtime evidence;
- how fallback, explicit override, and silent escalation differ.

Contribute the evidence back to DSH Discussions #5973 / #2053 first.

## Distribution order

Do not broadcast everywhere at once.

1. **Relevant DSH Discussions** — reply only when DSHelm has concrete evidence/fixtures for the problem.
2. **GitHub prerelease + DSHelm Discussion** — canonical install, runtime-truth demo, Compatibility Card, limitations.
3. **DSH plugin indexes / awesome lists / marketplaces** — update after the public package/install path is real.
4. **Technical communities / social channels** — reuse the two technical artifacts rather than publishing a generic project ad.
5. **Provider/partner cross-promotion** — only after independent validation and with commercial relationships separated from technical evidence.

## P2: then expand evidence-conditioned routing policy

Only after #46 can validate whether runtime execution matched policy intent should DSHelm broaden automatic routing decisions.

#31 owns:

- task context;
- budget / latency / risk constraints;
- user/project/request override precedence;
- stale/unknown evidence;
- fallback/escalation policy;
- reconciliation of policy intent with effective runtime observations.

If automatic escalation is allowed, that permission must be explicit in policy. A higher heuristic score alone must not silently select a more expensive model.

## P3: ecosystem health and integrations

- expose compatibility/freshness metadata to indexes and marketplaces;
- keep provider integration optional, provider-neutral, and evidence-backed;
- publish declarative permission/capability metadata for DSHelm-owned surfaces where it can be stated honestly;
- prefer current DSH-native slots/services over long-lived legacy shims;
- commercial/referral relationships must not change capability evidence, routing scores, or defaults without independent technical evidence.

## Next adoption milestone

Do not use a 50/100-star target as the primary success criterion.

The next meaningful milestone is:

- [ ] **3** reproducible non-maintainer install reports;
- [ ] **2** real external routing/use cases or route traces;
- [ ] **1** external contributor PR;
- [ ] **1** external DSH project/index/integration that cites or consumes a DSHelm route/compatibility contract.

Stars, forks, and watchers are secondary awareness metrics. GitHub clones may include CI/indexers and are not adoption evidence by themselves.

## Weekly signals after alpha

Track:

- external install reports and platform coverage;
- `doctor` / first-run failure categories;
- time from reproducible report to fix;
- whether route divergences are correctly explained by DSHelm;
- external issues / PRs / use cases;
- references to Compatibility Radar or Effective Route contracts from other DSH projects;
- npm download trends only alongside evidence of successful first runs/use cases.

## What we will not optimize for

- the largest model/plugin count;
- a duplicate general-purpose DSH migration bot;
- treating green typecheck as runtime compatibility;
- treating the Root Agent display model as effective child route truth;
- converting benchmarks/release notes directly into routing scores;
- broad traffic acquisition before a verified public npm alpha exists;
- presenting DSHelm as an official DeepSeek project;
- geographic/language-priority positioning such as "Chinese-first";
- generic "please star" promotion without a reproducible problem/evidence contribution.

## Related work

- master roadmap: #32
- current DSH qualification: #34, #45
- Effective Route Inspector: #46
- Compatibility Radar: #47
- doctor version-skew diagnostics: #41
- higher-level routing policy: #31
- npm alpha: #7
- platform evidence: #8
- contributor entry: #10
- community launch: #23
