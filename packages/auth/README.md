# @dshelm/auth

Provider-neutral account and authentication capability discovery for DSHelm.

The package exposes status/reference information needed by routing and diagnostics while keeping product-owned credentials in their original stores. DSHelm policy should receive opaque capability or credential references, not copied secrets.

> **Security boundary:** never use fixtures, Issues, or traces to export tokens, cookies, account identifiers, or other product-owned secrets. See [`SECURITY.md`](../../SECURITY.md).

See the [project README](../../README.en.md), [architecture](../../docs/ARCHITECTURE.md), and [contribution guide](../../CONTRIBUTING.md).

Apache License 2.0.
