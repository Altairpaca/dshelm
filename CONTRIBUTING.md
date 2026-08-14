# Contributing to DeepHelm

DeepHelm is currently pre-alpha. Contributions are welcome, but the highest-value work right now is often architectural: clarifying policy semantics, validating DeepSeek Harness integration boundaries, and producing small end-to-end proofs rather than adding a large surface area.

## Before opening a large PR

Please open an issue first for changes that introduce a new core abstraction, configuration schema, runtime dependency, or compatibility layer. Early discussion is useful because the public API is intentionally not frozen yet.

Small documentation fixes, tests, typo corrections, and narrowly scoped implementation improvements do not need prior discussion.

## Design expectations

Contributions should generally follow these rules:

- prefer public DSH extension surfaces over patches to DSH core;
- keep policy resolution deterministic and inspectable;
- avoid rebuilding runtime functionality that DSH or an ecosystem plugin already provides well;
- make lossy compatibility/import behavior explicit;
- keep provider/model-specific behavior outside the generic core when possible;
- add tests for resolution precedence and configuration migration behavior;
- do not copy third-party code unless its license permits the reuse and all attribution/notice requirements are satisfied.

## Development workflow

Until the implementation toolchain is committed, the repository intentionally does not prescribe a Node/Bun/package-manager setup.

For now:

1. fork or branch from `main`;
2. keep each change narrowly scoped;
3. include tests when executable code is introduced;
4. update architecture/docs when a public design decision changes;
5. open a pull request describing the behavior change and the DSH capability it relies on.

## Commit and PR style

Short conventional-style commit messages are preferred, for example:

```text
feat: add deterministic model profile resolution
fix: preserve category override precedence
docs: define DSH adapter boundary
```

A pull request should explain:

- what changed;
- why it belongs in DeepHelm rather than the underlying runtime;
- how it was validated;
- whether it changes policy resolution or compatibility behavior.

## Licensing

By contributing to DeepHelm, you agree that your contribution will be licensed under the repository's Apache License 2.0, consistent with Section 5 of that license unless you explicitly state otherwise.
