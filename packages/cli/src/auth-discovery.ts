import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { builtinModels } from '@earendil-works/pi-ai/providers/all'
import {
  AuthRegistry,
  EnvironmentApiKeyAuthAdapter,
  FileCredentialStore,
  LibraryOAuthAuthAdapter,
  NativeProductAuthAdapter,
  createPiAiOAuthDriver,
  credentialRef,
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
    registry.register(new NativeProductAuthAdapter({
      resourceId,
      product,
      runner,
      probe: { command, args: ['--version'] },
      status: { command, args: ['auth', 'status'] },
      login: { command, args: ['auth', 'login'], interactive: true },
      logout: { command, args: ['auth', 'logout'] },
      method: nativeMethod(`${resourceId}-login`),
      credential: credentialRef(`product/${resourceId}/default`),
    }))
  }
  const piModels = builtinModels({ credentials: new FileCredentialStore(join(process.cwd(), '.dshelm', 'credentials.json')) })
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
