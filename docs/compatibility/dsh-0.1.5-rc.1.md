# DeepSeek Harness 0.1.5-rc.1 forward-compatibility audit

Status: **candidate only**. DSHelm's verified install baseline remains `@deepseek-ai/dsh@0.1.0-rc.7` until the promotion evidence gate passes.

## Upstream snapshot

- Release: `dsh-v0.1.5-rc.1`
- Published: 2026-09-10
- Release target commit: `183f08e9c6dde7e36cd2318eaee70b0da08fb35e`
- Release page: https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.5-rc.1

The release is the first 0.1.5 release candidate and consolidates the important developer-facing changes since `0.1.2-rc.1`.

## DSHelm-relevant seams

### Session and lifecycle

- Session data format is V3. Supported older logs migrate forward; upgraded V3 sessions are not guaranteed to be readable by older Harness versions.
- Session persistence is lifecycle-owned through `SessionHandle`.
- `agentLoop.create()` is asynchronous.
- A session may be owned by at most one process at a time.

DSHelm must not treat a source-level Session bridge as proof that persisted-session migration or lock ownership works end to end.

### Agent, subagent, and Inbox APIs

- Plugin Agent API no longer exposes `ctx.agent`; callers pass the Agent explicitly.
- Inbox is a type/interface surfaced through `agent.inbox`; legacy public `hasPending` / `claim` behavior is removed.
- Continuable subagents support queued messages plus edit/delete/Steer/Stop operations.

These changes need an explicit source audit before the candidate package graph can be promoted.

### Web plugin surface

- Global plugin panels register through `sidebar.panellist` and `main`.
- The previous `conversation` Slot moves to the `conversation` key of `main`.
- The old Detail panel is removed in favor of the current Sidebar surface.

DSHelm's control plane should migrate toward these native surfaces rather than preserve legacy body-mounted or obsolete slot assumptions indefinitely.

### DeepSeek model catalog

At this exact release tag, the built-in DeepSeek adapter includes:

- `deepseek-flash` → `DeepSeek-V41-Flash`, 1,000,000 context, text + image input, `systemPromptUpdate: in-history`;
- `deepseek-v4-flash` → `DeepSeek-V4-Flash`;
- `deepseek-v4-pro` → `DeepSeek-V4-Pro`;
- `deepseek-v4-flash-vision-exp` → `DeepSeek-V4-Flash-Vision-Exp`, text + image input.

The adapter's default combined context capacity is 1,000,000 tokens and its default per-request output cap is 256,000 tokens. Those values are DSH runtime defaults; they must not be restated as independent DeepSeek service guarantees without a DeepSeek-owned source.

### Other compatibility-relevant changes

- `pi-ai` is 0.85.1.
- SDK/Headless/ACP default file editing uses read/write/edit.
- Ordinary subprocess handles no longer expose `pid`.
- Custom provider discovery is broader, and invalid pi-ai model configuration now keeps a diagnostic/repair path instead of making the model settings entry disappear.

## Promotion evidence

`compatibility-evidence.json` is intentionally reset to pending for this candidate. The required checks cover:

1. package graph completeness;
2. workspace typecheck/build contracts;
3. packed release install;
4. isolated profile journey;
5. Session V3 and lifecycle ownership;
6. Agent/Inbox API compatibility;
7. current Web panel API compatibility;
8. DeepSeek model catalog provenance;
9. Web client boot;
10. DSHelm browser-bundle discovery/materialization.

Only evidence-backed `pass` states may move the candidate to `ready`. Updating metadata alone must never promote `compatibility.json.tested`.

## Community signals to keep in scope

Recent DSH reports reinforce three product requirements for DSHelm:

- plugin/DSH version mismatches need explicit compatibility metadata and actionable diagnostics;
- the model actually used by a child agent must be visible because silent route differences can change cost materially;
- plugin permissions and capability surface are becoming ecosystem trust concerns, so future marketplace-facing metadata should favor declarative evidence over raw plugin counts.

These signals inform the roadmap but are not treated as runtime compatibility evidence.
