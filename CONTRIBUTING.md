# Contributing to DSHelm

DSHelm is currently pre-alpha. Contributions are welcome, but the highest-value work right now is often architectural: clarifying policy semantics, validating DeepSeek Harness integration boundaries, composing ecosystem capabilities, and producing small end-to-end proofs rather than adding a large surface area.

## Before opening a large PR

Please open an issue first for changes that introduce a new core abstraction, configuration schema, runtime dependency, or compatibility layer. Early discussion is useful because the public API is intentionally not frozen yet.

Small documentation fixes, tests, typo corrections, and narrowly scoped implementation improvements do not need prior discussion.

## Design expectations

Contributions should generally follow these rules:

- prefer public DSH extension surfaces and mature ecosystem plugins over reimplementation;
- keep policy resolution deterministic and inspectable;
- avoid rebuilding runtime functionality that DSH or an ecosystem plugin already provides well;
- make lossy compatibility/import behavior explicit;
- keep provider/model-specific behavior outside the generic core when possible;
- add tests for resolution precedence and configuration migration behavior;
- never depend on external checkout paths in default tests (hermetic lane only);
- do not copy third-party code unless its license permits the reuse and all attribution/notice requirements are satisfied.

## Development workflow

The bootstrap toolchain is Node `>=22.19`, pnpm `11.7.0`, strict TypeScript,
and ESM. Work in an isolated worktree; do not develop in the main worktree.

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm run qa:web-renderer -- --profile dshelm-v01 --url http://127.0.0.1:19876
```

`qa:web-renderer` is the standalone renderer smoke only. Real DSH Web
integration (fresh DSH profile + real bundle + native slot) is exercised by
`qa:dsh-web`.

For changes:

1. keep each change narrowly scoped and preserve the core/DSH boundary;
2. write a failing behavior test before changing resolver or adapter behavior;
3. verify DSH APIs against the pinned reference checkout, never by memory;
4. update architecture/docs when a public design decision changes;
5. record real-surface evidence for install, execution, or browser behavior;
6. use a focused conventional commit after the increment is green.

## Commit and PR style

Short conventional-style commit messages are preferred, for example:

```text
feat: add deterministic model profile resolution
fix: preserve category override precedence
docs: define DSH adapter boundary
```

A pull request should explain:

- what changed;
- why it belongs in DSHelm rather than the underlying runtime;
- how it was validated;
- whether it changes policy resolution or compatibility behavior.

## Licensing

By contributing to DSHelm, you agree that your contribution will be licensed under the repository's Apache License 2.0, consistent with Section 5 of that license unless you explicitly state otherwise.
