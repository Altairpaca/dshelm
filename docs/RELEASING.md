# DSHelm release process

This document defines the maintainer release contract while DSHelm is in alpha. The first public npm release is tracked in [issue #7](https://github.com/Altairpaca/dshelm/issues/7).

## Release model

[`release-packages.json`](../release-packages.json) is the machine-readable source of truth for the publishable package set and dependency-safe publish order. The workspace currently publishes six packages in lockstep. `pnpm package:check` verifies graph membership, package versions, and dependency order; any future workspace omitted from the release graph must be explicitly `private: true`, and a publishable package may not depend on an unpublished internal workspace.

Until the first public alpha is proven end-to-end, releases remain a deliberate maintainer operation. Do not add automatic registry publication merely to reduce the number of commands; automation should encode a verified process, not define one.

## 1. Pre-release gate

Before changing a tag or publishing a tarball:

- the intended commit is on `main` and required CI is green;
- `package.json` and every publishable package use the same version;
- [`release-packages.json`](../release-packages.json) matches the intended public workspace graph;
- [`compatibility.json`](../compatibility.json) records the DSH version used for verification;
- user-facing behavior and limitations are reflected in the READMEs and [`CHANGELOG.md`](../CHANGELOG.md);
- security-sensitive logs and install evidence are redacted;
- the release scope has no unresolved blocker in the release Issue.

Run:

```bash
pnpm install --frozen-lockfile
pnpm package:check
pnpm docs:check
pnpm typecheck
pnpm test
pnpm qa:pack-install
```

`qa:pack-install` builds the workspace, packs the exact release graph, installs every tarball into a fresh project, verifies package exports and the CLI entry point, then runs the isolated HOME/DSH_HOME init → doctor/explain → uninstall journey.

## 2. Versioning

During alpha, increment the prerelease identifier for public registry releases, for example `0.3.0-alpha.1` → `0.3.0-alpha.2`. Update the root workspace and all publishable package manifests together. The package metadata gate will fail if any package drifts from the root version.

A source milestone does not become a public release merely because its manifest contains a version. Public release status requires registry artifacts plus a GitHub prerelease and clean-install evidence.

## 3. Pack once

Pack exactly the artifacts exercised by CI:

```bash
pnpm build
pnpm release:pack -- /tmp/dshelm-release
```

The packer reads [`release-packages.json`](../release-packages.json), writes the versioned tarballs, and records their absolute paths and versions in `/tmp/dshelm-release/pack-manifest.json`. Treat those tarballs as the release candidate artifacts; do not repack between inspection, verification, and publication.

Inspect the tarball contents and packed manifests before publication. In particular, confirm that internal `workspace:*` dependencies have been rewritten to publishable version ranges and that no source secrets, private fixtures, local paths, or unrelated build artifacts are present.

## 4. Publish in dependency order

Authenticate to npm using the maintainer-owned release account and publish the exact tarballs recorded by `pack-manifest.json`. For alpha releases, use the `alpha` dist-tag rather than `latest`.

The order of the `packages` array in [`release-packages.json`](../release-packages.json) is the publication order. `pnpm package:check` rejects an internal dependency that appears after its dependent package.

Use `npm publish <tarball> --access public --tag alpha` for each manifest entry. Stop immediately if any package fails; do not continue to publish dependents against a missing dependency.

## 5. Verify the public registry, not the workspace

After all artifacts exist on npm, test from a clean HOME / clean project with no workspace links. Record exact Node, pnpm/npm, DSH, DSHelm, OS, and architecture versions.

The public-alpha acceptance path must include:

- installation through the documented public entry point;
- profile discovery and `dsh --profile dshelm --dump-config`;
- `dshelm doctor`;
- one `dshelm explain ...` routing result;
- uninstall;
- proof that unrelated profiles and product-owned credentials remain intact.

Attach the redacted transcript to [issue #7](https://github.com/Altairpaca/dshelm/issues/7).

## 6. Git tag and GitHub prerelease

Create the Git tag and GitHub prerelease only after the npm artifacts and clean-install path are verified. Release notes should include:

- install / upgrade command;
- supported DSH version;
- notable changes from [`CHANGELOG.md`](../CHANGELOG.md);
- known limitations and deferred work;
- uninstall instructions;
- links to the verification evidence.

Mark alpha releases as prereleases. Do not move the npm `latest` dist-tag during alpha.

## 7. Broken alpha handling

If an alpha is broken after publication:

- stop recommending the affected version immediately;
- open a release-blocker Issue with the failure and affected platforms;
- publish a corrected prerelease instead of rewriting Git history;
- move the `alpha` dist-tag to the corrected version only after verification;
- document the broken version in the changelog/release notes.

## When to automate further

Introduce Changesets or equivalent release automation after at least one manual public alpha has passed this process and package boundaries have proven stable. At that point automation should handle version bumps, changelog assembly, and publication while preserving the same release graph, CI, artifact, and clean-install evidence gates.
