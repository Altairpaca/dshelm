import { AuthContractError, type AuthProbeContext, type AuthRegistry } from '@dshelm/auth'
import { createDefaultAuthRegistry, defaultAuthProbeContext, formatAuthStatus, terminalAuthInteraction } from './auth-discovery.ts'
import { authLines, baselineKnowledge, initProfile, knowledgeStatusLines, modelExplainLines, modelInspectLines } from './user-commands.ts'

const providerResources = {
  deepseek: 'deepseek-api',
  openai: 'openai-api',
  anthropic: 'anthropic-api',
  xai: 'xai-api',
  google: 'google-api',
  openrouter: 'openrouter-api',
  qwen: 'qwen-api',
  kimi: 'kimi-api',
  minimax: 'minimax-api',
  zai: 'zai-api',
} as const

export async function authCommand(args: readonly string[]): Promise<number> {
  const registry = createDefaultAuthRegistry()
  const context = defaultAuthProbeContext()
  const action = args[0] ?? 'status'
  if (action === 'list' || action === 'status') {
    const statuses = action === 'list' ? await registry.probe(context) : await registry.status(context)
    console.log(`DSHelm auth ${action}\n\n${authLines(statuses).join('\n')}`)
    return 0
  }
  if (action === 'login' || action === 'logout') {
    const resourceId = args[1]
    if (resourceId === undefined) {
      console.error(`auth ${action} requires <resource>`)
      return 1
    }
    const adapter = registry.list().find((entry) => entry.resourceId === resourceId)
    const method = adapter?.methods[0]
    if (adapter === undefined || method === undefined) {
      console.error(`auth: unknown resource "${resourceId}"`)
      return 1
    }
    try {
      const result = action === 'login'
        ? await registry.login(resourceId, method.id, terminalAuthInteraction, context)
        : await registry.logout(resourceId, method.id, context)
      console.log(formatAuthStatus(result))
      return result.status === 'authenticated' || result.status === 'available' ? 0 : 1
    } catch (error) {
      if (error instanceof AuthContractError) {
        console.error(`auth ${action}: ${error.message}`)
        return 1
      }
      throw error
    }
  }
  console.error(`auth: unknown action "${action}" (use list, status, login, or logout)`)
  return 1
}

export function modelsCommand(args: readonly string[]): number {
  const action = args[0] ?? 'inspect'
  if (action === 'inspect') {
    console.log(`DSHelm models\n\n${modelInspectLines(baselineKnowledge).join('\n')}`)
    return 0
  }
  if (action === 'explain') {
    const reference = args[1]
    if (reference === undefined) {
      console.error('models explain requires <provider>/<model>')
      return 1
    }
    const lines = modelExplainLines(baselineKnowledge, reference)
    console.log(lines.join('\n'))
    return modelExplanationFailed(lines) ? 1 : 0
  }
  console.error(`models: unknown action "${action}" (use inspect or explain)`)
  return 1
}

export async function explainCommand(reference: string | undefined, registry: AuthRegistry = createDefaultAuthRegistry(), context: AuthProbeContext = defaultAuthProbeContext()): Promise<number> {
  if (reference === undefined) {
    console.error('explain requires <provider>/<model>')
    return 1
  }
  const lines = modelExplainLines(baselineKnowledge, reference)
  console.log(lines.join('\n'))
  if (modelExplanationFailed(lines)) return 1
  const separator = reference.indexOf('/')
  const provider = separator > 0 ? reference.slice(0, separator) : ''
  const resourceId = Object.entries(providerResources).find(([key]) => key === provider)?.[1]
  const statuses = resourceId === undefined ? [] : (await registry.status(context)).filter((status) => status.resourceId === resourceId)
  const auth = statuses[0]
  console.log(`auth=${auth === undefined ? 'unknown resource' : `${auth.status} owner=${auth.authOwner}`}`)
  console.log('execution=not-executed request/header evidence is collected only during a task run')
  return 0
}

export function knowledgeCommand(args: readonly string[]): number {
  if (args[0] !== undefined && args[0] !== 'status') {
    console.error(`knowledge: unknown action "${args[0]}" (use status)`)
    return 1
  }
  console.log(`DSHelm knowledge\n\n${knowledgeStatusLines(baselineKnowledge, new Date()).join('\n')}`)
  return 0
}

export async function initCommand(args: readonly string[]): Promise<number> {
  const result = await initProfile(createDefaultAuthRegistry(), defaultAuthProbeContext(), { cwd: process.cwd(), now: () => new Date() })
  console.log(`DSHelm init\n\n${result.written ? 'Generated' : 'Using existing'} ${result.path}`)
  console.log(`DSH: ${result.profile.dsh.available ? `available${result.profile.dsh.version === null ? '' : ` (${result.profile.dsh.version})`}` : 'not detected'}`)
  console.log(`Authenticated resources: ${result.profile.topology.authenticatedResources.join(', ') || 'none'}`)
  console.log(`Execution strategy: ${result.profile.topology.strategy}`)
  if (!args.includes('--yes')) console.log('No login was started. Use `dshelm auth login <resource>` for explicit interactive login.')
  return 0
}

function modelExplanationFailed(lines: readonly string[]): boolean {
  return lines[0]?.startsWith('invalid ') === true || lines[0]?.endsWith('no evidence record') === true
}
