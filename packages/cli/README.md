# dshelm

The DSHelm command-line interface for installation diagnostics, authentication status, model-routing explanation, migration commands, and source-preview lifecycle operations.

> **Alpha source preview:** the npm distribution is not public yet. Use the repository's [source-preview instructions](../../README.en.md#source-preview) until the npm alpha release is recorded in [issue #7](https://github.com/Altairpaca/dshelm/issues/7).

## Responsibilities

- inspect the installed DSHelm / DSH environment with `doctor`;
- show provider/account capability status without copying product-owned secrets;
- explain model routing and Resolution Trace decisions;
- expose supported migration and install/uninstall workflows.

The CLI composes `@dshelm/core`, `@dshelm/dsh`, `@dshelm/auth`, `@dshelm/model-knowledge`, and `@dshelm/compat-omo`. It does not replace the DeepSeek Harness runtime.

See the [project README](../../README.en.md), [architecture](../../docs/ARCHITECTURE.md), and [support guide](../../SUPPORT.md) for the current contract and limitations.

Apache License 2.0.
