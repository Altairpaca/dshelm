import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const documents = [
  'README.md',
  'README.en.md',
  'README.zh-CN.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'CHANGELOG.md',
  'docs/RELEASING.md',
  'docs/community-roadmap.zh-CN.md',
  'docs/desktop.zh-CN.md',
  'docs/compatibility/dsh-0.1.2-rc.1.md',
]
const failures = []

for (const document of documents) {
  if (!existsSync(document)) {
    failures.push(`${document}: missing document`)
    continue
  }
  const content = readFileSync(document, 'utf8')
  const links = [...content.matchAll(/(?:href=|]\()["']?([^"')\s>#]+)(?:#[^"')\s>]*)?/g)].map((match) => match[1])
  for (const link of links) {
    if (link.startsWith('http:') || link.startsWith('https:') || link.startsWith('mailto:')) continue
    if (!existsSync(resolve(dirname(document), link))) failures.push(`${document}: missing local target ${link}`)
  }
  if (/Chinese-first/i.test(content)) {
    failures.push(`${document}: region-priority project positioning is not allowed`)
  }
}

const readme = readFileSync('README.md', 'utf8')
const englishReadme = readFileSync('README.en.md', 'utf8')
const landingAssets = [
  'docs/assets/banner.svg',
  'docs/assets/compatibility-status.svg',
  'docs/assets/routing-flow.svg',
  'docs/assets/control-plane.png',
]
for (const asset of landingAssets) {
  if (!readme.includes(asset)) failures.push(`README.md: missing landing-page visual ${asset}`)
  if (!englishReadme.includes(asset)) failures.push(`README.en.md: missing landing-page visual ${asset}`)
}

for (const required of ['pnpm preview:init', 'npm 包尚未发布', 'deepseek-ai/deepseek-harness/discussions', '0.1.0-rc.7', '0.1.2-rc.1']) {
  if (!readme.includes(required)) failures.push(`README.md: missing required community-release fact ${required}`)
}
for (const required of ['pnpm preview:init', 'deepseek-ai/deepseek-harness/discussions', '0.1.0-rc.7', '0.1.2-rc.1']) {
  if (!englishReadme.includes(required)) failures.push(`README.en.md: missing required community-release fact ${required}`)
}

for (const [name, content] of [['README.md', readme], ['README.en.md', englishReadme]]) {
  const runnableBlocks = [...content.matchAll(/```(?:bash|sh)\n([\s\S]*?)```/g)].map((match) => match[1])
  if (runnableBlocks.some((block) => /(?:npx dshelm|npm install[^\n]*dshelm)/.test(block))) {
    failures.push(`${name}: unpublished npm install command appears in a runnable code block`)
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log(`community docs OK (${documents.length} documents)`)
