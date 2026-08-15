# DSHelm Verified Stack

> DSHelm does not merely list plugins — it verifies combinations. Each row
> records the DSH version, plugin version, test evidence, and known
> limitations. Status: VERIFIED | PARTIAL | EXPERIMENTAL | BROKEN |
> UNSUPPORTED.

| Integration | Status | DSH | Plugin | Evidence | Limitations |
|---|---|---|---|---|---|
| DSHelm Core policy kernel | VERIFIED | rc.6 | @dshelm/core 0.1.0 | 51 core tests incl. property/fuzz, determinism, perf baseline | v0.1 scope (no inheritance, skills metadata-only) |
| DSHelm host service (dshelm.policy) | VERIFIED | rc.6 | @dshelm/dsh 0.1.0-alpha.1 | host-composition tests + real profile boot (qa:dsh-host) | — |
| Keyless real execution (request/header == trace) | VERIFIED | rc.6 | @dshelm/dsh | dsh-request-contract.test.ts | scripted adapter only; credentialed E2E pending key |
| Vertical slice (planner→workers→reviewer) | VERIFIED | rc.6 | @dshelm/dsh | vertical-slice.test.ts | scripted adapter; bounded revision proven |
| Host→client projection transport | VERIFIED | rc.6 | @dshelm/dsh + dsh-session-projection | host-composition projection fold test | browser rendering pending client build |
| DSH Web client runtime (package availability) | VERIFIED | rc.6 | @deepseek-ai/dsh-client-runtime 0.1.0-rc.6 | npm install + export check (/tmp/dshelm-client-check) | runtime is browser-only (window required) |
| DSH Web client bundle (body-portal panel, projection-fed) | EXPERIMENTAL | rc.6 | dsh-client-runtime + react | tsdown build emits lib/client.js with __ModuleLoader__.load({id: @dshelm/dsh}); qa:dsh-host checks bundle shape | live browser rendering pending a real Web shell session |
| AgentTeams (durable teams) | PARTIAL | rc.6 | @nanmicoder/dsh-agent-teams 0.1.5 | upstream README/source audit; integration pending | per-member effective model needs request/header re-verification; no upstream test suite |
| Sisyphus presets (lanes) | EXPERIMENTAL | rc.6 | dsh-sisyphus-presets | source/README audit | SUL-1.0 (reference only; detect/support, never copy) |
| Oh-My-DSH capability library | PARTIAL | rc.6 | oh-my-dsh (unlicensed) | GAP-LEDGER + plugin dir audit | no license → reference only |
| Memory (dsh-mneme / dsh-context) | PARTIAL | rc.6 | ecosystem | prior session usage | one active automatic memory source policy |
| OmO compatibility / migration | EXPERIMENTAL | — | OmO (SUL-1.0) | feature matrix + ledger | migrate tooling in v0.2; read-only source access |
| npm distribution (pack + fresh install) | VERIFIED | rc.6 | @dshelm/* tarballs | qa:dsh-host + /tmp/dshelm-fresh | @dshelm scope publish pending credentials |
| CI (6 lanes) | VERIFIED | — | GitHub Actions | PR #1 green runs | — |

## Policy

- A row becomes VERIFIED only with test/run evidence recorded here.
- PARTIAL/EXPERIMENTAL rows are labeled in README and never overclaimed.
- BROKEN rows (none today) block related claims until fixed.