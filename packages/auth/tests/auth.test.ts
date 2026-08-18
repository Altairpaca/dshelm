import { describe, expect, it } from 'vitest'
import {
  AuthRegistry,
  EnvironmentApiKeyAuthAdapter,
  FileCredentialStore,
  LibraryOAuthAuthAdapter,
  NativeProductAuthAdapter,
  createPiAiOAuthDriver,
  credentialRef,
  type AuthInteraction,
  type CommandResult,
  type ProductCommandRunner,
} from '../src/index.ts'
import { mkdtemp, readFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createModels } from '@earendil-works/pi-ai'

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
  it('persists pi-ai credentials through a private 0600 file without exposing token material to status', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dshelm-auth-'))
    const path = join(directory, 'credentials.json')
    const store = new FileCredentialStore(path)
    const secret = 'oauth-refresh-token-fixture'
    await store.modify('anthropic', async () => ({ type: 'oauth', refresh: secret, access: 'access-fixture', expires: 1_800_000_000_000 }))

    const reopened = new FileCredentialStore(path)
    expect(await reopened.list()).toEqual([{ providerId: 'anthropic', type: 'oauth' }])
    expect(await reopened.read('anthropic')).toMatchObject({ type: 'oauth', refresh: secret })
    const models = createModels({ credentials: reopened })
    expect(await models.checkAuth('anthropic')).toBeUndefined()
    expect((await stat(path)).mode & 0o777).toBe(0o600)
    expect(JSON.stringify(await reopened.list())).not.toContain(secret)
    expect(await readFile(path, 'utf8')).toContain(secret)

    const sequence: string[] = []
    let release: (() => void) | undefined
    let signalStarted: (() => void) | undefined
    const gate = new Promise<void>((resolve) => { release = resolve })
    const firstStarted = new Promise<void>((resolve) => { signalStarted = resolve })
    const first = reopened.modify('anthropic', async () => {
      sequence.push('first-start')
      signalStarted?.()
      await gate
      sequence.push('first-end')
      return { type: 'oauth', refresh: 'first', access: 'access', expires: 1_800_000_000_000 }
    })
    const second = reopened.modify('anthropic', async (current) => {
      sequence.push(current?.type === 'oauth' && current.refresh === 'first' ? 'second-after-first' : 'second-before-first')
      return { type: 'oauth', refresh: 'second', access: 'access', expires: 1_800_000_000_000 }
    })
    await firstStarted
    expect(sequence).toEqual(['first-start'])
    if (release === undefined) throw new Error('fixture release was not initialized')
    release()
    await Promise.all([first, second])
    expect(sequence).toEqual(['first-start', 'first-end', 'second-after-first'])
  })

  it('maps pi-ai Models login/checkAuth/logout into the provider-neutral driver without returning credentials', async () => {
    const events: string[] = []
    const prompts: unknown[] = []
    const models = {
      checkAuth: async () => ({ type: 'oauth' as const, source: 'fixture-store' }),
      login: async (_provider: string, _type: 'oauth', interaction: { notify: (event: unknown) => void; prompt: (prompt: unknown) => Promise<string> }) => {
        interaction.notify({ type: 'info', message: 'fixture login' })
        await interaction.prompt({ type: 'select', message: 'choose account', options: [{ id: 'default', label: 'Default' }] })
        return { type: 'oauth' as const, refresh: 'never-return-this', access: 'access', expires: 1_800_000_000_000 }
      },
      logout: async () => undefined,
    }
    const driver = createPiAiOAuthDriver({ models, providerId: 'anthropic' })
    const status = await driver.status()
    expect(status).toMatchObject({ status: 'authenticated', detail: 'pi-ai reports oauth credentials are configured' })
    const login = await driver.login({ notify: (event) => events.push(event.message), prompt: async (prompt) => { prompts.push(prompt); return 'fixture' } })
    expect(login).toMatchObject({ status: 'authenticated' })
    expect(JSON.stringify(login)).not.toContain('never-return-this')
    expect(JSON.stringify(prompts[0])).toContain('"type":"select"')
    expect(JSON.stringify(prompts[0])).toContain('"id":"default"')
    await driver.logout()
    expect(events).toEqual(['fixture login'])
  })

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
