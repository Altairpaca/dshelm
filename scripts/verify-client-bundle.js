/**
 * Verify the @dshelm/dsh client bundle shape (CI + qa lanes).
 * The client entry is a browser-only __ModuleLoader__ closure bundle;
 * importing it in Node fails (window is not defined), so verify the artifact
 * structure instead. Usage: node scripts/verify-client-bundle.js [path]
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const path = process.argv[2] ?? resolve(here, '../packages/dsh/lib/client.js')
const bundle = readFileSync(path, 'utf8')

// __ModuleLoader__.load({ id: "@dshelm/dsh", ... }) — tolerant of whitespace.
const re = /__ModuleLoader__\.load\(\{\s*id:\s*.?@dshelm\/dsh/
if (!re.test(bundle)) {
  console.error('FAIL: client bundle does not register __ModuleLoader__ with id @dshelm/dsh (' + path + ')')
  process.exit(1)
}
console.log('client bundle OK (' + path + ')')
