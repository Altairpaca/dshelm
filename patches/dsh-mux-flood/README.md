# DSH mux-flood fix (0.1.0-rc.6, in-place global-install patch)

Root cause of the "Web UI 卡死"（streaming 正常，但 New Session / 刷新
全部无响应）reported on altair-server (2026-08-15):

- `@deepseek-ai/dsh-host-apiproxy` `events.mux` pushes **every** `session/event`
  of **every** session to **every** connected client (no per-session
  subscription in the wire protocol), with an **unbounded** `FrameQueue`.
- Providers stream token-sized `assistant/chunk` deltas, so under heavy
  parallel streaming (subagents / long tasks) one page receives hundreds of
  frames per second of mostly-unneeded traffic; the browser main thread is
  starved and interactive work (New Session, refresh bootstrap) never
  schedules.
- `0.1.0-rc.6` is the latest published version — no upstream fix exists yet.

## The patch (3 files)

| File | Change |
| --- | --- |
| `dsh-host-apiproxy/lib/index.js` | `events.mux`: coalesce consecutive token deltas of the same `(session, turn, step, index, type)` into one `session/events` frame, flushed every 60 ms; non-chunk events flush pending runs and flow immediately (wire order preserved). `FrameQueue` gains a `maxSize` cap (mux uses 8192) that drops oldest chunk frames first. |
| `dsh-client-connection/lib/client.js` | `muxFrameSchema` (closed discriminated union): register the new `session/events` frame member. |
| `dsh-client-runtime/lib/client.js` | `Session.handleMuxEnvelope`: apply `session/events` batches in order with the gap check bypassed (`acceptLiveEvent(…, trustedSeq=true)`); batch events carry the run's **last** seq so the next raw event passes the `repairGap` check. |

## Why it is safe (verified)

- The client stitcher concatenates per `(chunk.index, chunk.type)`
  (`updateChunk` in dsh-client-ui-conversation), so merging consecutive
  deltas is byte-for-byte lossless — confirmed by simulation against the raw
  path (interleaved sessions, reasoning+text deltas, interrupts, block-end).
- Merged frames advance the session tail exactly to the run's last seq, so
  `acceptLiveEvent`'s `event.seq > tailSeq + 1 → repairGap()` never trips on
  merged frames (gap check bypassed only inside the batch).
- `session/events` for an uninstantiated session is dropped by the manager,
  exactly like `session/event` (history backfills on open).
- The queue cap is a last-resort memory bound; dropping chunk frames only
  triggers the client's existing history-repull recovery.

## Apply / re-apply

```bash
bash deephelm/patches/dsh-mux-flood/apply.sh
```

then restart `dsh web --port 3081` and hard-refresh the browser.
Any `bun add -g @deepseek-ai/dsh` reinstall wipes the patch — re-run the
script after upgrades (and `node-gyp rebuild` node-pty if needed).

## Not covered here

- Per-session subscription filtering on the wire (protocol change; needs
  coordinated client+server work upstream).
- The `Math.min(...hugeArray)` history-load stack overflow path (separate
  rc.6 issue; not observed in this deployment's session logs).
