# Releasing DSHelm to npm

DSHelm publishes one versioned release set from `release-packages.json`. The package order is part of the release contract because later packages depend on earlier `@dshelm/*` packages.

## Release set

For `0.3.0-alpha.0`, the ordered set is:

1. `@dshelm/core`
2. `@dshelm/model-knowledge`
3. `@dshelm/auth`
4. `@dshelm/compat-omo`
5. `@dshelm/dsh`
6. `dshelm`

All packages must use the workspace version and pass `pnpm package:check` before packing. Alpha releases use the npm dist-tag `alpha`; they must not move `latest`.

## Security model

Use `.github/workflows/release-npm.yml` for releases. It is manual and defaults to `dry-run`.

- `dry-run` performs the full workspace/package gates, packs the atomic release set, and runs `npm publish --dry-run` for package versions that are not already present.
- `publish` is accepted only when the workflow is run from `main` and `confirm_version` exactly matches the workspace version.
- the workflow has `id-token: write` so existing packages can use npm Trusted Publishing (OIDC) without a long-lived write token.
- the publish driver is resumable: if an earlier package from the same canonical repository/version is already visible, it verifies ownership metadata and continues; an unexpected repository/version fails closed.
- after publishing, the workflow installs `dshelm@<version>` and the verified DSH CLI from the public npm registry into a clean HOME/DSH_HOME and verifies init, doctor, DSH profile composition, uninstall, and preservation of unrelated DSH state.

Release evidence is uploaded as a GitHub Actions artifact.

## First publication bootstrap

npm Trusted Publishing can be configured only after a package already exists in the registry. The first publication therefore has an unavoidable account-side bootstrap step.

Before running `mode=publish` for the first time:

1. confirm the maintainer account can publish the unscoped `dshelm` name and the public `@dshelm/*` scope;
2. enable npm account 2FA;
3. create a short-lived/granular bootstrap publishing credential only if required by the chosen first-publish path, and store it as the repository Actions secret `NPM_TOKEN`;
4. run `npm-release` from `main` with `mode=publish` and the exact version in `confirm_version`;
5. do not create a GitHub prerelease until the public-registry clean-HOME smoke has passed.

If the first package cannot be published because the scope/name is unavailable, stop. Do not rename packages during a partially completed release without opening a release-blocker issue.

## Move to Trusted Publishing immediately after bootstrap

After all six package names exist on npm:

1. configure a GitHub Actions Trusted Publisher for each package;
2. use repository `Altairpaca/dshelm` and workflow filename `release-npm.yml`;
3. allow only the intended publish action (or use staged publishing if the release policy moves to explicit 2FA approval);
4. run a later alpha release through OIDC and verify provenance on npm;
5. revoke the bootstrap `NPM_TOKEN` and remove it from repository secrets once it is no longer required.

Do not use commercial/provider credentials as npm publishing credentials.

## Release completion for issue #7

The npm alpha release is not considered verified merely because `npm publish` returned success. Attach or link the workflow evidence showing:

- exact DSHelm and DSH versions;
- public registry installation of the released `dshelm` version;
- clean-HOME `init --yes` success;
- `doctor` output before/after installation and after uninstall;
- DSH profile discovery/composition;
- uninstall removing DSHelm-owned state while preserving unrelated profiles/config;
- final GitHub prerelease notes with install, upgrade, limitations, compatibility boundary, and uninstall instructions.

Until these checks pass, README install instructions should continue to describe the repository as a source preview.
