# DSH 0.1.2-rc.1 client graph migration

## Purpose

Track the migration from the legacy DSH client runtime graph to the module-based client graph. Compatibility claims remain disabled until machine-readable evidence gates pass.

## Migration boundary

Current validated graph:

- `@deepseek-ai/dsh-client-runtime@0.1.0-rc.7`
- `@deepseek-ai/dsh-client-ui-slots@0.1.0-rc.7`
- `@deepseek-ai/dsh-client-ui-conversation@0.1.0-rc.7`

Target graph:

- `@deepseek-ai/dsh-client-modules@0.1.2-rc.1`
- verified client extensions

Upstream rc.1 currently has documented Web/client-module failures, including build-time externals drift and single-exe metadata loss. These remain blockers rather than being hidden by a package-version bump.

## Machine-readable promotion contract

Two files separate intent from evidence:

- `compatibility-candidates.json` — required checks, candidate state and upstream blockers;
- `compatibility-evidence.json` — current status of every required check.

A `pass` check must include a timezone-aware observation timestamp and evidence URI. A `blocked` check must name an unresolved blocker from the candidate manifest. `ready` is invalid unless every required check passes and every blocker is resolved.

`release:check` validates both files. `compatibility.json.tested.dshPackages` cannot be promoted merely by editing documentation.

## Required evidence

Before updating compatibility metadata:

- exact package graph recorded;
- lockfile regenerated without mixed prerelease ownership;
- workspace typecheck/tests pass;
- packed atomic DSHelm release installs;
- isolated `HOME` and `DSH_HOME` profile journey passes;
- Web client boots through the current client module graph;
- `@dshelm/dsh` browser bundle is discovered/materialized;
- no credentials or private runtime state are included in evidence.

## Compatibility language

Until all gates pass:

- status: blocked candidate;
- no routing score changes;
- no default provider/model changes;
- no public compatibility guarantee.

## Design rule

DSHelm consumes DSH capabilities through explicit contracts. It does not duplicate DSH orchestration policy inside the compatibility layer.
