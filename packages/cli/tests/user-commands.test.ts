import { describe, expect, it } from 'vitest'
import { AuthRegistry, EnvironmentApiKeyAuthAdapter, credentialRef } from '@dshelm/auth'
import { createDefaultAuthRegistry, defaultAuthProbeContext } from '../src/auth-discovery.ts'
import { authLines, initProfile, knowledgeStatusLines, modelExplainLines, modelInspectLines, uninstallProfile } from '../src/user-commands.ts'
import { BASELINE_KNOWLEDGE_BUNDLE } from '@dshelm/model-knowledge'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const cliPackageManifest = JSON.parse(await readFile(join(process.cwd(), 'packages/cli/package.json'), 'utf8')) as { version: string }

describe('DSHelm user command projections', () => {
  it('renders model inventory and evidence-backed explanation', () => {
    expect(modelInspectLines(BASELINE_KNOWLEDGE_BUNDLE).some((line) => line.startsWith('deepseek/deepseek-v4-flash'))).toBe(true)
    expect(modelExplainLines(BASELINE_KNOWLEDGE_BUNDLE, 'deepseek/deepseek-v4-flash')[1]).toContain('runtimeReady')
  })

  it('rejects ambiguous model references without contacting a provider', () => {
    expect(modelExplainLines(BASELINE_KNOWLEDGE_BUNDLE, 'deepseek')).toEqual(['invalid model reference "deepseek"; expected <provider>/<model>'])
  })

  it('projects auth state without credential material', async () => {
    const registry = new AuthRegistry()
    registry.register(new EnvironmentApiKeyAuthAdapter({
      resourceId: 'fixture-api',
      product: 'Fixture API',
      method: { id: 'fixture-key', kind: 'api-key', owner: 'host', interactive: false, headless: true, refreshOwner: 'none', credentialStoreOwner: 'host', supportsMultiAccount: false },
      credential: credentialRef('env/FIXTURE_KEY'),
      envVar: 'FIXTURE_KEY',
    }))
    const statuses = await registry.status({ ...defaultAuthProbeContext(), env: () => 'secret-never-rendered' })
    expect(authLines(statuses)[0]).not.toContain('secret-never-rendered')
  })

  it('discovers pi-ai provider-owned OAuth resources without importing product credential files', () => {
    const resources = createDefaultAuthRegistry().list().map((adapter) => adapter.resourceId)
    expect(resources).toContain('pi-ai/anthropic')
    expect(resources).toContain('pi-ai/openai-codex')
  })

  it('uninstalls the generated profile while preserving credentials unless purge is explicit', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'dshelm-uninstall-'))
    const directory = join(cwd, '.dshelm')
    const dshHome = join(cwd, 'dsh-home')
    const env = { DSHELM_CONFIG_DIR: join(cwd, 'config') }
    await mkdir(directory)
    await writeFile(join(directory, 'profile.json'), '{}')
    await writeFile(join(directory, 'credentials.json'), '{"version":1,"credentials":{}}')
    expect(await uninstallProfile({ cwd, dshHome, env, purgeCredentials: false })).toMatchObject({ removedProfile: true, removedCredentials: false })
    await readFile(join(directory, 'credentials.json'), 'utf8')
    await mkdir(join(env.DSHELM_CONFIG_DIR, 'credentials'), { recursive: true })
    await writeFile(join(env.DSHELM_CONFIG_DIR, 'credentials', 'credentials.json'), '{"version":1,"credentials":{}}', { mode: 0o600 })
    expect(await uninstallProfile({ cwd, dshHome, env, purgeCredentials: true })).toMatchObject({ removedCredentials: true })
    await expect(readFile(join(directory, 'credentials.json'), 'utf8')).rejects.toThrow()
    await expect(readFile(join(env.DSHELM_CONFIG_DIR, 'credentials', 'credentials.json'), 'utf8')).rejects.toThrow()
  })

  it('installs the DSH bundle at the same version as the installed CLI', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'dshelm-init-'))
    const dshHome = join(cwd, 'dsh-home')
    const expectedBundleSpec = `@dshelm/dsh@${cliPackageManifest.version}`
    const result = await initProfile(new AuthRegistry(), { ...defaultAuthProbeContext(), commandExists: async () => false }, {
      cwd,
      dshHome,
      now: () => new Date('2026-08-18T00:00:00.000Z'),
      installDshProfile: async ({ profileDir, bundleSpecs }) => {
        expect(bundleSpecs).toEqual([expectedBundleSpec])
        await mkdir(join(profileDir, 'node_modules', '@dshelm', 'dsh'), { recursive: true })
        await writeFile(join(profileDir, 'node_modules', '@dshelm', 'dsh', 'package.json'), JSON.stringify({ name: '@dshelm/dsh', version: cliPackageManifest.version }))
        await writeFile(join(profileDir, 'package.json'), JSON.stringify({ name: 'dsh-profile-dshelm', private: true, dependencies: { '@dshelm/dsh': 'fixture' }, dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@dshelm/dsh'] } } }))
      },
    })
    expect(result.written).toBe(true)
    expect(result.profile.dshProfile.bundles).toEqual(['@deepseek-ai/dsh-base', '@dshelm/dsh'])
    expect(result.path).toBe(join(cwd, '.dshelm', 'profile.json'))
    expect(result.profile.dshProfile.path).toBe(join(dshHome, 'profiles', 'dshelm'))
    await expect(readFile(join(cwd, '.dshelm', 'credentials.json'), 'utf8')).rejects.toThrow()
    expect(JSON.parse(await readFile(join(dshHome, 'profiles', 'dshelm', 'package.json'), 'utf8'))).toMatchObject({ dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@dshelm/dsh'] } } })
  })

  it('reports knowledge staleness as a machine-readable status line', () => {
    expect(knowledgeStatusLines(BASELINE_KNOWLEDGE_BUNDLE, new Date('2027-01-01T00:00:00.000Z'))[0]).toContain('knowledge=stale')
  })
})
