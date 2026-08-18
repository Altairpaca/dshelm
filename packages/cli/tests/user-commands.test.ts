import { describe, expect, it } from 'vitest'
import { AuthRegistry, EnvironmentApiKeyAuthAdapter, credentialRef } from '@dshelm/auth'
import { createDefaultAuthRegistry, defaultAuthProbeContext } from '../src/auth-discovery.ts'
import { authLines, knowledgeStatusLines, modelExplainLines, modelInspectLines, uninstallProfile } from '../src/user-commands.ts'
import { BASELINE_KNOWLEDGE_BUNDLE } from '@dshelm/model-knowledge'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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
    await mkdir(directory)
    await writeFile(join(directory, 'profile.json'), '{}')
    await writeFile(join(directory, 'credentials.json'), '{"version":1,"credentials":{}}')
    expect(await uninstallProfile({ cwd, purgeCredentials: false })).toMatchObject({ removedProfile: true, removedCredentials: false })
    await readFile(join(directory, 'credentials.json'), 'utf8')
    expect(await uninstallProfile({ cwd, purgeCredentials: true })).toMatchObject({ removedCredentials: true })
  })

  it('reports knowledge staleness as a machine-readable status line', () => {
    expect(knowledgeStatusLines(BASELINE_KNOWLEDGE_BUNDLE, new Date('2027-01-01T00:00:00.000Z'))[0]).toContain('knowledge=stale')
  })
})
