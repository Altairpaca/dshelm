import { buildFirstRunResult } from './first-run-fixture.ts'

const result = await buildFirstRunResult()
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
