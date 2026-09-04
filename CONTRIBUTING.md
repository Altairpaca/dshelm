# Contributing to DSHelm / 参与 DSHelm

DSHelm is an alpha-stage, DSH-native multi-model routing project. Contributions are welcome in English or Simplified Chinese. The most useful contributions today are reproducible installation evidence, routing scenarios, compatibility verification, focused bug fixes, tests, and small end-to-end improvements.

Before contributing, read [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md), [`SUPPORT.md`](SUPPORT.md), and the architecture boundary in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Start here

| What you have | Best entry point |
| --- | --- |
| Reproducible bug | [Bug report](https://github.com/Altairpaca/dshelm/issues/new?template=bug_report.yml) |
| Installation / platform evidence | [Install report](https://github.com/Altairpaca/dshelm/issues/new?template=install_report.yml) |
| Real routing scenario | [Routing scenario](https://github.com/Altairpaca/dshelm/issues/new?template=routing_scenario.yml) |
| Feature proposal | [Feature request](https://github.com/Altairpaca/dshelm/issues/new?template=feature_request.yml) |
| Provider integration / ecosystem proposal | Read the [provider integration policy](docs/provider-integrations.md), then open a focused Issue |
| Question or early design idea | [DSHelm Discussions](https://github.com/Altairpaca/dshelm/discussions) |
| DSH public-interface/runtime question | [DeepSeek Harness Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions) |

Current public work is tracked in Issues, especially [#7](https://github.com/Altairpaca/dshelm/issues/7), [#8](https://github.com/Altairpaca/dshelm/issues/8), [#9](https://github.com/Altairpaca/dshelm/issues/9), [#10](https://github.com/Altairpaca/dshelm/issues/10), and the provider-integration contract in [#22](https://github.com/Altairpaca/dshelm/issues/22).

## Align scope before coding

Open or join an Issue before implementing any change that introduces or materially changes:

- Core abstractions or public policy semantics;
- configuration schema or precedence;
- runtime dependencies or DSH integration contracts;
- provider/authentication behavior;
- compatibility or migration behavior;
- substantial UI or workflow behavior.

Provider proposals must also preserve the provider-neutral defaults, evidence boundary, credential ownership, and tracking/privacy requirements in [`docs/provider-integrations.md`](docs/provider-integrations.md). Commercial, referral, or cross-promotion terms do not count as technical compatibility evidence.

Documentation fixes, tests, typo fixes, narrowly scoped refactors, and obvious small bug fixes may be submitted directly as a PR. When uncertain, discuss first: early scope alignment is cheaper than reviewing a large PR that does not fit the project boundary.

Do not claim an Issue simply by opening a large implementation PR. For community tasks, comment with a short implementation plan and wait for scope alignment when the Issue already has an owner or requires design decisions.

## Design and evidence principles

- Compose DSH public extension surfaces and mature plugins instead of duplicating the runtime.
- Keep Core limited to policy, configuration, routing, and Resolution Trace; Core must not depend on DSH packages.
- Routing decisions must remain deterministic, serializable, and explainable.
- Explicit user, project, and request configuration takes precedence over default recommendations.
- Lossy migration, unknown states, and unverified capabilities must be visible rather than silently inferred.
- Model capability metadata and compatibility claims require a source or reproducible runtime evidence.
- Do not copy third-party code or assets without a compatible license.
- Never commit credentials, tokens, cookies, private account data, or unredacted personal paths to Issues, tests, screenshots, traces, or fixtures.

The detailed project contract is documented in [`AGENTS.md`](AGENTS.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Development setup

Requirements: Node.js `>=22.19.0`, pnpm `11.7.0`, TypeScript/ESM, and a compatible DSH CLI when exercising the DSH integration.

```bash
pnpm install --frozen-lockfile
pnpm docs:check
pnpm typecheck
pnpm test
pnpm build
pnpm run qa:web-renderer -- --profile dshelm-community --url http://127.0.0.1:19876
```

`qa:web-renderer` is an isolated browser-render check. Real DSH profile/bundle installation is covered by the clean-install CI lane. UI changes should include evidence for both desktop and narrow-screen layouts.

## Pull request standard

A reviewable PR should answer four questions:

1. **Problem** — what user, contributor, compatibility, or maintenance problem exists?
2. **Change** — what is the smallest change that addresses it?
3. **Evidence** — which tests, runtime checks, screenshots, traces, or source references demonstrate the behavior?
4. **Impact** — does it change routing semantics, compatibility, configuration, migration, authentication, or public documentation?

For non-trivial work, link the Issue in the PR body with `Closes #...`, `Fixes #...`, or `Refs #...` as appropriate. Keep unrelated refactors out of feature/fix PRs.

Before requesting review:

- add or update a failing test before changing resolver/adapter behavior when practical;
- validate DSH APIs against the repository's pinned/verified version rather than memory;
- update user-visible documentation and compatibility data when behavior changes;
- attach reproducible evidence for user-facing behavior;
- ensure `pnpm docs:check`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass for relevant changes.

Use short Conventional Commit-style titles such as `fix(cli): ...`, `feat(core): ...`, `docs: ...`, `test(dsh): ...`, or `chore: ...`.

## Review and maintenance expectations

DSHelm is maintained on a best-effort basis and does not promise a response SLA. Maintainers may ask for a smaller scope, additional evidence, or upstream DSH discussion before accepting a change. A technically correct implementation may still be declined when it expands the project beyond its documented responsibility or creates an unsupported maintenance burden.

## License

Unless explicitly stated otherwise, contributions are submitted under Apache License 2.0 in accordance with Section 5 of the license.
