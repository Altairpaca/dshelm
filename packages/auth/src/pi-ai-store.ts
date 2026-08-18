import { randomUUID } from 'node:crypto'
import { chmod, mkdir, open, readFile, rename, unlink } from 'node:fs/promises'
import { dirname } from 'node:path'
import { z } from 'zod'
import type { Credential, CredentialInfo, CredentialStore } from '@earendil-works/pi-ai'

const persistedCredential = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('api_key'),
    key: z.string().optional(),
    env: z.record(z.string(), z.string()).optional(),
  }).passthrough(),
  z.object({
    type: z.literal('oauth'),
    refresh: z.string().min(1),
    access: z.string().min(1),
    expires: z.number().finite(),
  }).passthrough(),
])

const persistedState = z.object({
  version: z.literal(1),
  credentials: z.record(z.string(), persistedCredential),
}).strict()

type PersistedState = {
  version: 1
  credentials: Record<string, Credential>
}

const processLocks = new Map<string, Promise<void>>()

export class FileCredentialStore implements CredentialStore {
  private readonly path: string

  constructor(path: string) {
    if (path.trim().length === 0) throw new TypeError('credential store path must be non-empty')
    this.path = path
  }

  async read(providerId: string): Promise<Credential | undefined> {
    const state = await this.load()
    return state.credentials[providerId]
  }

  async list(): Promise<readonly CredentialInfo[]> {
    const state = await this.load()
    return Object.entries(state.credentials)
      .map(([providerId, credential]) => ({ providerId, type: credential.type }))
      .sort((left, right) => left.providerId.localeCompare(right.providerId))
  }

  async modify(providerId: string, fn: (current: Credential | undefined) => Promise<Credential | undefined>): Promise<Credential | undefined> {
    return this.withProviderLock(providerId, async () => {
      const state = await this.load()
      const current = state.credentials[providerId]
      const next = await fn(current)
      if (next !== undefined) {
        state.credentials[providerId] = next
        await this.save(state)
        return next
      }
      return current
    })
  }

  async delete(providerId: string): Promise<void> {
    await this.withProviderLock(providerId, async () => {
      const state = await this.load()
      if (state.credentials[providerId] === undefined) return
      delete state.credentials[providerId]
      await this.save(state)
    })
  }

  private async withProviderLock<T>(providerId: string, task: () => Promise<T>): Promise<T> {
    const key = `${this.path}\u0000${providerId}`
    const previous = processLocks.get(key) ?? Promise.resolve()
    const next = previous.catch(() => undefined).then(task)
    processLocks.set(key, next.then(() => undefined, () => undefined))
    return next
  }

  private async load(): Promise<PersistedState> {
    try {
      const text = await readFile(this.path, 'utf8')
      return toPersistedState(persistedState.parse(JSON.parse(text)))
    } catch (error) {
      if (isMissingFile(error)) return { version: 1, credentials: {} }
      throw error
    }
  }

  private async save(state: PersistedState): Promise<void> {
    const directory = dirname(this.path)
    await mkdir(directory, { recursive: true, mode: 0o700 })
    await chmod(directory, 0o700)
    const temporaryPath = `${this.path}.${process.pid}.${randomUUID()}.tmp`
    const handle = await open(temporaryPath, 'wx', 0o600)
    try {
      await handle.writeFile(`${JSON.stringify(state)}\n`, 'utf8')
      await handle.chmod(0o600)
      await handle.sync()
    } catch (error) {
      await handle.close()
      await removeIfPresent(temporaryPath)
      throw error
    }
    await handle.close()
    await rename(temporaryPath, this.path)
    await chmod(this.path, 0o600)
  }
}

function toPersistedState(value: z.infer<typeof persistedState>): PersistedState {
  const credentials: Record<string, Credential> = {}
  for (const [providerId, credential] of Object.entries(value.credentials)) {
    credentials[providerId] = toCredential(credential)
  }
  return { version: 1, credentials }
}

function toCredential(value: z.infer<typeof persistedCredential>): Credential {
  if (value.type === 'api_key') {
    return {
      type: 'api_key',
      ...(value.key === undefined ? {} : { key: value.key }),
      ...(value.env === undefined ? {} : { env: value.env }),
    }
  }
  const { type: _type, refresh, access, expires, ...extra } = value
  return { ...extra, type: 'oauth', refresh, access, expires }
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

async function removeIfPresent(path: string): Promise<void> {
  try {
    await unlink(path)
  } catch (error) {
    if (!isMissingFile(error)) throw error
  }
}
