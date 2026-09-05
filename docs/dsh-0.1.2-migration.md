# DSH 0.1.2-rc.1 client graph migration

## Purpose

Track the migration from the legacy DSH client runtime graph to the module-based client graph. Compatibility claims remain disabled until the evidence gates pass.

## Migration boundary

Current validated graph:

- `@deepseek-ai/dsh-client-runtime@0.1.0-rc.7`
- `@deepseek-ai/dsh-client-ui-slots@0.1.0-rc.7`
- `@deepseek-ai/dsh-client-ui-conversation@0.1.0-rc.7`

Target graph:

- `@deepseek-ai/dsh-client-modules@0.1.2-rc.1`
- verified client extensions

## Required evidence

Before updating compatibility metadata:

- exact package graph recorded;
- lockfile regenerated without mixed prerelease ownership;
- `dsh.client.inject` behavior verified;
- pack/install passes;
- isolated `HOME` and `DSH_HOME` smoke passes;
- doctor/init/uninstall lifecycle evidence recorded;
- no credentials or private runtime state included.

## Compatibility language

Until all gates pass:

- status: candidate
- no routing score changes;
- no default provider/model changes;
- no public compatibility guarantee.

## Design rule

DSHelm consumes DSH capabilities through explicit contracts. It does not duplicate DSH orchestration policy inside the compatibility layer.
