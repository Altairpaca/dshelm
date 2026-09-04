import { spawnSync } from 'node:child_process'

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

const build = spawnSync(pnpm, ['build'], {
  cwd: process.cwd(),
  stdio: ['inherit', 'pipe', 'inherit'],
  encoding: 'utf8',
})

if (build.stdout) process.stderr.write(build.stdout)
if (build.error) throw build.error
if (build.status !== 0) process.exit(build.status ?? 1)

// The example's stdout is a machine-readable JSON contract. Build diagnostics
// are intentionally forwarded to stderr so redirection captures only the JSON.
const run = spawnSync(pnpm, ['exec', 'tsx', 'examples/dsh-execution.ts'], {
  cwd: process.cwd(),
  stdio: ['inherit', 'inherit', 'inherit'],
})

if (run.error) throw run.error
process.exit(run.status ?? 1)
