# DSHelm examples

## Offline first-run routing fixture

The first public example is intentionally **offline and credential-free**. It demonstrates the DSHelm policy resolver and Resolution Trace across a bounded role sequence:

```text
planner → worker A
        → worker B
        → reviewer
```

Run from the repository root after `pnpm install`:

```bash
pnpm example:first-run
```

The command prints deterministic JSON containing, for every role:

- the routing requirements;
- resolved role/provider/model/reasoning level;
- selected candidate;
- all candidate outcomes and scores;
- model-knowledge snapshot and evidence provenance;
- field-level Resolution Trace provenance.

The checked-in runtime is a synthetic fixture (`fixture/reasoning-pro` and `fixture/fast-worker`). It performs **no network request, provider authentication, tool execution, or agent task execution**. Its purpose is to make the routing/explanation contract observable before a user configures real providers.

Expected selection:

| Step | Requirement | Selected fixture model |
| --- | --- | --- |
| planner | strong planning | `reasoning-pro` |
| worker A | cheap parallelism + fast latency | `fast-worker` |
| worker B | cheap parallelism + fast latency | `fast-worker` |
| reviewer | independent verification | `reasoning-pro` |

The fixture is covered by `packages/core/tests/first-run-example.test.ts`, including deterministic output, role/model selection, trace-v2 presence, and a guard against credential-like data appearing in the serialized result.

A later integration example may execute real DSH tasks, but it should remain separate from this fixture so the repository never confuses a deterministic policy demonstration with live-provider evidence.
