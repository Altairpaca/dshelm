import { describe, expect, it } from 'vitest'
import {
  AuthRegistry,
  EnvironmentApiKeyAuthAdapter,
  LibraryOAuthAuthAdapter,
  NativeProductAuthAdapter,
  credentialRef,
  type AuthInteraction,
  type CommandResult,
  type ProductCommandRunner,
} from '../src/index.ts'

const context = {
  now: () => 1_700_000_000_000,
  commandExists: async () => true,
  env: (name: string) => name === 'DEEPSEEK_API_KEY' ? 'present-but-never-returned' : undefined,
}

const interaction: AuthInteraction = {
  notify: () => undefined,
  prompt: async () => 'fixture-input',
}

function runnerFor(results: readonly CommandResult[]): ProductCommandRunner {
  let index = 0
  return {
    run: async () => {
      const result = results[index]
      index += 1
      if (result === undefined) throw new Error('fixture command exhausted')
      return result
    },
  }
}

describe('provider-neutral auth registry', () => {
  it('reports native product auth without returning command output or secrets', async () => {
    const runner = runnerFor([
      { exitCode: 0, stdout: 'codex 1.0.0', stderr: '' },
      { exitCode: 1, stdout: 'refresh_token=never-return-this', stderr: '' },
    ])
    const adapter = new NativeProductAuthAdapter({
      resourceId: 'codex-native',
      product: 'ChatGPT/Codex',
      runner,
      probe: { command: 'codex', args: ['--version'] },
      status: { command: 'codex', args: ['auth', 'status'] },
      login: { command: 'codex', args: ['auth', 'login'] },
      logout: { command: 'codex', args: ['auth', 'logout'] },
      method: {
        id: 'chatgpt-product-login',
        kind: 'native-product',
        owner: 'product',
        interactive: true,
        headless: false,
        refreshOwner: 'product',
        credentialStoreOwner: 'product',
        supportsMultiAccount: false,
      },
      credential: credentialRef('product/codex-native/default'),
    })

    const statuses = await adapter.status(context)

    expect(statuses).toHaveLength(1)
    expect(statuses[0]).toMatchObject({ status: 'action-required', credentialRef: credentialRef('product/codex-native/default') })
    expect(JSON.stringify(statuses)).not.toContain('never-return-this')
  })

  it('keeps library OAuth ownership behind a driver and supports explicit login/logout', async () => {
    const events: string[] = []
    const adapter = new LibraryOAuthAuthAdapter({
      resourceId: 'anthropic-subscription',
      product: 'Anthropic Claude subscription',
      method: {
        id: 'anthropic-oauth',
        kind: 'library-oauth',
        owner: 'provider',
        interactive: true,
        headless: false,
        refreshOwner: 'provider',
        credentialStoreOwner: 'dshelm',
        supportsMultiAccount: true,
      },
      credential: credentialRef('oauth/anthropic/default'),
      driver: {
        status: async () => ({ status: 'available', detail: 'login required' }),
        login: async () => {
          events.push('login')
          return { status: 'authenticated', detail: 'provider OAuth credential stored', expiresAt: 1_700_000_100_000 }
        },
        logout: async () => {
          events.push('logout')
        },
      },
    })

    const statuses = await adapter.status(context)
    expect(statuses[0]).toMatchObject({ status: 'available', authOwner: 'provider', credentialRef: credentialRef('oauth/anthropic/default') })
    expect(await adapter.login('anthropic-oauth', interaction, context)).toMatchObject({ status: 'authenticated' })
    expect(await adapter.logout('anthropic-oauth', context)).toMatchObject({ status: 'available' })
    expect(events).toEqual(['login', 'logout'])
  })

  it('sorts registry output deterministically and rejects duplicate resources', async () => {
    const registry = new AuthRegistry()
    const make = (resourceId: string): LibraryOAuthAuthAdapter => new LibraryOAuthAuthAdapter({
      resourceId,
      product: resourceId,
      method: {
        id: `${resourceId}-oauth`,
        kind: 'library-oauth',
        owner: 'provider',
        interactive: true,
        headless: true,
        refreshOwner: 'provider',
        credentialStoreOwner: 'dshelm',
        supportsMultiAccount: false,
      },
      credential: credentialRef(`oauth/${resourceId}/default`),
      driver: {
        status: async () => ({ status: 'authenticated', detail: 'fixture' }),
        login: async () => ({ status: 'authenticated', detail: 'fixture' }),
        logout: async () => undefined,
      },
    })

    registry.register(make('zeta'))
    registry.register(make('alpha'))
    expect((await registry.status(context)).map((status) => status.resourceId)).toEqual(['alpha', 'zeta'])
    expect(() => registry.register(make('alpha'))).toThrowError(/already registered/)
  })

  it('reports host-managed API key readiness without copying the key', async () => {
    const adapter = new EnvironmentApiKeyAuthAdapter({
      resourceId: 'deepseek-api',
      product: 'DeepSeek API',
      method: {
        id: 'deepseek-api-key',
        kind: 'api-key',
        owner: 'host',
        interactive: false,
        headless: true,
        refreshOwner: 'none',
        credentialStoreOwner: 'host',
        supportsMultiAccount: false,
      },
      credential: credentialRef('env/deepseek/api-key'),
      envVar: 'DEEPSEEK_API_KEY',
    })

    const statuses = await adapter.status(context)
    expect(statuses[0]).toMatchObject({ status: 'authenticated', authOwner: 'host' })
    expect(JSON.stringify(statuses)).not.toContain('present-but-never-returned')
  })
})
