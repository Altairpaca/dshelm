# DSH 0.1.2-rc.1 client graph migration

DSHelm keeps `0.1.2-rc.1` as a blocked compatibility candidate until the package graph and Web/client-module behavior are evidenced, not merely declared.

Current validated graph uses `dsh-client-runtime`, `dsh-client-ui-slots` and `dsh-client-ui-conversation` at the rc.7 baseline. The target graph moves to `dsh-client-modules` plus verified client extensions.

`compatibility-candidates.json` records required checks and upstream blockers. `compatibility-evidence.json` records `pending/pass/fail/blocked` evidence state. A passing check requires an evidence URI plus timezone-aware observation timestamp; a blocked check must reference an unresolved known blocker. Candidate state `ready` is invalid unless every check passes and every blocker is resolved. `release:check` enforces the contract.

Until those gates pass, DSHelm does not widen compatibility metadata, routing scores or public claims beyond the verified baseline.
