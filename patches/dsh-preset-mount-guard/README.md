# DSH preset-mount guard (0.1.0-rc.6, in-place global-install patch)

## Problem

Creating a session with one of the "PTC 创造模式" presets (`ptc-t1` /
`ptc-t2` / `ptc-cordis`, all three share the same display name) hangs:
`session.create` never returns, the Web UI appears stuck, no session file is
ever written, and the server logs nothing.

## Root cause (verified in source)

- `session.create → ensureSession → composeAgent → presets.mount →
  mountPreset → handle.await()` (loader group await).
- The loader's `await()` loops while `getTasks()` (each row's `_initTask` or
  `fiber.inertia`) is non-empty. A row whose `apply` never settles keeps its
  `inertia` pending forever → infinite wait, no error, no log.
- Rows that fail or wait on missing inject services DO fail loud
  (`PresetMountError` with per-row detail); a hang is therefore always an
  `apply` that never returns.
- The three PTC presets are iterations of the same authoring preset
  (`ptc-t2` = shipped `cordis` rows + `tool-presentation`, no
  `cordis-inspect-bridge`; `ptc-t1` = + bridge, no presentation;
  `ptc-cordis` = both). The exact hanging row is captured by the guard's
  timeout diagnostics on first reproduction.

## The patch

`dsh-agent-presets/lib/index.js`, `mountPreset()`: race `handle.await()`
against a 10 s timeout; on timeout, enumerate every entry's id/name and
state (`import in progress` / `apply in progress` / `never started`) and
throw a `PresetMountError` naming them. The mount previously hung forever;
it now fails loud within 10 s, and the error message identifies the row.

## Apply / re-apply

```bash
bash deephelm/patches/dsh-preset-mount-guard/apply.sh
```

then restart `dsh web`. Any `bun add -g @deepseek-ai/dsh` reinstall wipes
the patch — re-run the script afterwards.

## Why it is safe

- Mounting is a local loader operation with no network I/O; a 10 s budget is
  multiple orders of magnitude above normal mount time (which is well under a
  second), so it cannot false-positive on slow initialization.
- On timeout the guard only reports; the failing mount is disposed through
  the existing error path (`handle.dispose()`), leaving no partial
  composition behind.
