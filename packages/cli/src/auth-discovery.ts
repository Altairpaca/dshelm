import { execFileSync } from 'node:child_process'
import { builtinModels } from '@earendil-works/pi-ai/providers/all'
import {
  AuthRegistry,
  EnvironmentApiKeyAuthAdapter,
  FileCredentialStore,
  LibraryOAuthAuthAdapter,
  NativeProductAuthAdapter,
  createPiAiOAuthDriver,
  credentialRef,
  defaultCredentialStorePath,
  type AuthInteraction,
  type AuthMethod,
  type AuthProbeContext,
  type AuthStatusResult,
  type CommandResult,
  type CommandSpec,
  type ProductCommandRunner,
} from '@dshelm/auth'

const API_KEY_RESOURCES = [
  ['deepseek-api', 'DeepSeek API', 'DEEPSEEK_API_KEY'],
  ['openai-api', 'OpenAI API', 'OPENAI_API_KEY'],
  ['anthropic-api', 'Anthropic API', 'ANTHROPIC_API_KEY'],
  ['xai-api', 'xAI API', 'XAI_API_KEY'],
  ['google-api', 'Google Gemini API', 'GEMINI_API_KEY'],
  ['openrouter-api', 'OpenRouter API', 'OPENROUTER_API_KEY'],
  ['qwen-api', 'Qwen API', 'QWEN_API_KEY'],
  ['kimi-api', 'Kimi API', 'KIMI_API_KEY'],
  ['minimax-api', 'MiniMax API', 'MINIMAX_API_KEY'],
  ['zai-api', 'Z.AI API', 'ZAI_API_KEY'],
] as const

const PRODUCT_RESOURCES = [
  ['codex-native', 'ChatGPT/Codex', 'codex'],
  ['claude-native', 'Claude Code', 'claude'],
  ['gemini-native', 'Gemini CLI', 'gemini'],
  ['qwen-native', 'Qwen Code', 'qwen'],
] as const

const productAuthDescriptors = {
  'codex-native': {
    product: 'ChatGPT/Codex',
    versionRange: 'codex-cli current',
    source: 'codex --help (top-level login/logout commands)',
    verifiedAt: '2026-08-18T00:00:00Z',
    preference: 'cli',
    login: { command: 'codex', args: ['login'], interactive: true },
    logout: { command: 'codex', args: ['logout'] },
  },
  'claude-native': {
    product: 'Claude Code',
    versionRange: 'claude-code current',
    source: 'https://docs.anthropic.com/en/docs/claude-code/overview',
    verifiedAt: '2026-08-18T00:00:00Z',
    preference: 'cli',
    login: { command: 'claude', args: ['auth', 'login'], interactive: true },
    logout: { command: 'claude', args: ['auth', 'logout'] },
  },
  'gemini-native': {
    product: 'Gemini CLI',
    versionRange: 'gemini-cli current',
    source: 'https://github.com/google-gemini/gemini-cli',
    verifiedAt: '2026-08-18T00:00:00Z',
    preference: 'cli',
    login: { command: 'gemini', args: ['auth', 'login'], interactive: true },
    logout: { command: 'gemini', args: ['auth', 'logout'] },
  },
  'qwen-native': {
    product: 'Qwen Code',
    versionRange: 'qwen-code current',
    source: 'https://github.com/QwenLM/qwen-code',
    verifiedAt: '2026-08-18T00:00:00Z',
    preference: 'cli',
    login: { command: 'qwen', args: ['auth', 'login'], interactive: true },
    logout: { command: 'qwen', args: ['auth', 'logout'] },
  },
} as const

const apiKeyMethod = (id: string): AuthMethod => ({
  id,
  kind: 'api-key',
  owner: 'host',
  interactive: false,
  headless: true,
  refreshOwner: 'none',
  credentialStoreOwner: 'host',
  supportsMultiAccount: false,
})

const nativeMethod = (id: string): AuthMethod => ({
  id,
  kind: 'native-product',
  owner: 'product',
  interactive: true,
  headless: false,
  refreshOwner: 'product',
  credentialStoreOwner: 'product',
  supportsMultiAccount: false,
})

