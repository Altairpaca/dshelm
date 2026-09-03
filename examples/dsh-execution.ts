import { runDshExecutionExample } from './dsh-execution-fixture.ts'

const result = await runDshExecutionExample()
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
