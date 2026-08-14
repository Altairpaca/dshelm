import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { parse } from 'node:url'
import { chromium } from 'playwright'

const args = new Map(
  process.argv.slice(2).flatMap((value, index, values) => {
    if (!value.startsWith('--')) return []
    return [[value.slice(2), values[index + 1] ?? 'true'] as const]
  }),
)
const profile = args.get('profile') ?? 'deephelm-v01'
const targetUrl = args.get('url') ?? 'http://127.0.0.1:19876'
const parsedUrl = parse(targetUrl)
const host = parsedUrl.hostname ?? '127.0.0.1'
const port = Number(parsedUrl.port ?? 19876)
const evidenceDir = '.omo/evidence/web-ui'
const snapshot = {
  roles: [
    { role: 'planner', provider: 'deepseek', model: 'deepseek-v4-pro', reasoning: 'high' },
    { role: 'worker', provider: 'deepseek', model: 'deepseek-v4-flash', reasoning: 'medium' },
    { role: 'reviewer', provider: 'deepseek', model: 'deepseek-v4-pro', reasoning: 'high' },
  ],
  inspector: {
    request: 'vertical-slice',
    category: 'deep',
    role: 'planner',
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    reasoning: 'high',
    trace: [
      { field: 'agent', source: 'category.deep', value: 'planner' },
      { field: 'modelProfile', source: 'agent.planner', value: 'reasoning-high' },
      { field: 'reasoning', source: 'modelProfile.reasoning-high', value: 'high' },
      { field: 'model', source: 'modelProfile.reasoning-high', value: 'deepseek-v4-pro' },
    ],
  },
}
const actions: string[] = [
  `profile=${profile}`,
  `GET ${targetUrl}`,
]
const clientScript = await readFile('packages/dsh/dist/client.js', 'utf8')
const html = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DeepHelm QA</title></head>
  <body>
    <main id="mount"></main>
    <script type="module">
      const snapshot = ${JSON.stringify(snapshot)};
      const { apply } = await import('/client.js');
      apply({
        deephelmPolicy: { snapshot: () => snapshot },
        effect: (cleanup) => { window.addEventListener('beforeunload', cleanup, { once: true }); },
      });
    </script>
  </body>
</html>`

await mkdir(evidenceDir, { recursive: true })
const server = createServer((request, response) => {
  if (request.url === '/client.js') {
    response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' })
    response.end(clientScript)
    return
  }
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  response.end(html)
})

const listen = new Promise<void>((resolve, reject) => {
  server.once('error', reject)
  server.listen(port, host, () => resolve())
})
await listen

let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
let passed = false
try {
  browser = await chromium.launch({ headless: true })
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await desktop.goto(targetUrl, { waitUntil: 'networkidle' })
  await desktop.locator('[data-deephelm-matrix]').waitFor()
  const desktopRows = await desktop.locator('[data-deephelm-matrix] tbody tr').count()
  const desktopInspector = await desktop.locator('[data-deephelm-inspector]').isVisible()
  const desktopModels = await desktop.locator('[data-deephelm-matrix] tbody tr').evaluateAll(
    rows => rows.map(row => ({
      role: row.getAttribute('data-role'),
      provider: row.getAttribute('data-provider'),
      model: row.getAttribute('data-model'),
    })),
  )
  if (desktopRows !== 3 || !desktopInspector) {
    throw new Error(`desktop assertions failed: rows=${desktopRows}, inspector=${desktopInspector}`)
  }
  const expectedModels = snapshot.roles.map(({ role, provider, model }) => ({
    role,
    provider,
    model,
  }))
  if (JSON.stringify(desktopModels) !== JSON.stringify(expectedModels)) {
    throw new Error(`desktop matrix mismatch: ${JSON.stringify(desktopModels)}`)
  }
  actions.push(`desktop rows=${desktopRows} inspector=${desktopInspector}`)
  await desktop.screenshot({ path: `${evidenceDir}/desktop.png`, fullPage: true })
  await desktop.close()

  const narrow = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await narrow.goto(targetUrl, { waitUntil: 'networkidle' })
  await narrow.locator('[data-deephelm-inspector]').waitFor()
  const narrowWidth = await narrow.locator('[data-deephelm-control-plane]').evaluate(
    element => element.getBoundingClientRect().width,
  )
  const traceItems = await narrow.locator('[data-deephelm-inspector] li').count()
  if (narrowWidth > 390 || traceItems !== snapshot.inspector.trace.length) {
    throw new Error(`narrow assertions failed: width=${narrowWidth}, traceItems=${traceItems}`)
  }
  actions.push(`narrow width=${narrowWidth} traceItems=${traceItems}`)
  await narrow.screenshot({ path: `${evidenceDir}/narrow.png`, fullPage: true })
  await narrow.close()
  passed = true
} finally {
  await browser?.close()
  await new Promise<void>((resolve, reject) => {
    server.close(error => (error ? reject(error) : resolve()))
  })
  actions.push(`cleanup: browser closed; HTTP server ${host}:${port} closed`)
  await writeFile(`${evidenceDir}/actions.log`, `${actions.join('\n')}\n`, 'utf8')
}

if (!passed) {
  throw new Error('DeepHelm browser QA failed')
}
console.log(`QA_PASS profile=${profile} evidence=${evidenceDir}`)