class SyncProductCommandRunner implements ProductCommandRunner {
  run(spec: CommandSpec): Promise<CommandResult> {
    try {
      const stdout = execFileSync(spec.command, [...spec.args], {
        encoding: 'utf8',
        stdio: spec.interactive === true ? 'inherit' : ['ignore', 'pipe', 'pipe'],
        timeout: 10_000,
      })
      return Promise.resolve({ exitCode: 0, stdout: String(stdout), stderr: '' })
    } catch (error) {
      if (!(error instanceof Error)) throw error
      const exitCode = Reflect.get(error, 'status')
      const stdout = Reflect.get(error, 'stdout')
      const stderr = Reflect.get(error, 'stderr')
      return Promise.resolve({
        exitCode: typeof exitCode === 'number' ? exitCode : 1,
        stdout: typeof stdout === 'string' ? stdout : '',
        stderr: typeof stderr === 'string' ? stderr : '',
      })
    }
  }
}

export function createDefaultAuthRegistry(): AuthRegistry {
  const registry = new AuthRegistry()
  for (const [resourceId, product, envVar] of API_KEY_RESOURCES) {
    registry.register(new EnvironmentApiKeyAuthAdapter({
      resourceId,
      product,
      method: apiKeyMethod(`${resourceId}-key`),
      credential: credentialRef(`env/${envVar}`),
      envVar,
    }))
  }
  const runner = new SyncProductCommandRunner()
  for (const [resourceId, product, command] of PRODUCT_RESOURCES) {
    const descriptor = productAuthDescriptors[resourceId]
    if (descriptor === undefined) continue
    registry.register(new NativeProductAuthAdapter({
      resourceId,
      product,
      runner,
      descriptor: { ...descriptor, probe: { command, args: ['--version'] } },
      method: nativeMethod(`${resourceId}-login`),
      credential: credentialRef(`product/${resourceId}/default`),
    }))
  }
  const piModels = builtinModels({ credentials: new FileCredentialStore(defaultCredentialStorePath()) })
  for (const provider of piModels.getProviders()) {
    if (provider.auth.oauth === undefined) continue
    const resourceId = `pi-ai/${provider.id}`
    registry.register(new LibraryOAuthAuthAdapter({
      resourceId,
      product: provider.name,
      method: {
        id: `${resourceId}/oauth`,
        kind: 'library-oauth',
        owner: 'provider',
        interactive: true,
        headless: false,
        refreshOwner: 'provider',
        credentialStoreOwner: 'dshelm',
        supportsMultiAccount: false,
      },
      credential: credentialRef(`pi-ai/${provider.id}/default`),
      driver: createPiAiOAuthDriver({ models: piModels, providerId: provider.id }),
    }))
  }
  return registry
}

export function defaultAuthProbeContext(): AuthProbeContext {
  return {
    now: () => Date.now(),
    commandExists: async (command) => {
      try {
        execFileSync(command, ['--version'], { stdio: 'ignore', timeout: 5_000 })
        return true
      } catch (error) {
        if (error instanceof Error) return false
        throw error
      }
    },
    env: (name) => process.env[name],
  }
}

export const terminalAuthInteraction: AuthInteraction = {
  notify: (event) => {
    if (event.type === 'auth-url' && event.url !== undefined) console.log(`${event.message}: ${event.url}`)
    else console.log(event.message)
  },
  prompt: async (prompt) => {
    const { createInterface } = await import('node:readline/promises')
    const readline = createInterface({ input: process.stdin, output: process.stdout })
    try {
      if (prompt.type === 'select' && prompt.options !== undefined) {
        console.log(prompt.options.map((option, index) => `${index + 1}. ${option.label}${option.description === undefined ? '' : ` — ${option.description}`}`).join('\n'))
      }
      return await readline.question(`${prompt.message}: `)
    } finally {
      readline.close()
    }
  },
}

export function formatAuthStatus(status: AuthStatusResult): string {
  const expires = status.expiresAt === undefined ? '' : ` expires=${new Date(status.expiresAt).toISOString()}`
  return `${status.resourceId} ${status.methodId} ${status.status} owner=${status.authOwner}${expires} ${status.detail}`
}
