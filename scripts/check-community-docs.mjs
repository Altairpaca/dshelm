import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const documents = ['README.md', 'README.en.md', 'README.zh-CN.md', 'CONTRIBUTING.md', 'SECURITY.md', 'docs/community-roadmap.zh-CN.md', 'docs/desktop.zh-CN.md']
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
}

const readme = readFileSync('README.md', 'utf8')
for (const required of ['docs/assets/banner.svg', 'docs/assets/control-plane.png', 'pnpm preview:init', 'npm 包尚未发布', 'deepseek-ai/deepseek-harness/discussions']) {
  if (!readme.includes(required)) failures.push(`README.md: missing required community-release fact ${required}`)
}
const runnableBlocks = [...readme.matchAll(/```(?:bash|sh)\n([\s\S]*?)```/g)].map((match) => match[1])
if (runnableBlocks.some((block) => /(?:npx dshelm|npm install[^\n]*dshelm)/.test(block))) {
  failures.push('README.md: unpublished npm install command appears in a runnable code block')
}

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log(`community docs OK (${documents.length} documents)`)
