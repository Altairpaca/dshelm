# DSHelm Verified Stack

> DSHelm does not merely list plugins — it verifies combinations. Each row
> records the DSH version, plugin version, test evidence, and known
> limitations. Status: VERIFIED | PARTIAL | EXPERIMENTAL | BROKEN |
> UNSUPPORTED.

| Integration | Status | DSH | Plugin | Evidence | Limitations |
|---|---|---|---|---|---|
| DSHelm Core policy kernel | VERIFIED | rc.7 | @dshelm/core 0.3.0-alpha.0 | core tests incl. property/fuzz, determinism, perf baseline | v0.1 scope (no inheritance, skills metadata-only) |
| DSHelm host service (dshelm.policy) | VERIFIED | rc.7 | @dshelm/dsh 0.3.0-alpha.0 | host-composition tests + real profile boot (qa:dsh-host) | — |
| Keyless real execution (request/header == trace) | VERIFIED | rc.7 | @dshelm/dsh | dsh-request-contract.test.ts | scripted adapter only; credentialed E2E pending key |
| pi-ai provider-owned OAuth bridge | VERIFIED | pi-ai 0.82.1 / DSH rc.7 seam | @dshelm/auth + dshelm | auth fixture tests + temporary HOME `auth status` | user-scoped `0600` file fallback; OS keychain backend pending; real browser login opt-in |
| Model Knowledge production overlay | VERIFIED | rc.7 | @dshelm/model-knowledge + @dshelm/dsh | route-impact test chooses Flash from shipped evidence | runtime readiness remains false until real provider discovery |
| Native product auth descriptors | PARTIAL | current CLI evidence | dshelm | Codex top-level login/logout and Claude auth surface descriptors | product status is unknown when no verified non-interactive command exists |
| Vertical slice (planner→workers→reviewer) | VERIFIED | rc.7 | @dshelm/dsh | vertical-slice.test.ts | scripted adapter; bounded revision proven |
| Host→client projection transport | VERIFIED | rc.7 | @dshelm/dsh + dsh-session-projection | host-composition projection fold test | browser rendering pending client build |
| DSH Web client runtime (package availability) | VERIFIED | rc.7 | @deepseek-ai/dsh-client-runtime 0.1.0-rc.7 | npm install + export check (/tmp/dshelm-client-check) | runtime is browser-only (window required) |
| DSH Web client bundle (body-portal panel, projection-fed) | EXPERIMENTAL | rc.7 | dsh-client-runtime + react | tsdown build emits lib/client.js with __ModuleLoader__.load({id: @dshelm/dsh}); qa:dsh-host checks bundle shape | live browser rendering pending a real Web shell session |
| AgentTeams (durable teams) | PARTIAL | rc.7 | @nanmicoder/dsh-agent-teams 0.1.5 | upstream README/source audit; integration pending | per-member effective model needs request/header re-verification; no upstream test suite |
| Sisyphus presets (lanes) | EXPERIMENTAL | rc.7 | dsh-sisyphus-presets | source/README audit | SUL-1.0 (reference only; detect/support, never copy) |
| Oh-My-DSH capability library | PARTIAL | rc.7 | oh-my-dsh (unlicensed) | GAP-LEDGER + plugin dir audit | no license → reference only |
| Memory (dsh-mneme / dsh-context) | PARTIAL | rc.7 | ecosystem | prior session usage | one active automatic memory source policy |
| OmO compatibility / migration | EXPERIMENTAL | — | OmO (SUL-1.0) | feature matrix + ledger | migrate tooling in v0.2; read-only source access |
| npm distribution (pack + fresh install) | VERIFIED | rc.7 | dshelm + @dshelm/* closure tarballs | clean temporary HOME journey: install → init → explain → uninstall | public registry publication is a release step |
| CI (6 lanes) | VERIFIED | — | GitHub Actions | local workflow definition includes pack/install closure journey | hosted run evidence is pending PR |

## Policy

- A row becomes VERIFIED only with test/run evidence recorded here.
- PARTIAL/EXPERIMENTAL rows are labeled in README and never overclaimed.
- BROKEN rows (none today) block related claims until fixed.
