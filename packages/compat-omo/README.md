# @dshelm/compat-omo

Read-only OmO configuration migration and compatibility mapping for DSHelm.

The mapper analyzes supported OmO configuration concepts and emits DSHelm policy plus an explicit `SUPPORTED` / `MAPPED` / `LOSSY` / `UNSUPPORTED` report. Dry-run behavior and visible loss are preferred over silently changing unsupported configuration.

This package does not copy OmO credentials, sessions, or private runtime stores.

See the [project README](../../README.en.md), [architecture](../../docs/ARCHITECTURE.md), and [contribution guide](../../CONTRIBUTING.md).

Apache License 2.0.
